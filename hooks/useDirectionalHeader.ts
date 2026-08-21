"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HeaderState = "compact" | "full" | "hidden";

export const APP_SCROLL_ID = "app-scroll";

const FULL_HEADER_MAX_Y = 96;
const DIRECTION_THRESHOLD_PX = 8;

function isScrollable(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.scrollHeight > element.clientHeight + 1;
}

export function useDirectionalHeader() {
  const [state, setState] = useState<HeaderState>("full");
  const stateRef = useRef<HeaderState>("full");
  const lastYRef = useRef(0);
  const frameRef = useRef(0);

  const apply = useCallback((next: HeaderState) => {
    if (stateRef.current === next) {
      return;
    }

    stateRef.current = next;
    setState(next);
  }, []);

  const reveal = useCallback(() => {
    if (stateRef.current === "hidden") {
      apply("compact");
    }
  }, [apply]);

  useEffect(() => {
    const container = document.getElementById(APP_SCROLL_ID);

    function currentOffset() {
      return isScrollable(container) ? container.scrollTop : window.scrollY;
    }

    lastYRef.current = currentOffset();

    function measure() {
      frameRef.current = 0;

      const y = currentOffset();
      const delta = y - lastYRef.current;

      if (y <= FULL_HEADER_MAX_Y) {
        lastYRef.current = y;
        apply("full");

        return;
      }

      if (Math.abs(delta) < DIRECTION_THRESHOLD_PX) {
        return;
      }

      lastYRef.current = y;
      apply(delta > 0 ? "hidden" : "compact");
    }

    function handleScroll() {
      if (frameRef.current === 0) {
        frameRef.current = window.requestAnimationFrame(measure);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    container?.addEventListener("scroll", handleScroll, { passive: true });
    measure();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);

      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [apply]);

  return { reveal, state };
}
