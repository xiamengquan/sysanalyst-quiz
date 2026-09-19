# Portal 通道（已归档）

> 原维护：网站程序 · 2026-09-14  
> **状态：已移除（B-4 · 2026-09-19）**

## 结论

自 v0.6 shadcn 壳层起：

| 原能力 | 现行替代 |
|--------|----------|
| `Modal` | `@/components/ui/dialog` |
| `Drawer` / `Overlay` | `@/components/ui/sheet`（知识点预览浮层） |
| `Portal` + `PortalHost` | 不再需要；toast 用 `.kb-toast` fixed |
| `useEscapeKey` | `@/lib/use-escape-key` |

代码目录 `src/components/portal/` 已删除；`globals.css` 中 `.portal-*` 样式已清理。

固钉知识点抽屉仍在内容树 `.kb-dock-layout` 内渲染，不走遮罩层。
