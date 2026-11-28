"use server";

import { queryOne } from "@/lib/db";
import { isDbConfigured } from "@/lib/config";
import { closeSession, createSession, verifyPassword } from "@/lib/session";
import { redirect } from "next/navigation";

export type LoginState = { error: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const error = "Email o contraseña incorrectos";
  if (!isDbConfigured()) return { error };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  try {
    const user = await queryOne<{ id: string; password_hash: string }>(
      "select id, password_hash from app_users where email = $1", [email],
    );
    if (!user || !(await verifyPassword(password, user.password_hash))) return { error };
    await createSession(user.id);
  } catch {
    return { error };
  }
  redirect("/panel");
}

export async function logout() {
  await closeSession();
  redirect("/panel/login");
}
