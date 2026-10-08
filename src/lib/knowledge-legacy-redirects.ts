/**
 * 旧站 /knowledge/{n}（教程章序号）→ 本站 `/kb/{考点 id}/` 兼容跳转。
 * 映射规则：各教程章在 api-ref 索引中的首个考点（与 2026 外部审计 P2 对齐）。
 */
export const LEGACY_KNOWLEDGE_CHAPTER_TO_KP: Record<string, string> = {
  "1": "kp-英文阅读-领域术语",
  "2": "kp-企业法律制度-会计-财务成本-组织-HR-文化-IT-审计",
  "3": "kp-1-1",
  "4": "kp-2-1",
  "5": "kp-3-1",
  "6": "kp-4-1",
  "7": "kp-软件生命周期",
  "8": "kp-6-1",
  "9": "kp-7-1",
  "10": "kp-8-1",
  "11": "kp-9-1",
  "12": "kp-10-1",
  "13": "kp-11-1",
  "14": "kp-12-1",
  "15": "kp-运维指标-MTTR-MTBF-MTTF-MTTA",
  "16": "kp-1-1-2",
  "17": "kp-2-1-2",
  "18": "kp-3-1-2",
  "19": "kp-4-1-2",
  "20": "kp-5-1",
  "21": "kp-6-1-2",
  "22": "kp-注意事项-解答步骤-摘要正文-评分",
};

export function resolveLegacyKnowledgeTarget(rawId: string): string | null {
  const id = rawId.trim();
  if (!id) return null;
  const kp = LEGACY_KNOWLEDGE_CHAPTER_TO_KP[id];
  if (kp) return `/kb/${kp}/`;
  if (id.startsWith("kp-")) return `/kb/${id}/`;
  return null;
}
