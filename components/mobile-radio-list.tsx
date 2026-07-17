"use client";

/**
 * [F002][S003]
 * Feature: Course Entry & Automation
 * Step: Tap radio list — replaces select dropdown on mobile
 */

type Option = {
  value: number;
  label: string;
};

type Props = {
  name: string;
  legend: string;
  value: number | "";
  options: Option[];
  onChange: (value: number | "") => void;
  emptyLabel?: string;
};

export default function MobileRadioList({
  name,
  legend,
  value,
  options,
  onChange,
  emptyLabel = "請選擇"
}: Props) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-ink/70">{legend}</legend>
      <div className="mt-2 space-y-2">
        {options.length === 0 ? (
          <p className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink/50">{emptyLabel}</p>
        ) : (
          options.map((opt) => {
            const checked = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center rounded-lg border px-3 py-3 text-sm font-medium transition ${
                  checked
                    ? "border-primary bg-primary text-black ring-1 ring-primary/35"
                    : "border-ink/15 bg-surface text-black hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
