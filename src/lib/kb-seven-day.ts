import { CH_NAMES } from "@/lib/types";

/**
 * 「四层七日背诵总册」D1–D7 与题库章节的映射。
 * 内容架构 v3：知识点系统以总册为学习主线，刷题/案例系统按日配题巩固。
 * 总册：/kb/quick-four-tier-7d/
 */
export type SevenDay = {
  id: "d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "d7";
  label: string;
  /** 当日主题（对齐总册标题） */
  theme: string;
  /** 题库章节（CH_NAMES 章号） */
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
    theme: "软件工程 · UML · OO",
    chapters: [7],
    focus: "过程模型、需求/设计常见混淆、UML 图适用场景",
    paper: false,
  },
  {
    id: "d2",
    label: "D2",
    theme: "需求工程 · 系统规划与分析",
    chapters: [11, 10],
    focus: "需求获取/分析/验证链条、可行性研究、数据流图",
    paper: false,
  },
  {
    id: "d3",
    label: "D3",
    theme: "软件架构 · Web · 微服务",
    chapters: [12, 16, 20],
    focus: "架构风格对比、质量属性、微服务拆分与治理",
    paper: false,
  },
  {
    id: "d4",
    label: "D4",
    theme: "数据库 · 实现与测试",
    chapters: [5, 14],
    focus: "范式与反范式、事务/并发、测试阶段与用例设计",
    paper: false,
  },
  {
    id: "d5",
    label: "D5",
    theme: "信息安全 · 项目管理计算",
    chapters: [9, 8],
    focus: "BLP/Biba 方向、密钥体系、挣值/关键路径计算",
    paper: false,
  },
  {
    id: "d6",
    label: "D6",
    theme: "计算机系统 · 网络 · 设计 · 运维",
    chapters: [3, 4, 13, 15],
    focus: "可靠性计算、协议分层、耦合内聚、运维度量",
    paper: false,
  },
  {
    id: "d7",
    label: "D7",
    theme: "企业信息化 · 论文 · 收尾",
    chapters: [6, 17, 18, 19, 21, 22, 0, 1, 2],
    focus: "信息化战略、新兴系统形态、论文结构要点、杂项收尾",
    paper: true,
  },
];

export function sevenDayById(id: string): SevenDay | undefined {
  return SEVEN_DAYS.find((d) => d.id === id);
}

export function sevenDayChapterLabel(day: SevenDay): string {
  return day.chapters.map((c) => `第${c}章${CH_NAMES[c] ?? ""}`).join("、");
}