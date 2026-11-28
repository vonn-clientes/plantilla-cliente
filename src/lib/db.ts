import "server-only";
import { neon } from "@neondatabase/serverless";

// Inicialización diferida: importar este módulo no requiere DATABASE_URL.
// El texto SQL es estático; todos los valores van en params ($1, $2, ...).
export function sql(text: string, params: unknown[] = []) {
  return neon(process.env.DATABASE_URL!).query(text, params);
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql(text, params)) as T[];
}

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}
