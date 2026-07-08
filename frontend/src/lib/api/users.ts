import { api } from "./client";
import type { CheckUsernameRaw, PublicProfileRaw, UpdateUserBody, UserRaw } from "./types";

export async function getMe(userId: string): Promise<UserRaw> {
  return api.get<UserRaw>("/users/me", { userId });
}

export async function updateMe(userId: string, body: UpdateUserBody): Promise<UserRaw> {
  return api.patch<UserRaw>("/users/me", body, { userId });
}

export async function checkUsername(username: string): Promise<boolean> {
  const res = await api.get<CheckUsernameRaw>("/users/check-username", { username });
  return res.available;
}

export async function getPublicProfile(username: string): Promise<PublicProfileRaw> {
  return api.get<PublicProfileRaw>(`/users/${username}/profile`);
}
