// Sin base configurada, el sitio público conserva los datos de demo.
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
