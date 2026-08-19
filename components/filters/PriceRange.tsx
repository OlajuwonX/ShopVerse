"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Money } from "@/components/commerce/Money";
import { toMajorUnits, toMinorUnits } from "@/lib/money";

const DEBOUNCE_MS = 300;

type PriceRangeProps = {
  ceiling: number;
  maxPrice: number | null;
  minPrice: number | null;
  onCommit: (range: { maxPrice: number | null; minPrice: number | null }) => void;
};

export function PriceRange({ ceiling, maxPrice, minPrice, onCommit }: PriceRangeProps) {
  const groupId = useId();
  const ceilingMajor = Math.max(1, Math.round(toMajorUnits(ceiling)));

  const [draft, setDraft] = useState({
    max: maxPrice === null ? ceilingMajor : Math.round(toMajorUnits(maxPrice)),
    min: minPrice === null ? 0 : Math.round(toMajorUnits(minPrice)),
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function scheduleCommit(next: { max: number; min: number }) {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      onCommit({
        maxPrice: next.max >= ceilingMajor ? null : toMinorUnits(next.max),
        minPrice: next.min <= 0 ? null : toMinorUnits(next.min),
      });
    }, DEBOUNCE_MS);
  }

  function handleChange(edge: "max" | "min", rawValue: number) {
    const value = Math.max(0, Math.min(rawValue, ceilingMajor));

    const next =
      edge === "min"
        ? { max: draft.max, min: Math.min(value, draft.max) }
        : { max: Math.max(value, draft.min), min: draft.min };

    setDraft(next);
    scheduleCommit(next);
  }

  const step = Math.max(1000, Math.round(ceilingMajor / 200));

  return (
    <fieldset className="grid gap-3">
      <legend className="text-label font-semibold text-text">Price</legend>

      <p className="text-body-sm text-text-muted" id={`${groupId}-value`}>
        <Money minorUnits={toMinorUnits(draft.min)} /> —{" "}
        <Money minorUnits={toMinorUnits(draft.max)} />
      </p>

      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-caption text-text-subtle">Minimum price</span>
          <input
            aria-describedby={`${groupId}-value`}
            aria-valuetext={`₦${draft.min.toLocaleString("en-NG")} minimum`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            max={ceilingMajor}
            min={0}
            onChange={(event) => {
              handleChange("min", Number(event.target.value));
            }}
            step={step}
            type="range"
            value={draft.min}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-caption text-text-subtle">Maximum price</span>
          <input
            aria-describedby={`${groupId}-value`}
            aria-valuetext={`₦${draft.max.toLocaleString("en-NG")} maximum`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            max={ceilingMajor}
            min={0}
            onChange={(event) => {
              handleChange("max", Number(event.target.value));
            }}
            step={step}
            type="range"
            value={draft.max}
          />
        </label>
      </div>
    </fieldset>
  );
}
