import { api } from "./client";
import type { CheckUsernameRaw, PublicProfileRaw, UpdateUserBody, UserRaw } from "./types";

/** Profile of the authenticated user (identity from the session JWT). */
export async function getMe(): Promise<UserRaw> {
  return api.get<UserRaw>("/users/me");
}

export async function updateMe(body: UpdateUserBody): Promise<UserRaw> {
  return api.patch<UserRaw>("/users/me", body);
}

export async function checkUsername(username: string): Promise<boolean> {
  const res = await api.get<CheckUsernameRaw>("/users/check-username", { username });
  return res.available;
}

export async function getPublicProfile(username: string): Promise<PublicProfileRaw> {
  return api.get<PublicProfileRaw>(`/users/${username}/profile`);
}
