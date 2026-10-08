import { redirect } from "next/navigation";

/** 旧站 /knowledge 根路径 → 考点知识库首页 */
export default function KnowledgeIndexPage() {
  redirect("/kb/");
}
