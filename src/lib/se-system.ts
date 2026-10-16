/**
 * 系统工程总控台 · 状态聚合器（se = systems engineering）
 *
 * 把散在各执行舱的进度（track / recall / today 勾选 / case 草稿）聚合成统一的「系统状态」，
 * 按系统工程五层组织：
 *  1. 使命层：考期倒计时 + 冲刺日次
 *  2. 分解层：39 个案例知识点 = 39 个配置项，各带状态机（new/drilling/risky/mastered）
 *  3. 基线层：每日计划（today-plan）为进度基线，勾选为实际执行，对比即偏差
 *  4. 控制层：风险登记册 = 薄弱点排行（wrong 降序 × 错误率）+ 纠偏动作直达
 *  5. 反馈层：背诵闭环 = /recall 盒级分布 + 到期卡
 */

import { storageGet } from "@/lib/storage";
import {
  RECALL_STORAGE_KEY,
  RETENTION_RISK,
  isCardDue,
  predictedRetention,
  type RecallState,
  type FlashcardsData,
} from "@/lib/flashcards";
import {
  EXAM_DATE,
  buildFallbackTasks,
  buildTodayTasks,
  dateKey,
  daysUntilExam,
  shiftDate,
  sprintDayNumber,
} from "@/lib/today-plan";
import { injectRetryTasks, pickRetryPoints, type RetryPoint } from "@/lib/today-compose";

export const TRACK_STORAGE_KEY = "sysanalyst_track_v1";
export const TODAY_CHECKS_KEY = "sysanalyst_today_checks_v1";
export const CASE_STORAGE_KEY = "sysanalyst_case_v1";

/** 与 TrackApp 一致的点级记录 */
export type PointRecord = { right: number; wrong: number; firstTry: boolean; lastAt: number };
export type TrackRecord = { points: Record<string, PointRecord>; lessons: Record<string, LessonRecord> };
type LessonRecord = { runs: number; best: number; at: number };

/** 配置项状态机：未启动 → 巩固中 → 已掌握；wrong>0 即重新登记风险（回归缺陷） */
export type PointStatus = "new" | "drilling" | "risky" | "mastered";

/** 掌握保鲜期（P0-A3）：已掌握后 7 天未触即降级巩固中——记忆是时变系统，模型不再按静态系统建 */
const MASTERED_TTL_MS = 7 * 86_400_000;

export type PointState = {
  pid: string;
  title: string;
  courseId: string;
  courseTitle: string;
  unitId: string;
  status: PointStatus;
  right: number;
  wrong: number;
  /** 掌握度 right/(right+wrong)；无记录 = 0 */
  rate: number;
  lastAt: number | null;
};

export type CourseState = {
  id: string;
  title: string;
  day: string;
  total: number;
  newN: number;
  drilling: number;
  risky: number;
  mastered: number;
  /** 已掌握 / 总数 */
  pct: number;
};

export type RecallSnapshot = {
  /** 卡总数 */
  total: number;
  /** 盒级分布 [新卡, 1盒..5盒毕业] */
  boxes: number[];
  /** 当前到期（含新卡） */
  due: number;
  /** 今日已刷 */
  todayCount: number;
  /** 平均预测保持率 %（P2-A6，仅统计在册卡；无在册卡 = 100） */
  avgRetention: number;
  /** 记忆风险卡数：在册且预测保持率 < 70%（P2-A6） */
  atRisk: number;
};

export type ExecutionSnapshot = {
  date: string;
  total: number;
  done: number;
  pct: number;
  /** 连续执行天数（含今日；今日未完成则从昨天回溯） */
  streak: number;
  /** 最近 7 日执行率 */
  last7: { date: string; pct: number }[];
};

export type RiskItem = {
  pid: string;
  title: string;
  courseId: string;
  courseTitle: string;
  unitId: string;
  right: number;
  wrong: number;
  /** 错误占比 wrong/(right+wrong) */
  errRate: number;
  /** 重学锚点（总册） */
  kbAnchor: string;
  /** 所属课日次（P0-A1：背诵直达 /recall/?day=） */
  day: string | null;
  /** 课程配套案例整题（P0-A1：做题直达） */
  caseHref: string;
};

export type SeSystemState = {
  generatedAt: number;
  mission: {
    examDate: string;
    daysLeft: number;
    sprintDay: number;
    weekday: string;
  };
  courses: CourseState[];
  points: PointState[];
  recall: RecallSnapshot;
  execution: ExecutionSnapshot;
  cases: { drafts: number };
  risks: RiskItem[];
};

/** 域 → 总册重学锚点（与 TrackApp 反馈块一致；mod=建模域，D1 为软工·UML·OO 总册日次） */
const KB_ANCHOR: Record<string, string> = {
  req: "/kb/quick-four-tier-7d/#d2",
  web: "/kb/quick-four-tier-7d/#d3",
  mic: "/kb/quick-four-tier-7d/#d3",
  db: "/kb/quick-four-tier-7d/#d4",
  mod: "/kb/quick-four-tier-7d/#d1",
};

type TracksJson = {
  courses: {
    id: string;
    title: string;
    day: string;
    tagline: string;
    caseSet: { id: string; href: string };
    units: { id: string; title: string; points: { id: string; title: string }[] }[];
  }[];
};

function statusOf(rec: PointRecord | undefined, now = Date.now()): PointStatus {
  if (!rec) return "new";
  // 风险 = 错比对多（缺陷未清）；纠偏后（答对追平/反超）自动降级，不再终身红标
  if (rec.wrong > rec.right) return "risky";
  // 保鲜衰减（P0-A3）：首过掌握但超 7 天未触碰 → 降级巩固中，等待间隔重复复验
  if (rec.firstTry) return now - (rec.lastAt || 0) > MASTERED_TTL_MS ? "drilling" : "mastered";
  return "drilling";
}

/** 今日勾选存储：date → { taskId: true } */
export type CheckStore = Record<string, Record<string, boolean>>;

/** 当日任务清单（冲刺窗口内用计划，窗口外用兜底模板；仅「今天」额外合成连错入池任务，历史基线保持稳定） */
function tasksOf(date: string, today: string, retry: RetryPoint[] = []) {
  const base = buildTodayTasks(date) ?? buildFallbackTasks(date);
  return date === today ? injectRetryTasks(base, date, retry) : base;
}

function dayPct(
  store: CheckStore,
  date: string,
  today: string,
  retry: RetryPoint[] = []
): { done: number; total: number; pct: number } {
  const ids = tasksOf(date, today, retry).groups.flatMap((g) => g.tasks.map((t) => t.id));
  const total = ids.length;
  const done = ids.filter((id) => store[date]?.[id]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** 聚合全系统状态（客户端调用；tracks/flashcards 走 fetch，进度走 IDB） */
export async function loadSeSystemState(): Promise<SeSystemState> {
  const [tracks, flash, trackRec, checks, caseDrafts] = await Promise.all([
    fetch("/data/tracks.json").then((r) => r.json() as Promise<TracksJson>).catch(() => null),
    fetch("/data/flashcards.json").then((r) => r.json() as Promise<FlashcardsData>).catch(() => null),
    storageGet<TrackRecord>(TRACK_STORAGE_KEY).catch(() => null),
    storageGet<CheckStore>(TODAY_CHECKS_KEY).catch(() => null),
    storageGet<{ drafts?: unknown }>(CASE_STORAGE_KEY).catch(() => null),
  ]);

  const today = dateKey();
  const rec = trackRec?.points ?? {};

  // —— 纠偏执行器数据（P0-A1/A2）：连错点清单 + 课程日次/案例链映射 ——
  const retry = pickRetryPoints(tracks, rec);
  const courseDay = new Map<string, string | null>();
  const courseCaseHref = new Map<string, string>();
  for (const c of tracks?.courses ?? []) {
    courseDay.set(c.id, c.day ?? null);
    courseCaseHref.set(c.id, c.caseSet?.href ?? "/case/");
  }

  // —— 分解层：39 点配置项状态机 ——
  const points: PointState[] = [];
  const courses: CourseState[] = [];
  for (const c of tracks?.courses ?? []) {
    let newN = 0, drilling = 0, risky = 0, mastered = 0;
    for (const u of c.units) {
      for (const p of u.points) {
        const r = rec[p.id];
        const st = statusOf(r);
        if (st === "new") newN++;
        else if (st === "drilling") drilling++;
        else if (st === "risky") risky++;
        else mastered++;
        points.push({
          pid: p.id,
          title: p.title,
          courseId: c.id,
          courseTitle: c.title,
          unitId: u.id,
          status: st,
          right: r?.right ?? 0,
          wrong: r?.wrong ?? 0,
          rate: r && r.right + r.wrong > 0 ? r.right / (r.right + r.wrong) : 0,
          lastAt: r?.lastAt ?? null,
        });
      }
    }
    const total = newN + drilling + risky + mastered;
    courses.push({
      id: c.id,
      title: c.title,
      day: c.day,
      total,
      newN,
      drilling,
      risky,
      mastered,
      pct: total ? Math.round((mastered / total) * 100) : 0,
    });
  }

  // —— 反馈层：背诵闭环 ——
  const recallState = (await storageGet<RecallState>(RECALL_STORAGE_KEY).catch(() => null)) ?? { progress: {} };
  const cards = flash?.cards ?? [];
  const boxes = new Array(6).fill(0) as number[];
  let due = 0;
  for (const card of cards) {
    const p = recallState.progress[card.id];
    boxes[p ? Math.min(p.box, 5) : 0] += 1;
    if (isCardDue(card, recallState)) due++;
  }
  // 记忆保持率（P2-A6）：在册卡（含案例微卡/轨道错题卡等合成卡）的平均预测保持率 + 风险卡数
  let retSum = 0;
  let retN = 0;
  let atRisk = 0;
  for (const p of Object.values(recallState.progress)) {
    if (!p) continue;
    const r = predictedRetention(p);
    retSum += r;
    retN++;
    if (r < RETENTION_RISK) atRisk++;
  }
  const recall: RecallSnapshot = {
    total: cards.length,
    boxes,
    due,
    todayCount: recallState.today && recallState.today.date === today ? recallState.today.count : 0,
    avgRetention: retN ? Math.round((retSum / retN) * 100) : 100,
    atRisk,
  };

  // —— 基线层：今日执行 + 连续执行 + 最近 7 日（今天额外计入连错入池任务，P0-A2） ——
  const store = checks ?? {};
  const t = dayPct(store, today, today, retry);
  const last7: ExecutionSnapshot["last7"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(today, -i);
    const s = dayPct(store, d, today, retry);
    last7.push({ date: d, pct: s.pct });
  }
  // 连续执行：今日完成从今日起算，否则从昨天回溯
  let streak = 0;
  const startFrom = t.done > 0 ? today : shiftDate(today, -1);
  for (let i = 0; i < 30; i++) {
    const d = shiftDate(startFrom, -i);
    if (dayPct(store, d, today, retry).done > 0) streak++;
    else break;
  }
  const execution: ExecutionSnapshot = { date: today, total: t.total, done: t.done, pct: t.pct, streak, last7 };

  // —— 控制层：风险登记册（wrong 降序 → 错误率降序） ——
  const risks: RiskItem[] = points
    .filter((p) => p.status === "risky")
    .map((p) => ({
      pid: p.pid,
      title: p.title,
      courseId: p.courseId,
      courseTitle: p.courseTitle,
      unitId: p.unitId,
      right: p.right,
      wrong: p.wrong,
      errRate: Math.round((p.wrong / Math.max(1, p.right + p.wrong)) * 100),
      kbAnchor: KB_ANCHOR[p.courseId.replace(/-p\d+$/, "")] ?? "",
      day: courseDay.get(p.courseId) ?? null,
      caseHref: courseCaseHref.get(p.courseId) ?? "/case/",
    }))
    .sort((a, b) => b.wrong - a.wrong || b.errRate - a.errRate);

  const drafts = caseDrafts && typeof caseDrafts === "object" ? Object.keys((caseDrafts.drafts as object) ?? {}).length : 0;

  return {
    generatedAt: Date.now(),
    mission: {
      examDate: EXAM_DATE,
      daysLeft: daysUntilExam(today),
      sprintDay: sprintDayNumber(today),
      weekday: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()],
    },
    courses,
    points,
    recall,
    execution,
    cases: { drafts },
    risks,
  };
}