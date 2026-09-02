import { headers } from "next/headers";

// Resuelve de qué cliente (tenant) es el pedido actual, a partir del
// subdominio en la URL.
//
// En producción: cliente.vonn.com.ar -> slug = "cliente"
// En desarrollo local (localhost, o preview de Vercel): no hay subdominio
// real, así que se usa NEXT_PUBLIC_DEMO_TENANT_SLUG como cliente de prueba.
//
// El header x-tenant-slug lo agrega el middleware (ver src/middleware.ts).
export async function resolveTenantSlug(): Promise<string> {
  const headerList = await headers();
  const fromMiddleware = headerList.get("x-tenant-slug");
  if (fromMiddleware) return fromMiddleware;

  return process.env.NEXT_PUBLIC_DEMO_TENANT_SLUG || "demo";
}

export function extractSlugFromHost(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0]; // saca el puerto si lo tiene (localhost:3000)
  const parts = hostname.split(".");

  // localhost / IPs / previews de Vercel sin subdominio propio -> sin tenant
  if (hostname === "localhost" || parts.length < 3) return null;

  const [subdomain] = parts;
  if (subdomain === "www" || subdomain === "vonn") return null;

  return subdomain;
}
