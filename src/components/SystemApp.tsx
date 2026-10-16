"use client";

/**
 * 系统工程总控台（/system）
 *
 * 把整站从「工具堆」统一为一个闭环系统，按系统工程五层呈现：
 *  使命层  考期倒计时 + 冲刺日次 + 三科里程碑（V 模型验证节点）
 *  分解层  39 个案例知识点 = 39 个配置项状态矩阵（未启动/巩固中/风险/已掌握）
 *  基线层  今日执行单（TodayApp embedded）——计划为基线，勾选为实际
 *  控制层  风险登记册——薄弱点排行 + 纠偏动作直达执行器（⚡练此点 / 🧠背此卡 / ✍️做此题 / 📖重学）
 *  反馈层  背诵闭环——/recall 盒级分布 + 到期卡
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LayoutGrid,
  PenLine,
  RefreshCcw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadSeSystemState, type PointStatus, type SeSystemState } from "@/lib/se-system";
import { TodayApp } from "@/components/TodayApp";

const STATUS_META: Record<PointStatus, { label: string; cell: string; dot: string }> = {
  new: { label: "未启动", cell: "bg-muted/60 border-border text-muted-foreground/70", dot: "bg-muted-foreground/40" },
  drilling: { label: "巩固中", cell: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  risky: { label: "风险", cell: "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400", dot: "bg-red-500" },
  mastered: { label: "已掌握", cell: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
};

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(c * done).toFixed(2)} ${c.toFixed(2)}`}
        className={done >= 1 ? "stroke-emerald-500" : done > 0 ? "stroke-foreground" : "stroke-transparent"}
      />
    </svg>
  );
}

function SectionHead({ icon: Icon, title, desc }: { icon: typeof Activity; title: string; desc: string }) {
  return (
    <div className="mb-3 mt-8 flex items-start gap-2.5 first:mt-0">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/50">
        <Icon className="size-3.5 text-foreground" aria-hidden />
      </div>
      <div className="min-w-0">
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-[0.75rem] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

export function SystemApp() {
  const [se, setSe] = useState<SeSystemState | null>(null);

  useEffect(() => {
    loadSeSystemState()
      .then(setSe)
      .catch(() => setSe(null));
  }, []);

  if (!se) return <p className="text-muted-foreground">系统状态聚合中…</p>;

  const { mission, courses, points, recall, execution, cases, risks } = se;
  const totalPoints = points.length;
  const mastered = points.filter((p) => p.status === "mastered").length;
  const risky = points.filter((p) => p.status === "risky").length;
  const drilling = points.filter((p) => p.status === "drilling").length;
  const sysPct = totalPoints ? Math.round((mastered / totalPoints) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:pb-12">
      {/* ===== 使命层 ===== */}
      <header>
        <h1 className="page-title">系统工程总控台</h1>
        <p className="page-lead">
          使命 · 分解 · 基线 · 控制 · 反馈——把备考当作一个闭环系统来管理，一切状态可测、可查、可纠偏。
        </p>
      </header>

      <Card className="px-(--card-spacing) mb-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Ring pct={sysPct} size={64} />
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">系统使命</p>
              <p className="text-[0.95rem] font-semibold text-foreground">
                {mission.examDate} 通过系统分析师
              </p>
              <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                距考 <b className="text-foreground">{mission.daysLeft}</b> 天 · 冲刺第{" "}
                <b className="text-foreground">{Math.min(mission.sprintDay, 14)}</b>/14 天 · 39 点已掌握 {mastered}/{totalPoints}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/real-exams/">
                <ShieldCheck className="size-3.5" /> 综合知识 · V&V
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/case/">
                <PenLine className="size-3.5" /> 案例分析
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/kb/quick-essay/">
                <GraduationCap className="size-3.5" /> 论文
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== 系统健康带：五个子系统 ===== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card size="sm" className="cursor-default">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-4 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.68rem] text-muted-foreground">今日执行</p>
              <p className="text-[0.95rem] font-semibold">
                {execution.pct}%<span className="ml-1 text-[0.68rem] font-normal text-muted-foreground">{execution.done}/{execution.total}</span>
              </p>
            </div>
          </div>
          {execution.streak > 0 && (
            <p className="flex items-center gap-1 text-[0.68rem] text-amber-600 dark:text-amber-400">
              <Flame className="size-3" /> 连续 {execution.streak} 天
            </p>
          )}
        </Card>
        <Card size="sm" className="cursor-default">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.68rem] text-muted-foreground">39 点掌握</p>
              <p className="text-[0.95rem] font-semibold">
                {mastered}/{totalPoints}
                {risky > 0 && <span className="ml-1 text-[0.68rem] font-normal text-red-600 dark:text-red-400">风险 {risky}</span>}
              </p>
            </div>
          </div>
          <p className="text-[0.68rem] text-muted-foreground">巩固中 {drilling} · 未启动 {totalPoints - mastered - risky - drilling}</p>
        </Card>
        <Card size="sm" className="cursor-default">
          <div className="flex items-center gap-2">
            <RefreshCcw className="size-4 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.68rem] text-muted-foreground">背诵闭环</p>
              <p className="text-[0.95rem] font-semibold">
                到期 {recall.due}
                <span className="ml-1 text-[0.68rem] font-normal text-muted-foreground">今日已刷 {recall.todayCount}</span>
              </p>
            </div>
          </div>
          <p className="text-[0.68rem] text-muted-foreground">
            保持率 {recall.avgRetention}%
            {recall.atRisk > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">风险卡 {recall.atRisk}</span>}
          </p>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {recall.boxes.map((n, i) => (
              <div
                key={i}
                className={cn("flex-1 rounded-sm", i === 0 ? "bg-muted-foreground/30" : i >= 4 ? "bg-emerald-500/70" : "bg-primary/60")}
                style={{ flexGrow: Math.max(n, 0.02) }}
                title={`${i === 0 ? "新卡" : `${i} 盒`}：${n}`}
              />
            ))}
          </div>
        </Card>
        <Card size="sm" className="cursor-default">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.68rem] text-muted-foreground">案例作答</p>
              <p className="text-[0.95rem] font-semibold">
                草稿 {cases.drafts} 份
              </p>
            </div>
          </div>
          <p className="text-[0.68rem] text-muted-foreground">验证节点：10-17 / 10-24 两场整卷</p>
        </Card>
      </div>

      {/* ===== 分解层：39 点配置项状态矩阵 ===== */}
      <SectionHead
        icon={LayoutGrid}
        title="分解层 · 39 点状态矩阵"
        desc="WBS 分解：每个案例知识点是一个配置项，带独立状态机；点格点击直达对应练习舱"
      />
      <div className="space-y-2">
        {courses.map((c) => (
          <Card key={c.id} size="sm" id={`sec-course-${c.id}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[0.85rem] font-medium">{c.title}</p>
              <p className="shrink-0 text-[0.7rem] text-muted-foreground">
                掌握 {c.mastered}/{c.total}
                {c.risky > 0 && <span className="ml-1 text-red-600 dark:text-red-400">风险 {c.risky}</span>}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {points
                .filter((p) => p.courseId === c.id)
                .map((p) => {
                  const m = STATUS_META[p.status];
                  return (
                    <Link
                      key={p.pid}
                      href={`/track/?point=${encodeURIComponent(p.pid)}`}
                      title={`${p.title} · ${m.label}${p.right + p.wrong > 0 ? `（对${p.right}/错${p.wrong}）` : ""}`}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border text-[0.65rem] font-medium transition-transform hover:scale-[1.04]",
                        m.cell
                      )}
                    >
                      {p.pid.replace(/^[a-z]+-p/, "")}
                    </Link>
                  );
                })}
            </div>
          </Card>
        ))}
        <p className="flex flex-wrap items-center gap-3 px-1 text-[0.7rem] text-muted-foreground">
          {(Object.keys(STATUS_META) as PointStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}
            </span>
          ))}
          <span>· 状态机：未启动 → 巩固中 → 已掌握；错比对多 = 风险在册，纠偏答对后自动解除；已掌握超 7 天未触自动降级巩固中</span>
        </p>
      </div>

      {/* ===== 控制层：风险登记册 ===== */}
      <SectionHead
        icon={AlertTriangle}
        title="控制层 · 风险登记册"
        desc="偏差分析：薄弱点按风险排序，每项直达纠偏执行器——练此点 / 背此卡 / 做此题 / 重学，先清风险，再谈进度"
      />
      {risks.length === 0 ? (
        <Card size="sm">
          <p className="text-[0.85rem] text-muted-foreground">
            ✅ 风险登记册为空——还没有错题记录。开一轮「⚡ 连续冲击」让系统开始测量，风险项会自动入册。
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2 w-full gap-1">
            <Link href="/track/">
              <Zap className="size-3.5" /> 去答题轨道开冲击
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {risks.slice(0, 8).map((r, i) => (
            <Card key={r.pid} size="sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-[0.7rem] font-semibold text-red-600 dark:text-red-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.85rem] font-medium">{r.title}</p>
                    <p className="text-[0.68rem] text-muted-foreground">
                      {r.courseTitle} · 对 {r.right} / 错 {r.wrong} · 错误率 {r.errRate}%
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-[0.7rem]">
                    <Link href={`/track/?point=${encodeURIComponent(r.pid)}`}>
                      <Zap className="size-3" /> 练此点
                    </Link>
                  </Button>
                  {r.day && (
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-[0.7rem]">
                      <Link href={`/recall/?day=${encodeURIComponent(r.day)}`}>
                        <Brain className="size-3" /> 背此卡
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-[0.7rem]">
                    <Link href={r.caseHref}>
                      <PenLine className="size-3" /> 做此题
                    </Link>
                  </Button>
                  {r.kbAnchor && (
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-[0.7rem]">
                      <Link href={r.kbAnchor}>
                        <BookOpenCheck className="size-3" /> 重学
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {risks.length > 8 && (
            <p className="px-1 text-[0.72rem] text-muted-foreground">另有 {risks.length - 8} 项风险在册，冲完当前域自动更新。</p>
          )}
        </div>
      )}

      {/* ===== 基线层：今日执行单 ===== */}
      <SectionHead
        icon={CalendarCheck}
        title="基线层 · 今日执行单"
        desc="进度基线（14 天计划）vs 实际执行——勾选实时写回，偏差即刻可见"
      />
      <TodayApp embedded />

      {/* ===== 反馈层 ===== */}
      <SectionHead
        icon={RefreshCcw}
        title="反馈层 · 闭环回收"
        desc="错点自动进入间隔重复排程——系统记住了你忘的，只给你快忘的"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/recall/">
            <RefreshCcw className="size-4" />
            <span className="text-[0.8rem]">随机问答 · 到期 {recall.due} 张</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/audio/">
            <Activity className="size-4" />
            <span className="text-[0.8rem]">洗脑音频 · 通勤编码</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}