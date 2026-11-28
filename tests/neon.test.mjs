import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Postgres embebido, sin red ni credenciales. Ejecuta el SQL real y los módulos
// TS reales; solo sustituye el transporte Neon y el contexto HTTP de Next.
const root = fileURLToPath(new URL('../', import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const db = new PGlite({ extensions: { citext, pgcrypto } });
const jar = new Map();
const cookieWrites = new Map();
const requestHeaders = new Headers();
const env = { DATABASE_URL: 'postgresql://test.invalid/local' };
const modules = new Map();
class Redirect extends Error {}
function load(relative) {
  const path = resolve(root, relative);
  if (modules.has(path)) return modules.get(path);
  const loadedModule = { exports: {} };
  modules.set(path, loadedModule.exports);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  function requireMock(name) {
    if (name === 'server-only') return {};
    if (name === '@neondatabase/serverless') return {
      neon: () => ({ query: async (text, params) => (await db.query(text, params)).rows }),
    };
    if (name === 'next/headers') return {
      headers: async () => requestHeaders,
      cookies: async () => ({
        get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined,
        set: (name, value, options) => { jar.set(name, value); cookieWrites.set(name, options); },
      }),
    };
    if (name === 'next/navigation') return { redirect: (path) => { throw new Redirect(path); } };
    if (name === 'next/cache') return { revalidatePath: () => {} };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    return nodeRequire(name);
  }
  new Function('require', 'module', 'exports', 'process', code)(requireMock, loadedModule, loadedModule.exports, { env });
  return loadedModule.exports;
}
const q = async (text, params = []) => (await db.query(text, params)).rows;
const one = async (text, params = []) => (await q(text, params))[0];
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const session = load('src/lib/session.ts');
const auth = load('src/lib/auth.ts');
const employees = load('src/app/panel/(dashboard)/empleados/actions.ts');
const activation = load('src/app/panel/activar/actions.ts');
const login = load('src/app/panel/actions/auth.ts');
let a, b, owner, other, catalogA, catalogB;

before(async () => {
  await db.exec(readFileSync(resolve(root, 'db/schema.neon.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(root, 'docs/neon-migracion-extra.sql'), 'utf8'));
});
beforeEach(async () => {
  await db.exec('truncate tenants, app_users cascade');
  jar.clear(); cookieWrites.clear(); requestHeaders.delete('x-tenant-slug');
  env.DATABASE_URL = 'postgresql://test.invalid/local';
  [a, b, owner, other, catalogA, catalogB] = Array.from({ length: 6 }, () => randomUUID());
  await q("insert into tenants(id, slug, business_name) values ($1, 'alpha', 'A'), ($2, 'beta', 'B')", [a, b]);
  const hash = await session.hashPassword('correct-password');
  await q("insert into app_users(id,email,password_hash) values ($1,'owner@test.invalid',$3),($2,'other@test.invalid',$3)", [owner, other, hash]);
  await q("insert into tenant_members(tenant_id,user_id,invited_email,role,status) values ($1,$2,'owner@test.invalid','owner','activo'),($3,$4,'other@test.invalid','owner','activo')", [a, owner, b, other]);
  await q("insert into catalog_items(id,tenant_id,name,price) values ($1,$2,'A',1234.50),($3,$4,'B',99)", [catalogA,a,catalogB,b]);
  await session.createSession(owner);
});
after(async () => { await db.close(); });

test('scrypt usa salts únicos, verifica y rechaza hashes malformados', async () => {
  const hash = await session.hashPassword('contraseña');
  assert.match(hash, /^scrypt\$16384\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.notEqual(hash, await session.hashPassword('contraseña'));
  assert.equal(await session.verifyPassword('contraseña', hash), true);
  assert.equal(await session.verifyPassword('incorrecta', hash), false);
  for (const bad of ['', 'scrypt$999999999$a$b', hash + '$extra', hash.slice(0, -1)]) {
    assert.equal(await session.verifyPassword('contraseña', bad), false);
  }
});

test('sesiones: cookie segura, solo hash en DB, expiración y logout', async () => {
  const token = jar.get('vonn_session');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const row = await one('select id, expires_at from app_sessions');
  assert.equal(row.id, session.hashToken(token));
  assert.notEqual(row.id, token);
  const options = cookieWrites.get('vonn_session');
  assert.deepEqual([options.httpOnly,options.secure,options.sameSite,options.path,options.maxAge], [true,true,'lax','/',2592000]);
  assert.equal((await session.readSession()).id, owner);
  await q("update app_sessions set expires_at = now() - interval '1 second'");
  assert.equal(await session.readSession(), null);
  await assert.rejects(auth.requireMembership(), /\/panel\/login/);
  await session.closeSession();
  assert.equal((await q('select * from app_sessions')).length, 0);
  assert.equal(cookieWrites.get('vonn_session').maxAge, 0);
});

test('login genérico, email citext y membresías revocadas/tenants pausados', async () => {
  for (const values of [{ email: 'missing@test.invalid', password: 'wrong' }, { email:'owner@test.invalid', password:'wrong' }]) {
    assert.equal((await login.login({}, form(values))).error, 'Email o contraseña incorrectos');
  }
  await assert.rejects(login.login({}, form({email:'OWNER@test.invalid',password:'correct-password'})), /\/panel$/);
  assert.equal((await auth.requireMembership()).tenant.id, a);
  await q("update tenant_members set status = 'revocado' where tenant_id = $1", [a]);
  await assert.rejects(auth.requireMembership(), /sin-acceso/);
  await q("update tenant_members set status = 'activo' where tenant_id = $1", [a]);
  await q("update tenants set status = 'pausado' where id = $1", [a]);
  await assert.rejects(auth.requireMembership(), /sin-acceso/);
});

test('catálogo: IDs ajenos y tenant_id falsificado no permiten modificar otro cliente', async () => {
  const actions = load('src/app/panel/(dashboard)/catalogo/actions.ts');
  const injected = "Producto '); delete from tenants; --";
  await actions.updateCatalogItem(catalogB, form({name:'hacked', price:'1', tenant_id:b}));
  await actions.toggleCatalogItem(catalogB, false);
  await actions.deleteCatalogItem(catalogB);
  assert.equal((await one('select name from catalog_items where id=$1',[catalogB])).name, 'B');
  await actions.addCatalogItem(form({name:injected,price:'12,50',tenant_id:b}));
  const created = await one('select * from catalog_items where name=$1',[injected]);
  assert.equal(created.tenant_id,a);
  assert.equal(Number(created.price),12.5);
  await actions.updateCatalogItem(catalogA, form({name:'Actualizado',price:'22,50'}));
  assert.equal(Number((await one('select price from catalog_items where id=$1',[catalogA])).price),22.5);
  await actions.deleteCatalogItem(catalogA);
  assert.equal((await q('select * from catalog_items where id=$1',[catalogA])).length,0);
});

test('actividad y mensajes: UPDATE queda limitado al tenant de la sesión', async () => {
  const booking = randomUUID(), order = randomUUID(), message = randomUUID();
  await q("insert into bookings(id,tenant_id,customer_name,customer_phone,scheduled_at) values ($1,$2,'B','123',now())",[booking,b]);
  await q("insert into orders(id,tenant_id,customer_name,customer_phone) values ($1,$2,'B','123')",[order,b]);
  await q("insert into contact_messages(id,tenant_id,name,message) values ($1,$2,'B','Hi')",[message,b]);
  const activity = load('src/app/panel/(dashboard)/actividad/actions.ts');
  await activity.updateBookingStatus(booking,'cancelado');
  await activity.updateOrderStatus(order,'cancelado');
  await load('src/app/panel/(dashboard)/mensajes/actions.ts').markMessageRead(message);
  assert.equal((await one('select status from bookings where id=$1',[booking])).status,'pendiente');
  assert.equal((await one('select status from orders where id=$1',[order])).status,'pendiente');
  assert.equal((await one('select is_read from contact_messages where id=$1',[message])).is_read,false);
});

test('contenido, configuración y soporte ignoran tenant_id del formulario', async () => {
  const content = load('src/app/panel/(dashboard)/contenido/actions.ts');
  await content.saveSiteContent(form({tenant_id:b,hero_title:'Primero',schedule_domingo:'Cerrado'}));
  await content.saveSiteContent(form({tenant_id:b,hero_title:'Segundo'}));
  assert.equal((await one('select hero_title from site_content where tenant_id=$1',[a])).hero_title,'Segundo');
  assert.equal((await q('select * from site_content where tenant_id=$1',[b])).length,0);
  await load('src/app/panel/(dashboard)/configuracion/actions.ts').updateConfiguracion(form({tenant_id:b,cupo_simultaneo:'3'}));
  assert.equal((await one('select cupo_simultaneo from tenants where id=$1',[a])).cupo_simultaneo,3);
  assert.equal((await one('select cupo_simultaneo from tenants where id=$1',[b])).cupo_simultaneo,1);
  await load('src/app/panel/(dashboard)/soporte/actions.ts').createTicket({},form({tenant_id:b,description:'Ayuda'}));
  assert.equal((await one('select tenant_id from support_tickets')).tenant_id,a);
});

test('contacto público resuelve tenant por host, no por formulario; conserva demo', async () => {
  const contact = load('src/app/actions/contact.ts');
  requestHeaders.set('x-tenant-slug','alpha');
  jar.clear();
  const result = await contact.sendContactMessage({},form({tenant_id:b,name:'Visita',message:'Hola'}));
  assert.equal(result.ok,true);
  assert.equal((await one('select tenant_id from contact_messages')).tenant_id,a);
  env.DATABASE_URL = '';
  const publicQueries = load('src/lib/queries.ts');
  assert.equal((await publicQueries.getTenantBySlug('unknown')).slug,'demo');
  assert.ok((await publicQueries.getCatalog('demo')).length);
  assert.equal((await contact.sendContactMessage({},form({name:'A',message:'B'}))).ok,false);
});

async function invite(email = 'invited@test.invalid') {
  const result = await employees.inviteEmployee({},form({email,tenant_id:b}));
  assert.equal(result.error,'');
  return new URL(result.invitePath,'https://test.invalid').searchParams.get('token');
}

test('owner invita: token hasheado, alta por trigger, consumo único y login', async () => {
  const token = await invite();
  const row = await one('select * from app_invites');
  assert.equal(row.token_hash,session.hashToken(token));
  assert.equal((await one('select tenant_id from tenant_members where id=$1',[row.member_id])).tenant_id,a);
  jar.clear();
  await assert.rejects(activation.activateAccount(token,{},form({password:'new-password'})), /\/panel$/);
  assert.equal((await session.readSession()).email,'invited@test.invalid');
  assert.equal((await auth.requireMembership()).role,'empleado');
  assert.equal((await q('select * from app_invites')).length,0);
  assert.ok((await activation.activateAccount(token,{},form({password:'new-password'}))).error);
});

test('activación concurrente solo consume una vez', async () => {
  const token = await invite();
  const hash = await session.hashPassword('new-password');
  const results = await Promise.allSettled([
    q('select activate_app_invite($1,$2,null)',[session.hashToken(token),hash]),
    q('select activate_app_invite($1,$2,null)',[session.hashToken(token),hash]),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await q("select * from app_users where email='invited@test.invalid'")).length,1);
});

test('invitaciones vencidas, revocadas o alteradas no crean cuentas', async () => {
  const token = await invite();
  await q("update app_invites set expires_at=now()-interval '1 second'");
  assert.ok((await activation.activateAccount(token,{},form({password:'new-password'}))).error);
  await q("update app_invites set expires_at=now()+interval '1 day'");
  const member = await one("select id from tenant_members where invited_email='invited@test.invalid'");
  await employees.revokeEmployee(member.id);
  assert.ok((await activation.activateAccount(token,{},form({password:'new-password'}))).error);
  assert.ok((await activation.activateAccount(session.newToken(),{},form({password:'new-password'}))).error);
  assert.equal((await q("select * from app_users where email='invited@test.invalid'")).length,0);
});

test('cuenta existente requiere su contraseña y nunca la reemplaza', async () => {
  const token = await invite('other@test.invalid');
  const original = await one('select password_hash from app_users where id=$1',[other]);
  assert.ok((await activation.activateAccount(token,{},form({password:'wrong-password'}))).error);
  assert.equal((await q('select * from app_invites')).length,1);
  await assert.rejects(activation.activateAccount(token,{},form({password:'correct-password'})), /\/panel$/);
  assert.equal((await one('select password_hash from app_users where id=$1',[other])).password_hash,original.password_hash);
  assert.equal((await one('select status from tenant_members where tenant_id=$1 and user_id=$2',[a,other])).status,'activo');
});

test('solo owner invita/revoca, no puede revocar owners ni miembros ajenos', async () => {
  const memberB = await one('select id from tenant_members where tenant_id=$1',[b]);
  await employees.revokeEmployee(memberB.id);
  const ownMember = await one('select id from tenant_members where user_id=$1',[owner]);
  await employees.revokeEmployee(ownMember.id);
  assert.equal((await one('select status from tenant_members where id=$1',[ownMember.id])).status,'activo');
  assert.equal((await one('select status from tenant_members where id=$1',[memberB.id])).status,'activo');
  await q("update tenant_members set role='empleado' where id=$1",[ownMember.id]);
  assert.ok((await employees.inviteEmployee({},form({email:'forbidden@test.invalid'}))).error);
  assert.equal((await q('select * from app_invites')).length,0);
});
