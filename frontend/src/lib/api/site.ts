import { api } from "./client";
import type { SiteConfigRaw } from "./types";

export async function getSite(userId: string): Promise<SiteConfigRaw> {
  return api.get<SiteConfigRaw>("/users/me/site", { userId });
}

/** PUT replaces the whole mini-site config atomically — send the full object. */
export async function saveSite(userId: string, config: SiteConfigRaw): Promise<SiteConfigRaw> {
  return api.put<SiteConfigRaw>("/users/me/site", config, { userId });
}
