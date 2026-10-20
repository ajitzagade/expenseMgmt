"use client";

import { TRIP_COLORS } from "@/lib/format";
import { cx } from "@/components/ui";

/** Shared color swatch picker for the new-trip and trip-settings forms. */
export function TripColorPicker({ value, onChange }: { value: number; onChange: (index: number) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Trip color</legend>
      <div className="mt-2 flex gap-2">
        {TRIP_COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${i + 1}`}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            className={cx(
              "size-8 rounded-full border-2 transition-transform",
              value === i ? "scale-110 border-ink" : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </fieldset>
  );
}
