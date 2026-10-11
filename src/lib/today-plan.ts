/**
 * 考前 14 天 · 每日任务计划（结构化自《考前 14 天冲刺计划》§4/§5）
 * 数据与内容文档手工对齐；修改任务请同步 content/kb/速查/考前14天冲刺计划.md
 */

export type Slot = "metroAm" | "desk" | "lunch" | "metroPm" | "main";

export const SLOT_META: Record<Slot, { label: string; time: string }> = {
  metroAm: { label: "🚇 地铁 · 早", time: "通勤（洗脑音频）" },
  desk: { label: "🪑 工位", time: "8:30–9:00" },
  lunch: { label: "🍚 午休", time: "30 分钟" },
  metroPm: { label: "🚇 地铁 · 晚", time: "通勤（洗脑音频）" },
  main: { label: "🌙 主块", time: "晚间 / 整块" },
};

export type Task = {
  id: string;
  slot: Slot;
  text: string;
  href?: string;
  link?: string;
};

export type DayPlan = {
  date: string; // YYYY-MM-DD
  weekday: string;
  tag: string; // 总册日次 / 阶段标签
  main: Omit<Task, "slot" | "id">[];
};

/** 冲刺窗口：以 2026-10-25（周日）考试计 */
export const SPRINT_START = "2026-10-11";
export const SPRINT_END = "2026-10-24";
export const EXAM_DATE = "2026-10-25";
export const TODAY_PLAN_VERSION = 1;

const LINKS = {
  audio: "/audio/",
  recall: "/recall/",
  drill: (id: string) => `/drill/?deck=${encodeURIComponent(id)}`,
  sprint: "/kb/quick-sprint-14d/",
  caseStart: "/kb/quick-case-start/",
  exam7d: "/kb/quick-exam-7d/",
  compare: "/kb/quick-compare/",
  essay: "/kb/quick-essay/",
  caseReal: "/case/?bank=real",
  caseReq: "/case/?bank=real&domain=%E9%9C%80%E6%B1%82",
  caseById: (id: string) => `/case/?id=${encodeURIComponent(id)}`,
  caseArch: "/case/?domain=%E6%9E%B6%E6%9E%84",
  caseDb: "/case/?domain=%E6%95%B0%E6%8D%AE%E5%BA%93",
  caseMicro: "/case/?domain=%E5%BE%AE%E6%9C%8D%E5%8A%A1",
  seven: (d: string) => `/?path=seven_day&day=${d}`,
};

const DAYS: DayPlan[] = [
  {
    date: "2026-10-11",
    weekday: "周日",
    tag: "D1 · 软工·UML·OO",
    main: [
      { text: "总册 D1 全过：M 卡逐张默写 + K 辨析 + UML 指南 L1–L3", href: "/kb/quick-four-tier-7d/#d1", link: "总册 D1" },
      { text: "通读《案例作答启动手册》：启动句式表 + 骨架先行", href: "/kb/quick-case-start/", link: "启动手册" },
      { text: "案例微训练第 1 题：2025下·案例一·需求识别与确认（需求获取方法选型，五步完整闭环）", href: LINKS.caseById("ZT-2025下-案例01"), link: "微训练第 1 题" },
      { text: "七日巩固 d1 配题 + 错题回炉", href: LINKS.seven("d1"), link: "d1 配题" },
      { text: "D2 预习：需求获取/分析/验证链条 + DFD 概念", href: LINKS.seven("d2"), link: "D2 预览" },
      { text: "/recall 首轮建档（D1 卡）+ /audio 选发音人、调语速", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-12",
    weekday: "周一（加班日 22:30 起）",
    tag: "D2 · 需求·规划",
    main: [
      { text: "总册 D2 背诵：M 卡默写 + 需求链条 K 辨析（40'）", href: "/kb/quick-four-tier-7d/#d2", link: "总册 D2" },
      { text: "七日巩固 d2 配题（35'）", href: LINKS.seven("d2"), link: "d2 配题" },
    ],
  },
  {
    date: "2026-10-13",
    weekday: "周二（20:30 起）",
    tag: "D3 上 · 架构",
    main: [
      { text: "总册 D3 背诵：架构风格对比表 + 质量属性（60'）", href: "/kb/quick-four-tier-7d/#d3", link: "总册 D3" },
      { text: "架构 12 章配题（d3 前半）", href: LINKS.seven("d3"), link: "d3 配题" },
      { text: "错题回炉 30'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-14",
    weekday: "周三（加班日 22:30 起）",
    tag: "D3 下 · Web·微服务",
    main: [
      { text: "Web 16 + 微服务 20 章配题（d3 后半，题量最大段）", href: LINKS.seven("d3"), link: "d3 配题" },
      { text: "案例微卡复述（昨日骨架对照的漏点）", href: "/kb/quick-case-start/", link: "启动手册" },
    ],
  },
  {
    date: "2026-10-15",
    weekday: "周四（20:30 起）",
    tag: "D4 · 数据库·测试",
    main: [
      { text: "总册 D4 背诵：范式/事务并发/测试阶段（60'）", href: "/kb/quick-four-tier-7d/#d4", link: "总册 D4" },
      { text: "d4 配题 + 挣值公式卡过一遍", href: LINKS.seven("d4"), link: "d4 配题" },
      { text: "错题回炉 30'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-16",
    weekday: "周五（20:30 起）",
    tag: "D5 · 安全·项管",
    main: [
      { text: "总册 D5 背诵：BLP/Biba、密钥体系、项管计算（60'）", href: "/kb/quick-four-tier-7d/#d5", link: "总册 D5" },
      { text: "d5 配题 + 关键路径手算 5 题", href: LINKS.seven("d5"), link: "d5 配题" },
      { text: "错题回炉 30'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-17",
    weekday: "周六",
    tag: "D6 · 计组·网络·设计·运维 + 真题首场",
    main: [
      { text: "上午：总册 D6 背诵 + 配题", href: "/kb/quick-four-tier-7d/#d6", link: "总册 D6" },
      { text: "下午：综合真题第 1 场（计时 150 分钟，对齐考试状态）", href: "/real-exams/", link: "真题成卷" },
      { text: "晚上：真题复盘 + 微卡清账 + 错题回炉", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-18",
    weekday: "周日",
    tag: "D7 · 企信·论文 + 案例全真",
    main: [
      { text: "上午：总册 D7 背诵 + 论文 2 个主打方向定型（近五年范围分析）", href: "/kb/quick-essay/", link: "论文范围" },
      { text: "下午：案例全真 1 场（计时 90 分钟，骨架先行）+ 启动手册复盘", href: LINKS.caseReal, link: "案例真题" },
      { text: "晚上：微卡清账 + 明日真题预告", href: LINKS.caseStart, link: "启动手册" },
    ],
  },
  {
    date: "2026-10-19",
    weekday: "周一（加班日 22:30 起）",
    tag: "实卷 · 错题回炉",
    main: [
      { text: "综合真题第 1 场错题逐题回炉（P0 章优先）", href: "/real-exams/", link: "真题成卷" },
    ],
  },
  {
    date: "2026-10-20",
    weekday: "周二（20:30 起）",
    tag: "实卷 · 定向刷题",
    main: [
      { text: "P0 章薄弱点定向刷题（错题本驱动）", href: "/?bank=practice&path=all", link: "刷题" },
      { text: "案例真题小问 2 题：需求 + 建模（骨架先行）", href: LINKS.caseReq, link: "案例真题" },
    ],
  },
  {
    date: "2026-10-21",
    weekday: "周三（加班日 22:30 起）",
    tag: "实卷 · 错题续清",
    main: [
      { text: "真题剩余错题回炉 + 微卡清账", href: "/real-exams/", link: "真题成卷" },
      { text: "案例微服务/Web 小问 1 题", href: LINKS.caseMicro, link: "案例真题" },
    ],
  },
  {
    date: "2026-10-22",
    weekday: "周四（20:30 起）",
    tag: "论文周 · 第 1 篇",
    main: [
      { text: "论文限时第 1 篇（90 分钟完稿 + 自评：背景→选型→过程→度量→总结）", href: LINKS.essay, link: "论文框架" },
      { text: "素材卡背诵 45'（主打方向 1 素材）", href: LINKS.essay, link: "论文素材" },
    ],
  },
  {
    date: "2026-10-23",
    weekday: "周五（20:30 起）",
    tag: "论文周 · 第 2 篇",
    main: [
      { text: "错题清零 + 高频对比速查表过一遍", href: "/kb/quick-compare/", link: "对比速查" },
      { text: "论文限时第 2 篇（90 分钟完稿 + 自评）", href: LINKS.essay, link: "论文框架" },
    ],
  },
  {
    date: "2026-10-24",
    weekday: "周六",
    tag: "考前收口",
    main: [
      { text: "上午：考前 7 天背诵清单全过 + /recall 筛「必会 M」全刷", href: LINKS.exam7d, link: "考前清单" },
      { text: "下午：综合真题第 2 场（计时 150 分钟，考前状态测试）", href: "/real-exams/", link: "真题成卷" },
      { text: "晚上：微卡最后一遍 + 早睡（不做新题）", href: LINKS.caseStart, link: "微卡复盘" },
    ],
  },
  {
    date: "2026-10-25",
    weekday: "周日",
    tag: "考试日",
    main: [
      { text: "考前清单 P0 早读 + /audio 洗脑式轻听（放松节奏）", href: LINKS.exam7d, link: "考前清单" },
      { text: "带齐证件文具，提前 40 分钟到场；案例先写骨架，任何小问不交白卷", href: LINKS.caseStart, link: "启动手册" },
    ],
  },
];

/** 午休案例骨架主题（按天） */
const LUNCH_TOPIC: Record<string, { text: string; href?: string; link?: string }> = {
  "2026-10-11": { text: "案例微训练第 1 题：2025下·案例一·需求识别与确认（并入今日全天主线，五步完整闭环）", href: LINKS.caseById("ZT-2025下-案例01"), link: "微训练第 1 题" },
  "2026-10-12": { text: "运用演练《需求工程步骤链》：每格先写作用句再对答案（剩余时间做需求获取骨架）", href: LINKS.drill("需求工程步骤链"), link: "运用演练" },
  "2026-10-13": { text: "架构域小问：读题标注 + 计时骨架", href: LINKS.caseArch, link: "案例真题" },
  "2026-10-14": { text: "微服务/Web 小问：读题标注 + 计时骨架", href: LINKS.caseMicro, link: "案例真题" },
  "2026-10-15": { text: "运用演练《数据库设计步骤链》：六格默写每步产出（剩余时间做数据库骨架）", href: LINKS.drill("数据库设计步骤链"), link: "运用演练" },
  "2026-10-16": { text: "问题诊断小问：管理/技术/过程/人员四维扫骨架", href: LINKS.caseReal, link: "案例真题" },
  "2026-10-17": { text: "微卡复述（周六午休并入主线，可只复述不写新骨架）", href: LINKS.caseStart, link: "启动手册" },
  "2026-10-18": { text: "微卡复述（案例全真在下午主线）", href: LINKS.caseStart, link: "启动手册" },
  "2026-10-19": { text: "需求类骨架：真题错题暴露的框架重练", href: LINKS.caseReq, link: "案例真题" },
  "2026-10-20": { text: "运用演练《UML 建模步骤链》：六图逐格默写作用与差异（DFD 补全手画 5 分钟并入）", href: LINKS.drill("UML-建模步骤链"), link: "运用演练" },
  "2026-10-21": { text: "微服务/Web 骨架：微卡连漏点定向练", href: LINKS.caseMicro, link: "案例真题" },
  "2026-10-22": { text: "论文素材口述 1 遍（主块写第 1 篇前的预热）", href: LINKS.essay, link: "论文框架" },
  "2026-10-23": { text: "论文素材口述 1 遍（第 2 篇预热）", href: LINKS.essay, link: "论文框架" },
  "2026-10-24": { text: "启动句式表重背（只复盘不写新题）", href: LINKS.caseStart, link: "启动手册" },
  "2026-10-25": { text: "考场启动句式默背 1 遍", href: LINKS.caseStart, link: "启动手册" },
};

export type TodayTasks = { groups: { slot: Slot; tasks: Task[] }[]; plan: DayPlan };

/** 生成某日完整任务（固定碎片三件套 + 当日主线） */
export function buildTodayTasks(dateKey: string): TodayTasks | null {
  const plan = DAYS.find((d) => d.date === dateKey);
  if (!plan) return null;
  const tasks: Task[] = [];
  let n = 0;
  const add = (slot: Slot, text: string, href?: string, link?: string) =>
    tasks.push({ id: `${dateKey}-${++n}`, slot, text, href, link });

  add("metroAm", "《洗脑音频》问答式播放昨日卡（听题默答，检验昨晚所学）", LINKS.audio, "洗脑音频");
  add("desk", "《随机问答》到期卡清债（间隔排程自动只给快忘的）", LINKS.recall, "随机问答");
  const lt = LUNCH_TOPIC[dateKey];
  add("lunch", `案例骨架（30'）：${lt.text}`, lt.href, lt.link);
  add("metroPm", "《洗脑音频》洗脑式播放当日新卡 ×3（下班路上完成编码）", LINKS.audio, "洗脑音频");
  for (const m of plan.main) add("main", m.text, m.href, m.link);

  const order: Slot[] = ["metroAm", "desk", "lunch", "metroPm", "main"];
  return {
    plan,
    groups: order
      .map((slot) => ({ slot, tasks: tasks.filter((t) => t.slot === slot) }))
      .filter((g) => g.tasks.length > 0),
  };
}

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 日期平移（按本地日历日，正数往后） */
export function shiftDate(dateKeyStr: string, deltaDays: number): string {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + deltaDays));
}

/** 冲刺窗口内全部日计划（总览用，按日期升序；sprintDay 从 1 起，末位为考试日） */
export function planRoster(): { date: string; weekday: string; tag: string; sprintDay: number }[] {
  return DAYS.map((d, i) => ({ date: d.date, weekday: d.weekday, tag: d.tag, sprintDay: i + 1 }));
}

export function sprintDayNumber(dateKeyStr: string): number {
  const idx = DAYS.findIndex((d) => d.date === dateKeyStr);
  return idx >= 0 ? idx + 1 : 0;
}

export function daysUntilExam(dateKeyStr: string): number {
  const [y, m, dd] = EXAM_DATE.split("-").map(Number);
  const [yy, mm, d3] = dateKeyStr.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(yy, mm - 1, d3)) / 86_400_000);
}

export const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 范围外兜底：通用模板任务（按星期轮转总册日次） */
export function buildFallbackTasks(dateKeyStr: string): TodayTasks {
  const plan: DayPlan = {
    date: dateKeyStr,
    weekday: WEEKDAY_CN[new Date().getDay()],
    tag: "冲刺窗口外 · 通用模板",
    main: [
      { text: "总册当日日次背诵（按星期轮转 D1–D7）", href: "/kb/quick-four-tier-7d/", link: "四层总册" },
      { text: "七日巩固当日配题", href: LINKS.seven(`d${((new Date().getDay() || 7) % 7) + 1}`), link: "七日巩固" },
      { text: "案例微训练 1 小问（骨架先行）", href: LINKS.caseReal, link: "案例真题" },
    ],
  };
  const tasks: Task[] = [];
  let n = 0;
  const add = (slot: Slot, text: string, href?: string, link?: string) =>
    tasks.push({ id: `${dateKeyStr}-${++n}`, slot, text, href, link });
  add("metroAm", "《洗脑音频》问答式播放到期卡", LINKS.audio, "洗脑音频");
  add("desk", "《随机问答》到期卡", LINKS.recall, "随机问答");
  add("lunch", "案例骨架（30'）：任选 1 小问，读题标注 + 计时骨架；或走 /drill 一条步骤链", LINKS.drill("需求工程步骤链"), "运用演练");
  add("metroPm", "《洗脑音频》洗脑式循环 ×3", LINKS.audio, "洗脑音频");
  for (const m of plan.main) add("main", m.text, m.href, m.link);
  const order: Slot[] = ["metroAm", "desk", "lunch", "metroPm", "main"];
  return {
    plan,
    groups: order
      .map((slot) => ({ slot, tasks: tasks.filter((t) => t.slot === slot) }))
      .filter((g) => g.tasks.length > 0),
  };
}