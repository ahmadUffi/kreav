import { api } from "./client";
import { mapAnalytics } from "./mappers";
import type { AnalyticsRaw, AnalyticsView } from "./types";

/** Dashboard KPIs of the authenticated creator (identity from the JWT). */
export async function getAnalytics(): Promise<AnalyticsView> {
  return mapAnalytics(await api.get<AnalyticsRaw>("/analytics"));
}
