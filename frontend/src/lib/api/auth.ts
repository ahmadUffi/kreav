import { api } from "./client";
import type { AuthUserRaw, RegisterBody } from "./types";

export async function register(body: RegisterBody): Promise<AuthUserRaw> {
  return api.post<AuthUserRaw>("/auth/register", body);
}
