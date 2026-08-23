"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Money } from "@/components/commerce/Money";
import { toMajorUnits, toMinorUnits } from "@/lib/money";

const DEBOUNCE_MS = 300;

type PriceRangeProps = {
  ceiling: number;
  maxPrice: number | null;
  onCommit: (range: { maxPrice: number | null; minPrice: number | null }) => void;
};

export function PriceRange({ ceiling, maxPrice, onCommit }: PriceRangeProps) {
  const groupId = useId();
  const ceilingMajor = Math.max(1, Math.round(toMajorUnits(ceiling)));

  const [draft, setDraft] = useState(
    maxPrice === null ? ceilingMajor : Math.round(toMajorUnits(maxPrice)),
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function handleChange(rawValue: number) {
    const value = Math.max(0, Math.min(rawValue, ceilingMajor));

    setDraft(value);

    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      onCommit({
        maxPrice: value >= ceilingMajor ? null : toMinorUnits(value),
        minPrice: null,
      });
    }, DEBOUNCE_MS);
  }

  const step = Math.max(1000, Math.round(ceilingMajor / 200));
  const isAtCeiling = draft >= ceilingMajor;

  return (
    <fieldset className="grid gap-3">
      <legend className="text-label font-semibold text-text">Price</legend>

      <p className="text-body-sm text-text-muted" id={`${groupId}-value`}>
        {isAtCeiling ? (
          "Any price"
        ) : (
          <>
            Up to <Money minorUnits={toMinorUnits(draft)} />
          </>
        )}
      </p>

      <label className="grid gap-1">
        <span className="text-caption text-text-subtle">Maximum price</span>
        <input
          aria-describedby={`${groupId}-value`}
          aria-valuetext={
            isAtCeiling
              ? "Any price"
              : `Up to ₦${draft.toLocaleString("en-NG")} maximum`
          }
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          max={ceilingMajor}
          min={0}
          onChange={(event) => {
            handleChange(Number(event.target.value));
          }}
          step={step}
          type="range"
          value={draft}
        />
      </label>

      <div
        aria-hidden="true"
        className="flex justify-between text-caption text-text-subtle"
      >
        <span>
          <Money minorUnits={0} />
        </span>
        <span>
          <Money minorUnits={ceiling} />
        </span>
      </div>
    </fieldset>
  );
}
