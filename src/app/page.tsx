import Link from "next/link";
import { BookOpen, Layers, Headphones, Map, ExternalLink } from "lucide-react";

const entries = [
  {
    href: "/kb/",
    icon: BookOpen,
    title: "案例考点库",
    desc: "145 篇案例相关考点精炼（一考点一篇），只留案例分析可能出现的考点，含考频标签与案例出题区映射。",
  },
  {
    href: "/track/",
    icon: Layers,
    title: "出题区专题",
    desc: "按案例固定出题区组织的深度阅读路径：需求工程 / Web / 微服务 / 数据库 / 系统分析与建模。",
  },
  {
    href: "/audio/",
    icon: Headphones,
    title: "音频讲透",
    desc: "四大方面 39 点「逐点讲透 · 一通到底」，通勤场景的伴随复习，纯收听不测验。",
  },
  {
    href: "/map/",
    icon: Map,
    title: "出题区地图",
    desc: "197 道真题蒸馏的押题分级：T1 押题区每场必出，T2 轮换备选，T3 战略放弃——时间花在刀刃上。",
  },
];

export default function HomePage() {
  return (
    <div
      className="mx-auto w-full px-4 py-10 sm:px-6 sm:py-14"
      style={{ maxWidth: "var(--content-max)" }}
    >
      <div className="max-w-2xl">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-muted-foreground">
          系统分析师 · 下午一
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          案例分析考点库
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
          本站只服务「下午一 · 案例分析」：学考点、背套路。答题实练请前往外部真题站点完成，
          本站不提供作答与判分交互。上午综合知识与下午论文的备考内容已按 2026-10 决策下线。
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {entries.map((e) => {
          const Icon = e.icon;
          return (
            <Link
              key={e.href}
              href={e.href}
              className="group rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-muted/40">
                <Icon className="size-4 text-foreground" aria-hidden />
              </div>
              <h2 className="mt-3 text-[1.02rem] font-semibold text-foreground">{e.title}</h2>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted-foreground">{e.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[0.8rem] font-medium text-foreground/80 transition-opacity group-hover:opacity-70">
                进入 <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-border/60 bg-muted/30 p-4 text-[0.85rem] leading-relaxed text-muted-foreground sm:mt-10">
        <span className="font-medium text-foreground">怎么用这个站：</span>
        先在考点库按出题区读透考点（怎么考、怎么答、怎么不丢分），再背答题套路与模板；
        然后到外部站点按出题区实练历年真题，对照套路自查。真题题干与解析已按决策不留站，
        命题规律沉淀在各出题区的考频统计中。
      </div>
    </div>
  );
}