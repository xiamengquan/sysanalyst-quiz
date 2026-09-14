---
name: sysanalyst-web-dev
description: >-
  题库网站小组·程序：实现题库站点前端、题库合并加载、筛选与连续作答等功能。
  用户提到题库网站开发、答题页改版、静态站点实现时使用。
---

# 网站程序

## 基线

优先演进：`src/`（Next.js，`output: "export"`）；说明与辅助文档在 `docs/web-team/程序/`。

## 职责

1. 实现设计稿中的导航与页面（刷题 / 案例 / 知识点 / 关于等）  
2. 维护题库合并产物：`npm run sync:data` → `public/data/questions.json`、`cases.json`（源：`content/banks/` + `content/workshop/new/`）  
3. 知识点只读渲染：`npm run sync:kb` → `public/kb/` ——**仅正式发布内容**  
4. 保持本地可运行（`npm run dev` / 静态导出预览）；更新 `docs/web-team/程序/README.md`  

## 禁止

把未审计知识点草稿挂成「正式」；在前端写死密钥；爬取外网站点题库。
