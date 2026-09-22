"use client";

import { useEffect, useState } from "react";
import {
  Timer,
  Flame,
  BookCheck,
  PenTool,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dialogMobileSheetClassName } from "@/lib/dialog-mobile";
import { getExamCountdown, type ExamCountdownInfo } from "@/lib/exam-countdown";
import { cn } from "@/lib/utils";

export function ExamCountdown({ className }: { className?: string }) {
  const [info, setInfo] = useState<ExamCountdownInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInfo(getExamCountdown(10, 24));
    // 每小时刷新一次倒计时
    const timer = setInterval(() => {
      setInfo(getExamCountdown(10, 24));
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!info) {
    // 占位骨架，防止 SSR Hydration 布局跳动
    return (
      <div
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-surface/40 px-2.5 text-[0.72rem] text-muted-foreground/60 select-none",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-500/50 animate-pulse" />
        <span>10.24 考期</span>
      </div>
    );
  }

  const { days, status, targetDateStr } = info;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group inline-flex h-7 items-center gap-1.5 rounded-full border bg-surface/50 px-2.5 text-[0.72rem] font-medium text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-surface hover:text-foreground active:scale-[0.98] select-none touch-manipulation",
          status === "today"
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
            : status === "tomorrow"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
            : "border-border/80",
          className
        )}
        title={`点击查看 ${targetDateStr} 系统分析师考试倒计时与冲刺备考策略`}
        aria-label={`考试倒计时：${days}天`}
      >
        <span className="relative flex size-2 items-center justify-center">
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75 duration-1000",
              status === "today"
                ? "bg-red-400"
                : status === "tomorrow"
                ? "bg-amber-400"
                : "bg-emerald-400 dark:bg-emerald-500"
            )}
          />
          <span
            className={cn(
              "relative inline-flex size-1.5 rounded-full",
              status === "today"
                ? "bg-red-500"
                : status === "tomorrow"
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
          />
        </span>

        {status === "today" ? (
          <span className="font-semibold text-red-600 dark:text-red-400">今日开考！</span>
        ) : status === "tomorrow" ? (
          <span className="font-semibold text-amber-600 dark:text-amber-400">明天开考！</span>
        ) : (
          <>
            <span className="hidden sm:inline">距 10.24 考期</span>
            <span className="sm:hidden">距考</span>
            <span className="font-semibold tabular-nums text-foreground">{days}</span>
            <span>天</span>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            dialogMobileSheetClassName,
            "sm:max-w-md gap-4 p-5 sm:p-6"
          )}
        >
          <DialogHeader className="gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-border/90 bg-muted/50">
                <Timer className="size-4 text-foreground" />
              </span>
              <DialogTitle className="text-base font-semibold">
                软考 · 系统分析师冲刺倒计时
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              全国计算机技术与软件专业技术资格（水平）考试 · 下半年统考
            </DialogDescription>
          </DialogHeader>

          {/* 倒计时数字大卡片 */}
          <div className="relative overflow-hidden rounded-xl border border-border/80 bg-surface/50 p-4 text-center shadow-xs">
            <div className="text-xs font-medium text-muted-foreground">
              目标开考日：<span className="text-foreground font-semibold">{targetDateStr}（周六）</span> 08:30
            </div>
            <div className="mt-2.5 flex items-baseline justify-center gap-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-foreground">
                {days}
              </span>
              <span className="text-sm font-medium text-muted-foreground">天</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {days > 15
                ? "当前阶段：考点扫盲与真题刷题，建议每日完成 1 组综合知识与 1 道案例分析"
                : days > 3
                ? "当前阶段：冲刺强化与模考，主攻薄弱章节、案例七步法与论文框架默写"
                : "临考阶段：调整作息，熟悉考场机考界面，重温高频公式与论文核心摘要"}
            </p>
          </div>

          {/* 三科冲刺备考锦囊 */}
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>三科备考冲刺要点</span>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <BookCheck className="size-3.5 text-blue-500 shrink-0" />
                <span>综合知识（08:30 - 11:00）</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                高分章节集中在第11章需求工程、第12章软件架构、第07章软件工程与第04章网络系统。每日通过错题与自编练习保持题感。
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <span>案例分析（13:30 - 15:00）</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                试题一为必答题；选答题建议优先选择熟悉的架构/Web/微服务领域。作答严格按「七步法」先定性后说明，踩准采分点。
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <PenTool className="size-3.5 text-purple-500 shrink-0" />
                <span>论文写作（15:30 - 17:30）</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                提前准备好 1~2 个真实大型项目背景，牢记 300~330 字摘要标准句式，正文紧密围绕论题三问展开，注意控制机考打字时长。
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              我知道了，开始刷题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 页面级冲刺提示横条组件（用于刷题/案例首页） */
export function ExamSprintBanner({ className }: { className?: string }) {
  const [info, setInfo] = useState<ExamCountdownInfo | null>(null);

  useEffect(() => {
    setInfo(getExamCountdown(10, 24));
  }, []);

  if (!info) return null;

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface/50 px-3.5 py-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Flame className="size-3.5" />
        </span>
        <span>
          2026 下半年软考（<b>10月24日</b>）倒计时：
          <span className="font-semibold text-foreground tabular-nums text-sm ml-1 mr-0.5">
            {info.days}
          </span>{" "}
          天
        </span>
      </div>
      <span className="hidden sm:inline text-xs text-muted-foreground">
        保持每日刷题与案例练习手感
      </span>
    </div>
  );
}
