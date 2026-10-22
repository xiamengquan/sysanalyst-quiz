import type { Metadata } from "next";
import { NotesApp } from "@/components/NotesApp";

export const metadata: Metadata = {
  title: "视频笔记 · 系统分析师案例分析",
  description:
    "《系统分析师·案例分析通关》8 讲视频内容整理：方法论、结构化分析、面向对象建模、架构风格、数据库设计、网站架构演化、综合实战与真题带练。",
};

export default function NotesPage() {
  return <NotesApp />;
}
