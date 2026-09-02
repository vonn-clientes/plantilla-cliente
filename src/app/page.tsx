import { resolveTenantSlug } from "@/lib/tenant/resolve";
import { getTenantBySlug, getSiteContent, getCatalog } from "@/lib/queries";
import { ContactForm } from "@/components/public/ContactForm";
import { WhatsappButton } from "@/components/public/WhatsappButton";
import { notFound } from "next/navigation";

// Esta es la página pública del comercio (ej: barberia-lopez.vonn.com.ar).
// Todo el contenido sale de site_content/catalog_items en Supabase, filtrado
// por tenant — así una sola plantilla sirve para todos los clientes.
export default async function PublicSite() {
  const slug = await resolveTenantSlug();
  const tenant = await getTenantBySlug(slug);

  if (!tenant) notFound();

  const [content, catalog] = await Promise.all([
    getSiteContent(tenant.id),
    getCatalog(tenant.id),
  ]);

  return (
    <main
      className="flex-1"
      style={
        {
          "--color-primary": tenant.primary_color,
          "--color-accent": tenant.accent_color,
        } as React.CSSProperties
      }
    >
      {/* ---- Hero ---- */}
      <section className="px-6 py-24 sm:py-32 flex flex-col items-center text-center gap-6 bg-canvas-muted">
        {tenant.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.business_name} className="h-16 w-auto mb-2" />
        )}
        <h1 className="vonn-text-display max-w-2xl">
          {content?.hero_title || tenant.business_name}
        </h1>
        {content?.hero_subtitle && (
          <p className="vonn-text-subtitulo text-ink-muted max-w-xl font-normal">
            {content.hero_subtitle}
          </p>
        )}
        {content?.whatsapp_number && (
          <a
            href={`https://wa.me/549${content.whatsapp_number.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 rounded-pill bg-primary text-white px-8 py-4 vonn-text-cuerpo font-medium shadow-md"
          >
            Escribinos por WhatsApp
          </a>
        )}
      </section>

      {/* ---- Sobre el negocio ---- */}
      {content?.about_text && (
        <section className="px-6 py-16 max-w-3xl mx-auto text-center">
          <p className="vonn-text-cuerpo text-ink-muted">{content.about_text}</p>
        </section>
      )}

      {/* ---- Catálogo / servicios ---- */}
      {catalog.length > 0 && (
        <section className="px-6 py-16 bg-canvas-muted">
          <h2 className="vonn-text-titulo text-center mb-10">Lo que ofrecemos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {catalog.map((item) => (
              <div
                key={item.id}
                className="rounded-md bg-surface border border-line p-6 flex flex-col gap-2 shadow-sm"
              >
                <h3 className="vonn-text-subtitulo">{item.name}</h3>
                {item.description && (
                  <p className="vonn-text-cuerpo text-ink-muted">{item.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {item.price != null && (
                    <span className="vonn-text-subtitulo text-primary">
                      ${item.price.toLocaleString("es-AR")}
                    </span>
                  )}
                  {item.duration_minutes && (
                    <span className="vonn-text-caption text-ink-muted">
                      {item.duration_minutes} min
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Horarios + ubicación ---- */}
      {(content?.schedule && Object.keys(content.schedule).length > 0) || content?.address ? (
        <section className="px-6 py-16 max-w-3xl mx-auto grid gap-8 sm:grid-cols-2">
          {content?.schedule && Object.keys(content.schedule).length > 0 && (
            <div>
              <h3 className="vonn-text-subtitulo mb-3">Horarios</h3>
              <ul className="flex flex-col gap-1">
                {Object.entries(content.schedule).map(([day, hours]) => (
                  <li key={day} className="vonn-text-cuerpo text-ink-muted flex justify-between gap-4">
                    <span className="capitalize">{day.replace(/_/g, " ")}</span>
                    <span>{hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content?.address && (
            <div>
              <h3 className="vonn-text-subtitulo mb-3">Ubicación</h3>
              <p className="vonn-text-cuerpo text-ink-muted">{content.address}</p>
            </div>
          )}
        </section>
      ) : null}

      {/* ---- Contacto ---- */}
      <section className="px-6 py-16 bg-canvas-muted flex flex-col items-center gap-6">
        <h2 className="vonn-text-titulo text-center">Contactanos</h2>
        <ContactForm tenantId={tenant.id} />
      </section>

      <footer className="px-6 py-8 text-center">
        <p className="vonn-text-caption text-ink-muted">
          Sitio creado y mantenido por VONN
        </p>
      </footer>

      <WhatsappButton phone={content?.whatsapp_number ?? null} />
    </main>
  );
}
