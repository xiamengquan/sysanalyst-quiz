"use client";

import { useEffect, useState } from "react";

/** 客户端 matchMedia(min-width)，SSR 默认 false */
export function useMediaMinWidth(minPx: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [minPx]);
  return matches;
}
