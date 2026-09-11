export const CH_NAMES: Record<number, string> = {
  0: "综合与法规杂项",
  1: "绪论",
  2: "数学与工程基础",
  3: "计算机系统",
  4: "计算机网络与分布式系统",
  5: "数据库系统",
  6: "企业信息化",
  7: "软件工程",
  8: "项目管理",
  9: "信息安全",
  10: "系统规划与分析",
  11: "软件需求工程",
  12: "软件架构设计",
  13: "系统设计",
  14: "软件实现与测试",
  15: "系统运行与维护",
  16: "Web应用",
  17: "嵌入式系统",
  18: "移动应用",
  19: "大数据",
  20: "微服务",
  21: "信息物理系统CPS",
  22: "论文与文档",
};

export type Question = {
  no: number;
  ch: number;
  point: string;
  stem: string;
  opts: Record<string, string>;
  ans: string;
  exp: string;
  diff: string;
  bank: string;
  source?: string;
  year?: string;
  id?: string;
  origin_chapter?: number;
  audience?: string[];
  math_level?: string;
  intensity?: "boost" | "stable" | string;
  style_track?: string;
};

export type CaseItem = {
  no: number;
  id: string;
  chapter: number;
  domain: string;
  case_type: string;
  point: string;
  track?: "P0" | "P1" | "P2" | string;
  stop_loss?: boolean;
  depth?: string;
  stem: string;
  questions: {
    qnum: number;
    prompt: string;
    answer_type?: string;
    word_limit?: number;
    rubric?: { must_hit?: string[]; sample?: string };
    hint?: string;
  }[];
  source?: string;
  time_limit_min?: number;
};

export type CasePack = {
  id: string;
  title: string;
  rule?: string;
  mandatory?: number;
  elective?: number[];
  select_hint?: string;
  cases: string[];
};

export type KbItem = {
  id: string;
  title: string;
  path: string;
  status?: string;
  kind?: string;
  chapter?: number;
  note?: string;
};

export type KbIndex = {
  meta?: Record<string, string>;
  sections: { id: string; title: string; items: KbItem[] }[];
};
