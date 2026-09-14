"use client";

import type { ReactNode } from "react";
import { Overlay, type OverlayProps } from "@/components/portal/Overlay";

export type DrawerProps = Omit<OverlayProps, "children" | "className" | "backdropClassName"> & {
  children: ReactNode;
  labelledBy?: string;
  className?: string;
  backdropClassName?: string;
  panelClassName?: string;
};

/**
 * 侧滑抽屉：Overlay + aside，经 Portal 通道投射。
 * 固钉态请勿使用本组件，应在内容树内渲染。
 */
export function Drawer({
  open,
  onClose,
  children,
  labelledBy,
  className = "kb-drawer-root",
  backdropClassName = "kb-drawer-backdrop",
  panelClassName = "kb-drawer-panel",
  lockScroll = true,
  closeOnEscape = true,
  showBackdrop = true,
  backdropLabel = "关闭抽屉",
}: DrawerProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      className={className}
      backdropClassName={backdropClassName}
      backdropLabel={backdropLabel}
      lockScroll={lockScroll}
      closeOnEscape={closeOnEscape}
      showBackdrop={showBackdrop}
    >
      <aside
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </aside>
    </Overlay>
  );
}
