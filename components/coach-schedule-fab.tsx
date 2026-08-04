"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Floating action button — add student session (Google Calendar pattern)
 */

type Props = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export default function CoachScheduleFab({
  onClick,
  disabled = false,
  label = "新增學員上堂時間"
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="fixed bottom-[5.25rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl font-light leading-none text-black shadow-lg shadow-black/20 transition hover:scale-[1.03] hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 md:bottom-6 md:right-6"
    >
      +
    </button>
  );
}
