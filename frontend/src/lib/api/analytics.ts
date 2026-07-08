import { api } from "./client";
import { mapAnalytics } from "./mappers";
import type { AnalyticsRaw, AnalyticsView } from "./types";

export async function getAnalytics(creatorId: string): Promise<AnalyticsView> {
  return mapAnalytics(await api.get<AnalyticsRaw>("/analytics", { creatorId }));
}
