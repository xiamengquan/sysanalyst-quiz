import type { Metadata } from "next";
import { TrackApp } from "@/components/TrackApp";

export const metadata: Metadata = {
  title: "答题轨道 · 四域背诵与仿真案例",
  description:
    "需求工程 / Web / 数据库 / 微服务四域答题知识点：选择+填空即时反馈背诵，错题重入，错题点自动进 /recall，单元收官打配套仿真案例题。",
};

export default function TrackPage() {
  return <TrackApp />;
}
