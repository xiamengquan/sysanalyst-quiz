/**
 * 大纲编号与 API id 不一致时的兼容路由（如教程 15.1 → 运维指标考点）。
 * 用于 /kb/[id]/ 静态参数、sitemap 与 normalizeKbRouteId。
 */
export const KB_ROUTE_ALIASES: Record<string, string> = {
  "kp-13-1": "kp-运维指标-MTTR-MTBF-MTTF-MTTA",
};

export function resolveKbRouteAlias(routeId: string): string {
  const id = routeId.trim();
  return KB_ROUTE_ALIASES[id] ?? id;
}

export function kbRouteAliasIds(): string[] {
  return Object.keys(KB_ROUTE_ALIASES);
}
