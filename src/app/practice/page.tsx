import Link from "next/link";
import { Dumbbell, Flame, Infinity as InfinityIcon, Layers, ListChecks, FileText, Route, CalendarCheck, BookOpen, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "练习场 · 系统分析师刷题站",
  description: "简单 · 快速 · 全面 · 疯狂练习——六池混练，在练习中重复学习",
};

const pools = [
  {
    href: "/quiz/?path=random75",
    icon: InfinityIcon,
    title: "疯狂练习",
    desc: "全库随机 75 题 · 乱序螺旋重复",
    stat: "进 Setup 直接开跑",
    primary: true,
  },
  {
    href: "/recall/",
    icon: Flame,
    title: "到期闪卡",
    desc: "1-2-4-7-15 间隔重复 · 轨道错题自动并入",
    stat: "复习优先级最高",
  },
  {
    href: "/track/",
    icon: Route,
    title: "轨道课程",
    desc: "四域 39 点 · 选择/填空/判断/配对/排序/简答六题型",
    stat: "211 题 · 错题重入",
  },
  {
    href: "/quiz/",
    icon: ListChecks,
    title: "快速刷题",
    desc: "七日巩固每日配题 · 全库筛选",
    stat: "730 自编 + 165 工坊",
  },
  {
    href: "/case/",
    icon: FileText,
    title: "案例训练",
    desc: "14 天计划 · 自编仿真 + 真题案例",
    stat: "138 套",
  },
  {
    href: "/real-exams/",
    icon: FileText,
    title: "真题套卷",
    desc: "历年综合知识按场次成卷 · 模考还原",
    stat: "1040 题 · 13 场次",
  },
  {
    href: "/drill/",
    icon: Layers,
    title: "建模演练",
    desc: "UML / 数据库 / 需求分步推演",
    stat: "步骤链 · 范例句",
  },
  {
    href: "/today/",
    icon: CalendarCheck,
    title: "今日计划",
    desc: "上午 / 午休 / 晚主块编排 · 深链直达",
    stat: "每日入口",
  },
];

const loop = [
  { title: "练 → 错", desc: "六题型即时判定，错题本轮重入直到答对（TrackApp）" },
  { title: "错 → 学", desc: "答题中「知识点」抽屉就地重学相关考点；轨道反馈块一键回总册讲透" },
  { title: "学 → 再练", desc: "错题点自动转 /recall 闪卡，按 1-2-4-7-15 排程重复杀回马枪" },
];

export default function PracticePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:pb-12">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Dumbbell className="size-5" /> 练习场
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          简单 · 快速 · 全面 · 疯狂练习——<span className="font-medium text-foreground">每一次练习都是一次复习</span>
        </p>
      </header>

      <Card className="mb-4 border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[1.05rem] font-semibold">🎲 疯狂练习 · 全库随机 75 题</p>
            <p className="mt-0.5 text-[0.85rem] text-muted-foreground">
              不选池、不挑章节：全库乱序螺旋出题，做完即看解析，错点自动进复习排程
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/quiz/?path=random75">立即开练</Link>
          </Button>
        </div>
      </Card>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {pools.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.href} href={p.href} className="block">
              <Card
                className={
                  p.primary
                    ? "flex h-full items-start gap-3 border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                    : "flex h-full items-start gap-3 p-4 transition-colors hover:bg-muted/40"
                }
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-[0.82rem] leading-snug text-muted-foreground">{p.desc}</p>
                  <p className="mt-1 text-[0.72rem] font-medium text-muted-foreground/80">{p.stat}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mb-4 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[0.95rem] font-semibold">
          <Repeat className="size-4" /> 在练习中重复学习（三环闭环）
        </p>
        <div className="space-y-1.5">
          {loop.map((s, i) => (
            <p key={i} className="text-[0.85rem] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{s.title}</span>：{s.desc}
            </p>
          ))}
        </div>
        <p className="mt-2 text-[0.8rem] text-muted-foreground">
          想先看懂再练？去
          <Link href="/kb/" className="mx-1 underline underline-offset-2">
            知识库
          </Link>
          读总册逐点讲透，或用
          <Link href="/audio/" className="mx-1 underline underline-offset-2">
            /audio
          </Link>
          听 39 点讲透文章。
        </p>
      </Card>

      <div className="flex justify-center gap-4 text-[0.8rem] text-muted-foreground">
        <Link href="/kb/" className="underline underline-offset-2 hover:text-foreground">
          知识库
        </Link>
        <Link href="/changelog/" className="underline underline-offset-2 hover:text-foreground">
          更新日志
        </Link>
        <Link href="/about/" className="underline underline-offset-2 hover:text-foreground">
          关于
        </Link>
      </div>
    </div>
  );
}