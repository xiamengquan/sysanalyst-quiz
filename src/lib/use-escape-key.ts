"use client";

import { useEffect } from "react";

/** Esc 关闭浮层 / 固钉抽屉等 */
export function useEscapeKey(enabled: boolean, onEscape?: () => void) {
  useEffect(() => {
    if (!enabled || !onEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onEscape]);
}
