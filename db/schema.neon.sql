-- Esquema Neon (plantilla-web). Reemplaza supabase/schema.sql. Sin Supabase Auth ni PostgREST.
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Usuarios del panel (login propio) y sesiones
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists app_sessions (
  id text primary key,                    -- sha256 del token de la cookie
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists app_sessions_user_idx on app_sessions(user_id);

-- 1. TENANTS — un registro por cliente de VONN (una barbería, un kiosco, etc.)
-- --------------------------------------------------------------------------
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                    -- ej: "barberia-lopez" -> barberia-lopez.vonn.com.ar
  business_name text not null,
  logo_url text,
  primary_color text default '#0066CC',         -- color de marca del cliente (no el de VONN)
  accent_color text default '#FF9500',
  business_mode text not null default 'ninguno' -- 'turnos' | 'pedidos' | 'ninguno'
    check (business_mode in ('turnos', 'pedidos', 'ninguno')),
  status text not null default 'activo'
    check (status in ('activo', 'pausado', 'cancelado')),
  -- Parámetros del negocio que el propio cliente edita libremente desde
  -- /panel/configuracion, sin aprobación de nadie (a diferencia de lo que
  -- requiere tocar código, que pasa por Fase 4 / Aprobaciones).
  horario_atencion jsonb not null default '{
    "lunes":{"abierto":true,"desde":"09:00","hasta":"18:00"},
    "martes":{"abierto":true,"desde":"09:00","hasta":"18:00"},
    "miercoles":{"abierto":true,"desde":"09:00","hasta":"18:00"},
    "jueves":{"abierto":true,"desde":"09:00","hasta":"18:00"},
    "viernes":{"abierto":true,"desde":"09:00","hasta":"18:00"},
    "sabado":{"abierto":false,"desde":"09:00","hasta":"13:00"},
    "domingo":{"abierto":false,"desde":"09:00","hasta":"13:00"}
  }'::jsonb,
  cupo_simultaneo integer not null default 1,
  created_at timestamptz not null default now()
);

comment on table tenants is 'Un registro por cliente de VONN. slug define su subdominio (slug.vonn.com.ar).';

-- --------------------------------------------------------------------------
-- 2. TENANT_MEMBERS — quién puede entrar al panel de cada cliente, y con qué rol
--    Vincula usuarios de app_users con un tenant.
-- --------------------------------------------------------------------------
create table if not exists tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  invited_email text not null,                  -- se guarda aunque el usuario todavía no haya aceptado la invitación
  role text not null default 'empleado'
    check (role in ('owner', 'empleado')),
  status text not null default 'invitado'
    check (status in ('invitado', 'activo', 'revocado')),
  created_at timestamptz not null default now(),
  unique (tenant_id, invited_email)
);

comment on table tenant_members is 'Accesos al panel: quién pertenece a qué tenant, con qué rol (owner/empleado).';

-- --------------------------------------------------------------------------
-- 3. SITE_CONTENT — el contenido editable del sitio público (1 fila por tenant)
--    Esto es lo que el dueño edita desde "Editor de contenido" en el panel.
-- --------------------------------------------------------------------------
create table if not exists site_content (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  about_text text,
  address text,
  whatsapp_number text,
  instagram_url text,
  facebook_url text,
  schedule jsonb default '{}'::jsonb,           -- ej: {"lunes": "9 a 13 y 17 a 20", "domingo": "cerrado"}
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 4. CATALOG_ITEMS — lo que el cliente vende u ofrece (productos o servicios)
-- --------------------------------------------------------------------------
create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2),
  image_url text,
  category text,
  duration_minutes int,                          -- solo tiene sentido en modo "turnos" (ej: corte = 30 min)
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 5a. BOOKINGS (turnos) — para tenants con business_mode = 'turnos'
-- --------------------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  catalog_item_id uuid references catalog_items(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'cancelado', 'completado')),
  notes text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 5b. ORDERS + ORDER_ITEMS (pedidos) — para tenants con business_mode = 'pedidos'
-- --------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'preparando', 'listo', 'entregado', 'cancelado')),
  total numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  catalog_item_id uuid references catalog_items(id) on delete set null,
  item_name text not null,                        -- copia del nombre al momento del pedido (por si el producto cambia después)
  quantity int not null default 1,
  unit_price numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

-- --------------------------------------------------------------------------
-- 6. CONTACT_MESSAGES — bandeja de mensajes del formulario de contacto público
-- --------------------------------------------------------------------------
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 7. SUPPORT_TICKETS — botón de "reportar un error" dentro del panel privado
--    (Fase 3/4 del documento maestro: hoy queda como registro; la
--    auto-reparación con IA se conecta más adelante sobre esta tabla)
-- --------------------------------------------------------------------------
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references app_users(id) on delete set null,
  category text,                                  -- respuesta rápida del bot filtro (ej: "no carga una imagen")
  description text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_progreso', 'resuelto')),
  created_at timestamptz not null default now()
);


-- Al crearse un usuario, activa su invitación pendiente (mismo comportamiento que antes)
create or replace function link_invited_member() returns trigger language plpgsql as $$
begin
  update tenant_members set user_id = new.id, status = 'activo'
  where invited_email = new.email and status = 'invitado';
  return new;
end; $$;
drop trigger if exists on_app_user_created on app_users;
create trigger on_app_user_created after insert on app_users
  for each row execute function link_invited_member();

-- Seed de demo (sin datos reales)
insert into tenants (slug, business_name, business_mode) values ('demo','Barbería Demo','turnos') on conflict do nothing;
-- TODO endurecimiento: rol de app sin BYPASSRLS + RLS con current_setting('app.tenant_id'). Hoy el aislamiento es por filtro explícito en el código.
