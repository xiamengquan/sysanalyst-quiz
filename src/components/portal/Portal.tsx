"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PORTAL_CHANNEL_ID } from "@/components/portal/PortalHost";

type Props = {
  children: ReactNode;
  /** false 时不投射（例如抽屉固钉在内容树内渲染） */
  enabled?: boolean;
};

/**
 * 将子树投射到 Portal 通道（`#app-portal-channel`），避免被父级 overflow / stacking 裁剪。
 */
export function Portal({ children, enabled = true }: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTarget(null);
      return;
    }
    const el = document.getElementById(PORTAL_CHANNEL_ID) || document.body;
    setTarget(el);
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  if (!target) return null;
  return createPortal(children, target);
}
