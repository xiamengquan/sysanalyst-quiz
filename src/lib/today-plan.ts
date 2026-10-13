/**
 * 考前 14 天 · 每日任务计划（结构化自《考前 14 天冲刺计划》§4/§5）
 * v3 · 案例核心三部曲（做→批→卡）+ 出题重心排题（试题一=需求铁律；选做池 Web 22 席＞需求/数据库各 12 席）
 * 综合知识 = 真题重复刷（午休 25' 块 + 周末整卷 + 隔天错题二刷）；碎片背诵（/audio 地铁 + /recall 工位）保留，晚主块不再排新背诵
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
export const TODAY_PLAN_VERSION = 3;

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
      { text: "案例整题独立计时 60'：2022上·案例一·博客系统（结构化 vs OO、用例建模、需求评审；加班日可半题 45'：读题标注+骨架+对答自评）", href: LINKS.caseById("ZT-2022上-案例01"), link: "案例整题" },
      { text: "错题回炉 20'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-13",
    weekday: "周二（20:30 起）",
    tag: "D3 · 三部曲切换日",
    main: [
      { text: "案例三部曲 · 卡阶段收口：2020上·案例五已做完批完（12/25），三张微卡（事件系统三部件「源-管-理」/ 外卖流程链 / 补图方法论）入 /recall 建档 + 口述复述 1 遍", href: LINKS.caseById("ZT-2020上-案例05"), link: "案例三部曲" },
      { text: "综合错题回炉（模考 6 条清单）：网络协议数字卡 / PV 顺序与 LRU 手算 / DB 三连 / 内聚七级与覆盖四级 / 数学三小点 / 法规年限", href: LINKS.recall, link: "随机问答" },
      { text: "总册 D3 背诵碎片化：架构风格对比表 + 质量属性不再占晚主块，交 /recall 到期卡 + 地铁 /audio 维护（明早工位 30′ 清债）", href: "/kb/quick-four-tier-7d/#d3", link: "总册 D3" },
    ],
  },
  {
    date: "2026-10-14",
    weekday: "周三（加班日 22:30 起）",
    tag: "三部曲 · Web 域 #1（论证）",
    main: [
      { text: "案例三部曲 · 半题 45'：做 20'（读题标注 + 限时作答）→ 批 15'（对照参考逐点打分，错因分三类：关键词错 / 结构漏 / 知识缺）→ 卡 10'（一问一卡挂 D3）——2025下·案例四·气象系统（Web·技术方案论证：前后端分离 + MVP/MVVM + 微服务演进，选择题不吃图）", href: LINKS.caseById("ZT-2025下-案例04"), link: "案例三部曲" },
      { text: "综合真题重刷 40'：昨午错题二刷清零 + 次场次推进（只碰真题，不碰模拟题）", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10'：事件系统三部件「源-管-理」+ 昨日全部微卡口述", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-15",
    weekday: "周四（20:30 起）",
    tag: "三部曲 · 数据库域 #1（诊断）",
    main: [
      { text: "案例三部曲 · 整题 60'：做 30'（读题标注 5' + 限时作答 25'，骨架先行不翻书）→ 批 15'（逐空/逐点打分，标错因）→ 卡 15'（一问一卡挂 D4）——2025下·案例二·电商大促 Redis 缓存（数据库·问题诊断三问：穿透/击穿/雪崩对策）", href: LINKS.caseById("ZT-2025下-案例02"), link: "案例三部曲" },
      { text: "综合真题重刷 45'：错题隔天二刷 + 新场次推进", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10' + 挣值公式卡碎片维护", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-16",
    weekday: "周五（20:30 起）",
    tag: "三部曲 · Web 域 #2（建模）",
    main: [
      { text: "案例三部曲 · 整题 60'：做 30' → 批 15' → 卡 15'——2026上·案例二·书房预约系统（Web·建模与设计：用例/类图补全 + 流程建模；Web·建模与设计 10 席为全池单一最大重心格子）", href: LINKS.caseById("ZT-2026上-案例02"), link: "案例三部曲" },
      { text: "综合真题重刷 45'（周末整卷前清当日错题）", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10'：缓存三问题 + Web 建模链口述；项管 PERT/关键路径让位真题回炉（项管案例仅 1 席，非重心）", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-17",
    weekday: "周六",
    tag: "综合真题第 1 场 + 案例微卡总复述",
    main: [
      { text: "上午：案例微卡总复述（全部一问一卡连口述）+ /recall 到期卡清债（碎片背诵主战场）", href: LINKS.recall, link: "随机问答" },
      { text: "下午 14:00：综合真题第 1 场整卷计时 150'（对齐考试状态）+ 当场对答案批分", href: "/real-exams/", link: "真题成卷" },
      { text: "晚上：真题第 1 场错题逐题标注（进午休重刷池）+ 微卡复述；不做新案例题，护状态", href: "/real-exams/", link: "真题成卷" },
    ],
  },
  {
    date: "2026-10-18",
    weekday: "周日",
    tag: "论文定型 + 案例全真（重心整卷）",
    main: [
      { text: "上午：论文 2 个主打方向定型 + 素材卡固化（近五年范围分析）；总册 D6/D7 背诵碎片化交 /recall 维护", href: "/kb/quick-essay/", link: "论文范围" },
      { text: "下午：案例全真 1 场三部曲 90'：做 65'（2026上整卷：试题一需求必答 + Web/数据库四选二，计时骨架先行）→ 批 15' → 卡 10'", href: LINKS.caseById("ZT-2026上-案例01"), link: "案例全真" },
      { text: "晚上：论文限时第 1 篇（90 分钟完稿，用上午定型方向）+ 自评：背景→选型→过程→度量→总结", href: LINKS.essay, link: "论文框架" },
      { text: "睡前：微卡清账 + 第 1 篇自评问题记入清单（第 2、3 篇针对性重练）", href: LINKS.caseStart, link: "微卡复盘" },
    ],
  },
  {
    date: "2026-10-19",
    weekday: "周一（加班日 22:30 起）",
    tag: "三部曲 · 需求域回补（论证）",
    main: [
      { text: "案例三部曲 · 半题 45'：做 20' → 批 15' → 卡 10'——2021上·案例一·在线运动器材销售（需求·技术方案论证：FAST 开发方式论证；试题一风向回补——「识别与确认」三连后防轮换）", href: LINKS.caseById("ZT-2021上-案例01"), link: "案例三部曲" },
      { text: "综合真题第 1 场错题隔天二刷（P0 章优先）+ 重刷池清零", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10'（含周末全部新卡）", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-20",
    weekday: "周二（20:30 起）",
    tag: "三部曲 · 数据库域 #2（建模）",
    main: [
      { text: "案例三部曲 · 整题 60'：做 30' → 批 15' → 卡 15'——2026上·案例四·政务大厅排队叫号升级（数据库·建模与设计：ER/关系模式/规范化小问）", href: LINKS.caseById("ZT-2026上-案例04"), link: "案例三部曲" },
      { text: "综合真题重刷 45'：错题三轮清零 + 新场次推进", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-21",
    weekday: "周三（加班日 22:30 起）",
    tag: "三部曲 · Web 域 #3（建模）",
    main: [
      { text: "案例三部曲 · 半题 45'：做 20' → 批 15' → 卡 10'——2023上·案例一·软件系统分析与建模（Web·建模与设计；补 2023 风向）", href: LINKS.caseById("ZT-2023上-案例01"), link: "案例三部曲" },
      { text: "综合真题重刷 40'：剩余错题 + 高频错因卡清零", href: "/real-exams/", link: "真题成卷" },
      { text: "微卡复述 10'", href: LINKS.recall, link: "随机问答" },
    ],
  },
  {
    date: "2026-10-22",
    weekday: "周四（20:30 起）",
    tag: "论文第 2 篇 + 真题收口",
    main: [
      { text: "论文限时第 2 篇（90 分钟完稿 + 自评；针对第 1 篇自评问题重练对应段落）", href: LINKS.essay, link: "论文框架" },
      { text: "综合真题重刷 30'：错题末轮 + 素材卡口述（主打方向 2 素材）", href: "/real-exams/", link: "真题成卷" },
      { text: "案例微卡复述（只复盘不写新题，论文让位）", href: LINKS.caseStart, link: "启动手册" },
    ],
  },
  {
    date: "2026-10-23",
    weekday: "周五（20:30 起）",
    tag: "论文第 3 篇 + 案例总复述",
    main: [
      { text: "论文限时第 3 篇（90 分钟完稿 + 自评）", href: LINKS.essay, link: "论文框架" },
      { text: "案例微卡总复述 + 启动句式表重背（全部一问一卡连复述，只复盘不写新题）", href: LINKS.caseStart, link: "启动手册" },
      { text: "综合真题错题最后一轮 + 高频对比速查表过一遍", href: "/kb/quick-compare/", link: "对比速查" },
    ],
  },
  {
    date: "2026-10-24",
    weekday: "周六",
    tag: "考前收口",
    main: [
      { text: "上午：考前 7 天背诵清单全过 + /recall 筛「必会 M」全刷", href: LINKS.exam7d, link: "考前清单" },
      { text: "下午：综合真题第 2 场整卷计时 150'（考前状态测试；选已刷过 1 遍的场次，验熟悉度增量——真题复用真实存在，重刷 = 可能直接撞原题）", href: "/real-exams/", link: "真题成卷" },
      { text: "晚上：微卡最后一遍 + 启动句式默背 + 早睡（不做任何新题）", href: LINKS.caseStart, link: "微卡复盘" },
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

/** 午休综合真题块主题（按天，v3 重心版：真题重复刷提熟悉度） */
const LUNCH_TOPIC: Record<string, { text: string; href?: string; link?: string }> = {
  "2026-10-11": { text: "案例微训练第 1 题：2025下·案例一·需求识别与确认（并入今日全天主线，五步完整闭环）", href: LINKS.caseById("ZT-2025下-案例01"), link: "微训练第 1 题" },
  "2026-10-12": { text: "运用演练《需求工程步骤链》：每格先写作用句再对答案（剩余时间 d2 配题）", href: LINKS.drill("需求工程步骤链"), link: "运用演练" },
  "2026-10-13": { text: "真题 25 题限时块：模考错 19 题对应考点回扫（网络数字卡/PV-LRU/DB 三连/内聚覆盖/数学/法规），错题标注入晚块重刷池", href: "/real-exams/", link: "真题成卷" },
  "2026-10-14": { text: "真题 25 题限时块：新场次推进 + 错题即时标注（不碰模拟题）", href: "/real-exams/", link: "真题成卷" },
  "2026-10-15": { text: "真题 25 题限时块：新场次推进 + 昨日错题带看", href: "/real-exams/", link: "真题成卷" },
  "2026-10-16": { text: "真题 25 题限时块：周末整卷前最后一个推进块", href: "/real-exams/", link: "真题成卷" },
  "2026-10-17": { text: "微卡复述（周六午休并入主线；整卷在下午 14:00）", href: LINKS.caseStart, link: "启动手册" },
  "2026-10-18": { text: "微卡复述（案例全真在下午主线）", href: LINKS.caseStart, link: "启动手册" },
  "2026-10-19": { text: "真题 25 题限时块：第 1 场整卷错题二刷（P0 章优先）", href: "/real-exams/", link: "真题成卷" },
  "2026-10-20": { text: "真题 25 题限时块：新场次推进 + 连错考点标记", href: "/real-exams/", link: "真题成卷" },
  "2026-10-21": { text: "真题 25 题限时块：剩余错题末刷 + 连错两日考点写进考前 7 天清单", href: "/real-exams/", link: "真题成卷" },
  "2026-10-22": { text: "真题错题 20 分钟：连错考点终刷（剩余时间论文素材口述预热第 2 篇）", href: "/real-exams/", link: "真题成卷" },
  "2026-10-23": { text: "真题错题最后一轮（剩余时间论文素材口述预热第 3 篇）", href: "/real-exams/", link: "真题成卷" },
  "2026-10-24": { text: "启动句式表重背（只复盘不做新题）", href: LINKS.caseStart, link: "启动手册" },
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
  add("lunch", `综合真题（30'）：${lt.text}`, lt.href, lt.link);
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
  add("lunch", "综合真题（30'）：25 题限时块 + 错题即时标注（真题重复刷提熟悉度）", "/real-exams/", "真题成卷");
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