import { CH_NAMES } from "@/lib/types";

/**
 * 「四层七日背诵总册」D1–D7 与考点章节的映射。
 * 内容架构 v3：知识点系统以总册为学习主线，考点精炼按日巩固。
 * 总册：/kb/quick-four-tier-7d/
 */
export type SevenDay = {
  id: "d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "d7";
  label: string;
  /** 当日主题（对齐总册标题） */
  theme: string;
  /** 考点章节（CH_NAMES 章号） */
  chapters: number[];
  /** 当日主打考点（一句速览，用于卡片副标题） */
  focus: string;
  /** 是否含论文自测（ch22） */
  paper: boolean;
};

export const SEVEN_DAYS: SevenDay[] = [
  {
    id: "d1",
    label: "D1",
    theme: "其余模块精华 · 软工 UML OO",
    chapters: [7],
    focus: "开发模型选型口诀、CMM/CMMI、UML 关系强弱与十图、OO 三特性",
    paper: false,
  },
  {
    id: "d2",
    label: "D2",
    theme: "需求工程（四大方面 · 一）",
    chapters: [11, 10],
    focus: "需求三层、获取五法选型、DFD 与用例、SRS、验证评审、CCB 变更",
    paper: false,
  },
  {
    id: "d3",
    label: "D3",
    theme: "Web + 微服务（四大方面 · 二/三）",
    chapters: [12, 16, 20],
    focus: "前后端分离、MVC-MVVM 判据、缓存三问题、治理四保护、事件三部件",
    paper: false,
  },
  {
    id: "d4",
    label: "D4",
    theme: "数据库（四大方面 · 四）",
    chapters: [5, 14],
    focus: "ER 转化、范式判定、三读与隔离级别、封锁死锁、CAP 分库分表",
    paper: false,
  },
  {
    id: "d5",
    label: "D5",
    theme: "其余模块精华 · 安全 + 项管计算",
    chapters: [9, 8],
    focus: "BLP/Biba 方向、加密三兄弟与签名、挣值四公式、PERT 期望",
    paper: false,
  },
  {
    id: "d6",
    label: "D6",
    theme: "其余模块精华 · 计组网络 + 架构 + 设计运维",
    chapters: [3, 4, 13, 15],
    focus: "PV 操作、Cache 均访、耦合内聚、设计模式三类、五大风格族、V 模型测试",
    paper: false,
  },
  {
    id: "d7",
    label: "D7",
    theme: "其余模块精华 · 企信 + 论文 + 收尾",
    chapters: [6, 17, 18, 19, 21, 22, 0, 1, 2],
    focus: "SCM 五环节、EAI 三层、规划三法与可行性、案例 7 步法、论文摘要四句式",
    paper: true,
  },
];

export function sevenDayById(id: string): SevenDay | undefined {
  return SEVEN_DAYS.find((d) => d.id === id);
}

export function sevenDayChapterLabel(day: SevenDay): string {
  return day.chapters.map((c) => `第${c}章${CH_NAMES[c] ?? ""}`).join("、");
}