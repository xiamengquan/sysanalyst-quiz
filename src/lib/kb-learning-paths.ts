import type { KbItem } from "@/lib/types";

/** 综合知识 / 案例 / 论文 三条主路径上的速查锚点 */
export const LEARNING_TRACKS = {
  choice: {
    id: "choice" as const,
    label: "综合知识",
    segments: [
      { quickId: "quick-req-learn", label: "需求与规划", chapters: [10, 11] },
      { quickId: "quick-uml-learn", label: "软件工程·OO", chapters: [7, 9] },
      { quickId: "quick-compare", label: "架构·设计", chapters: [12, 13] },
      { quickId: "quick-exam-7d", label: "考前 P0 背诵", chapters: [] },
    ],
  },
  case: {
    id: "case" as const,
    label: "案例分析",
    segments: [
      { quickId: "quick-req-five", label: "试题一·需求", chapters: [11] },
      { quickId: "quick-case-design", label: "系统设计类", chapters: [12, 13] },
      { quickId: "quick-case-predict-set2", label: "预测第二套", chapters: [] },
      { quickId: "quick-sao-learn", label: "DFD·结构化", chapters: [10, 11] },
    ],
  },
  essay: {
    id: "essay" as const,
    label: "论文",
    segments: [
      { quickId: "quick-essay-index", label: "论文方向索引", chapters: [22] },
      { quickId: "quick-compare", label: "架构对比", chapters: [12] },
      { quickId: "quick-web-agent-arch", label: "Web·新技术", chapters: [20] },
    ],
  },
};

export type LearningTrackId = keyof typeof LEARNING_TRACKS;

export function pickTrack(item: KbItem): LearningTrackId {
  if (item.kind === "quick") {
    const p = item.path || "";
    if (p.includes("论文")) return "essay";
    if (p.includes("案例") || p.includes("Checklist")) return "case";
  }
  if (item.group?.includes("论文") || item.chapter === 22) return "essay";
  if (item.chapter != null && [15, 16, 17, 18, 19, 20, 21].includes(item.chapter)) {
    return "case";
  }
  return "choice";
}

export function segmentsForTrack(track: LearningTrackId, chapter?: number) {
  return LEARNING_TRACKS[track].segments.map((seg) => ({
    ...seg,
    active: chapter != null && seg.chapters.includes(chapter),
  }));
}

export function learningPathSegments(item: KbItem) {
  return segmentsForTrack(pickTrack(item), item.chapter);
}
