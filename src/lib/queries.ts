import "server-only";
import { query, queryOne } from "@/lib/db";
import { isDbConfigured } from "@/lib/config";
import { demoTenant, demoSiteContent, demoCatalog } from "@/lib/demo-data";
import type { Tenant, SiteContent, CatalogItem } from "@/lib/types";

// Datos públicos: el caller resuelve el tenant desde el host; el editor
// privado pasa exclusivamente membership.tenant.id. Sin DB hay demo.
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!isDbConfigured()) return demoTenant;
  return queryOne<Tenant>("select * from tenants where slug = $1 and status = 'activo'", [slug]);
}

export async function getSiteContent(tenantId: string): Promise<SiteContent | null> {
  if (!isDbConfigured()) return demoSiteContent;
  return queryOne<SiteContent>("select * from site_content where tenant_id = $1", [tenantId]);
}

export async function getCatalog(tenantId: string): Promise<CatalogItem[]> {
  if (!isDbConfigured()) return demoCatalog;
  return query<CatalogItem>(
    "select * from catalog_items where tenant_id = $1 and active = true order by sort_order asc",
    [tenantId],
  );
}
