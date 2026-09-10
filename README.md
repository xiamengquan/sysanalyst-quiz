# 系统分析师 · 刷题站（Next.js）

软考「系统分析师」备考刷题站点，由原本地静态页迁移为 **Next.js 15（App Router + 静态导出）**，可一键部署到 **EdgeOne Makers**。

## 功能

- **刷题**：自编练习 / 真题选择题 / 出题工坊；筛选、连续通关、本地进度
- **案例**：100 套案例分析练习卡（背景 + 三问 + 参考要点）
- **知识点**：正式精炼 Markdown 站内阅读
- **关于**：合规与部署说明

## 本地开发

```bash
npm install
npm run dev
# http://localhost:3000
```

## 构建（EdgeOne / 静态托管）

```bash
npm run build
# 产物目录：out/
```

`edgeone.json` 已配置：

| 项 | 值 |
|----|-----|
| installCommand | `npm install` |
| buildCommand | `npm run build` |
| outputDirectory | `out` |
| framework | nextjs |

## 部署到 EdgeOne Makers

1. 将本仓库推送到 GitHub
2. 打开 [EdgeOne Makers](https://pages.edgeone.ai/) → Import Git Repository → 授权 GitHub → 选本仓库
3. 确认构建命令与输出目录（可直接使用 `edgeone.json`）
4. Start Deployment；之后每次 push 自动重新部署

## 数据

题库与知识点镜像在 `public/data` 与 `public/kb`（来自知识点精炼正式发布产物）。

## 合规

仅供个人学习；真题内容请勿商用或二次传播。
