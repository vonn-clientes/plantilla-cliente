# Migración a Cloudflare Workers

Worker: `plantilla-web` (OpenNext). Build: `npx opennextjs-cloudflare build`. Deploy: `npx wrangler deploy`.

En la rama local `neon`, la base usa `DATABASE_URL` solo en servidor/runtime.
El build no necesita credenciales y el sitio público conserva el modo demo.
Ver [NEON_NOTAS.md](NEON_NOTAS.md) para el SQL adicional y la autenticación propia.

Estado: rama de prueba, sin merge a main. No se modificaron servicios externos
ni se ejecutaron comandos de deploy. `package-lock.json` permanece sin versionar.
