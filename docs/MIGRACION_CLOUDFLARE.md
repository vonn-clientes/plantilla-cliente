# Migración a Cloudflare Workers

Worker: `plantilla-web` (OpenNext). Build: `npx opennextjs-cloudflare build`. Deploy: `npx wrangler deploy`.

Variables de build (Cloudflare): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
Secretos de runtime: SUPABASE_SERVICE_ROLE_KEY (por Terminal, nunca en el repo).

Estado: rama de prueba, sin merge a main. Vercel sigue sirviendo la plantilla. Antes de main: regenerar package-lock.json.
