import slugCanonicalMap from "@/lib/kb-slug-canonical-map.json";

/** 大纲编号与历史 slug → 当前 canonical id（旧 URL 301/替换用） */
const LEGACY_ALIASES: Record<string, string> = {
  "kp-13-1": "kp-ops-metrics-mttr-mtbf-mttf-mtta",
};

export const KB_ROUTE_ALIASES: Record<string, string> = {
  ...LEGACY_ALIASES,
  ...(slugCanonicalMap as Record<string, string>),
};

export function resolveKbRouteAlias(routeId: string): string {
  const id = routeId.trim();
  return KB_ROUTE_ALIASES[id] ?? id;
}

export function kbRouteAliasIds(): string[] {
  return Object.keys(KB_ROUTE_ALIASES);
}

/** 解码后若与 canonical 不同，则应跳转到 canonical URL */
export function shouldCanonicalizeKbRoute(rawDecoded: string): string | null {
  const canonical = resolveKbRouteAlias(rawDecoded);
  return canonical !== rawDecoded ? canonical : null;
}
