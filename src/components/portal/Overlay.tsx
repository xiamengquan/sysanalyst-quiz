"use client";

import type { ReactNode } from "react";
import { Portal } from "@/components/portal/Portal";
import { useBodyScrollLock, useEscapeKey } from "@/components/portal/hooks";

export type OverlayProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** 根节点 class，如 gs-root / kb-drawer-root */
  className?: string;
  backdropClassName?: string;
  backdropLabel?: string;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
  /** 关闭时是否渲染 backdrop（默认有） */
  showBackdrop?: boolean;
};

/**
 * 遮罩层：经 Portal 通道挂到页面顶层。
 */
export function Overlay({
  open,
  onClose,
  children,
  className = "portal-overlay",
  backdropClassName = "portal-backdrop",
  backdropLabel = "关闭",
  lockScroll = true,
  closeOnEscape = true,
  showBackdrop = true,
}: OverlayProps) {
  useBodyScrollLock(open && lockScroll);
  useEscapeKey(open && closeOnEscape && Boolean(onClose), onClose);

  if (!open) return null;

  return (
    <Portal>
      <div className={className} role="presentation">
        {showBackdrop ? (
          <button
            type="button"
            className={backdropClassName}
            aria-label={backdropLabel}
            onClick={onClose}
          />
        ) : null}
        {children}
      </div>
    </Portal>
  );
}
