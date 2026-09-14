"use client";

import { useEffect } from "react";

/** 打开层时锁定 body 滚动；支持多层叠加以引用计数 */
let lockCount = 0;
let prevOverflow = "";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [locked]);
}

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
