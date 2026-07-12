import { api } from "./client";
import type { SiteConfigRaw } from "./types";

/** Mini-site config of the authenticated creator (identity from the JWT). */
export async function getSite(): Promise<SiteConfigRaw> {
  return api.get<SiteConfigRaw>("/users/me/site");
}

/** PUT replaces the whole mini-site config atomically — send the full object. */
export async function saveSite(config: SiteConfigRaw): Promise<SiteConfigRaw> {
  return api.put<SiteConfigRaw>("/users/me/site", config);
}
