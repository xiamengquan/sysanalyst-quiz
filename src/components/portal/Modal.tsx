"use client";

import type { ReactNode } from "react";
import { Overlay, type OverlayProps } from "@/components/portal/Overlay";

export type ModalProps = Omit<OverlayProps, "children" | "className" | "backdropClassName"> & {
  children: ReactNode;
  /** 对话框标题元素 id（无障碍） */
  labelledBy?: string;
  /** 根层 class，默认全局搜索样式壳 */
  className?: string;
  backdropClassName?: string;
  dialogClassName?: string;
};

/**
 * 居中/顶置对话框：Overlay + dialog，经 Portal 通道投射。
 */
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  className = "gs-root",
  backdropClassName = "gs-backdrop",
  dialogClassName = "gs-dialog",
  lockScroll = true,
  closeOnEscape = true,
  showBackdrop = true,
  backdropLabel = "关闭对话框",
}: ModalProps) {
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
      <div
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </Overlay>
  );
}
