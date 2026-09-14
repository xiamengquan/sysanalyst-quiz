# Portal 通道（Modal / Drawer / Overlay）

> 维护：网站程序 · 2026-09-14

## 作用

把浮层从页面内容树抽离到统一通道 `#app-portal-channel`，避免被父级 `overflow` / `transform` / 层叠上下文裁剪或遮挡。

**层级**：`.portal-channel` 使用 `z-index: 200`（高于 `SiteHeader` 顶栏/底栏 `z-50`）。勿把通道降到导航之下，否则矮视口下浮层会被导航盖住。

## 结构

| 模块 | 路径 | 说明 |
|------|------|------|
| 通道挂载 | `PortalHost` → `layout.tsx` | 页面底部放置一次 |
| 投射 | `Portal` | `createPortal` 到通道 |
| Overlay | `Overlay` | 遮罩 + 滚动锁 + Esc |
| Modal | `Modal` | Overlay + `role=dialog`（全局搜索） |
| Drawer | `Drawer` | Overlay + 侧栏 aside（可复用） |

## 接入约定

- **浮层**（搜索、知识点抽屉未固钉）：走 Portal 通道  
- **固钉抽屉**：仍在内容树 `.kb-dock-layout` 内渲染，**不**进 Portal  
- Toast 等轻提示：可用 `Portal` 直接投射  

```tsx
import { Modal, Drawer, Overlay, Portal } from "@/components/portal";
```
