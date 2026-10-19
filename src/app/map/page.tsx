import type { Metadata } from "next";
import Link from "next/link";
import caseMap from "../../../public/data/case-map.json";
import kbIndex from "../../../content/kb-index.json";

type DomainRow = {
  domain: string;
  caseCount: number;
  questionCount: number;
  chapters: number[];
  years: Record<string, number>;
  caseTypes: { key: string; count: number }[];
  answerTypes: { key: string; count: number }[];
  points: { key: string; count: number }[];
};

type CaseMapJson = {
  meta: { totalCases: number; totalQuestions: number; realYearCoverage: Record<string, number> };
  caseTypes: { key: string; count: number }[];
  answerTypes: { key: string; count: number }[];
  domains: DomainRow[];
  tiers: Record<string, { label: string; domains: string[]; note: string; stats: { domain: string; caseCount: number; questionCount: number; recent: Record<string, number> }[] }>;
};

const map = caseMap as unknown as CaseMapJson;

export const metadata: Metadata = {
  title: "出题区地图 · 案例分析考点库",
  description: "基于 197 道案例真题的出题区×考点×问法蒸馏统计，按大区押题：T1 押题区 / T2 轮换区 / T3 战略放弃区",
};

type KbItemLite = { id: string; title: string; caseDomains?: string[]; caseFreq?: number; kind?: string };
const kbItems: KbItemLite[] = (kbIndex.sections as { id: string; items: KbItemLite[] }[])
  .flatMap((s) => s.items)
  .filter((it) => it.kind === "point" || !it.kind);

function kpsForDomain(domain: string): KbItemLite[] {
  return kbItems
    .filter((it) => (it.caseDomains ?? []).includes(domain))
    .sort((a, b) => (b.caseFreq ?? 0) - (a.caseFreq ?? 0) || a.id.localeCompare(b.id));
}

const ANSWER_LABEL: Record<string, string> = {
  design: "方案设计",
  short: "简答",
  compare: "对比",
};

function DomainCard({ d, tone }: { d: DomainRow; tone: "t1" | "t2" }) {
  const kps = kpsForDomain(d.domain);
  const recent = Object.entries(d.years)
    .filter(([y]) => Number(y) >= 2023)
    .sort()
    .map(([y, n]) => `${y}×${n}`)
    .join("、") || "近三年未单独出题";
  const topTypes = d.answerTypes
    .slice(0, 3)
    .map((t) => `${ANSWER_LABEL[t.key] ?? t.key} ${t.count}`)
    .join(" · ");
  const topPoints = d.points.slice(0, 3).map((p) => p.key).join("；");
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[1.05rem] font-semibold text-foreground">{d.domain}</h3>
        <span className={cnCount(d.caseCount, tone)}>{d.caseCount} 题</span>
      </div>
      <p className="mt-1 text-[0.8rem] text-muted-foreground">
        问句 {d.questionCount} · 近三年：{recent}
      </p>
      <p className="mt-2 text-[0.82rem] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">怎么问：</span>{topTypes}
      </p>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">高频出题点：</span>{topPoints}
      </p>
      {kps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {kps.slice(0, 8).map((k) => (
            <Link
              key={k.id}
              href={`/kb/${k.id}`}
              className="rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              {shortTitle(k.title)}
            </Link>
          ))}
          {kps.length > 8 && (
            <span className="self-center text-[0.75rem] text-muted-foreground">等 {kps.length} 篇考点</span>
          )}
        </div>
      )}
    </div>
  );
}

function cnCount(n: number, tone: "t1" | "t2") {
  return `shrink-0 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium ${
    tone === "t1"
      ? "border-foreground/25 bg-foreground/[0.06] text-foreground"
      : "border-border/80 bg-muted/40 text-muted-foreground"
  }`;
}

function shortTitle(t: string) {
  return t.length > 26 ? `${t.slice(0, 25)}…` : t;
}

export default function CaseMapPage() {
  const t1 = map.tiers.T1;
  const t2 = map.tiers.T2;
  const t3 = map.tiers.T3;
  const domainOf = (name: string) => map.domains.find((x) => x.domain === name);
  const t1KpCount = t1.domains.reduce((n, d) => n + kpsForDomain(d).length, 0);
  return (
    <div className="mx-auto w-full px-4 py-10 sm:px-6 sm:py-12" style={{ maxWidth: "var(--content-max)" }}>
      <p className="text-[0.72rem] font-medium uppercase tracking-widest text-muted-foreground">
        案例分析 · 押题分级
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">出题区地图</h1>
      <p className="mt-3 max-w-3xl text-[0.95rem] leading-relaxed text-muted-foreground">
        基于 {map.meta.totalCases} 道案例真题（2014–2026，{map.meta.totalQuestions} 个问句）的蒸馏统计，
        按大区押题：把有限时间押在每场必出的 <b className="text-foreground">T1 押题区</b>，
        用 <b className="text-foreground">T2 轮换区</b> 备选答，<b className="text-foreground">T3 放弃区</b>不作为复习主线。
        真题题目不留站，命题规律以本页统计沉淀。
      </p>

      {/* 总量条 */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border/60 bg-muted/30 px-5 py-4 text-[0.85rem] text-muted-foreground">
        <span>题型：<b className="text-foreground">技术方案论证 {map.caseTypes[0]?.count}</b> · 建模与设计 {map.caseTypes[1]?.count} · 问题诊断与改进 {map.caseTypes[2]?.count}</span>
        <span>问法：<b className="text-foreground">方案设计 {map.answerTypes[0]?.count}</b> · 简答 {map.answerTypes[1]?.count} · 对比 {map.answerTypes[2]?.count}</span>
        <span>真题年份：{Object.keys(map.meta.realYearCoverage).length} 届（2014–2026）</span>
      </div>

      {/* T1 */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.15rem] font-semibold text-foreground">{t1.label}</h2>
          <span className="text-[0.8rem] text-muted-foreground">关联考点 {t1KpCount} 篇 · 建议复习时间占比 60%</span>
        </div>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted-foreground">{t1.note}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {t1.domains.map((name) => {
            const d = domainOf(name);
            return d ? <DomainCard key={name} d={d} tone="t1" /> : null;
          })}
        </div>
      </section>

      {/* T2 */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.15rem] font-semibold text-foreground">{t2.label}</h2>
          <span className="text-[0.8rem] text-muted-foreground">建议复习时间占比 35% · 考场按熟悉度选答</span>
        </div>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted-foreground">{t2.note}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {t2.domains.map((name) => {
            const d = domainOf(name);
            return d ? <DomainCard key={name} d={d} tone="t2" /> : null;
          })}
        </div>
      </section>

      {/* T3 */}
      <section className="mt-10">
        <h2 className="text-[1.15rem] font-semibold text-foreground">{t3.label}</h2>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted-foreground">{t3.note}</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[560px] text-[0.85rem]">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">出题区</th>
                <th className="px-4 py-2.5 font-medium">历年案例数</th>
                <th className="px-4 py-2.5 font-medium">处置</th>
              </tr>
            </thead>
            <tbody>
              {t3.domains.map((name) => {
                const d = domainOf(name);
                return (
                  <tr key={name} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d?.caseCount ?? 0}（问句 {d?.questionCount ?? 0}）</td>
                    <td className="px-4 py-2.5 text-muted-foreground">不投入主线复习；考点仍在<Link className="text-primary underline" href="/kb/">考点库</Link>可查</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 使用方法 */}
      <section className="mt-10 rounded-xl border border-border/60 bg-muted/30 p-5">
        <h2 className="text-[1rem] font-semibold text-foreground">怎么用这张地图</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.88rem] leading-relaxed text-muted-foreground">
          <li>按 T1 → T2 顺序进<Link className="text-primary underline" href="/kb/">考点库</Link>读对应出题区考点，优先看带 caseFreq 高频标签的篇目</li>
          <li>每个出题区先记「怎么问」（对比 / 方案设计 / 简答），再背对应答题套路与模板（见考点库速查栏目）</li>
          <li>到外部真题站点按本地图的出题区实练对应年份真题，对照套路自查</li>
          <li>T3 放弃区只在考点库当字典查，不安排整块复习时间</li>
        </ol>
      </section>
    </div>
  );
}