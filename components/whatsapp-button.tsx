"use client";

/**
 * [F005][S003]
 * Feature: Balance Sync & Integrations
 * Step: Click-to-send WhatsApp button (wa.me)
 * Logic: Opens WhatsApp with pre-filled template message; staff taps Send manually.
 */

import { openWhatsAppLink } from "../lib/whatsapp-utils";

type Props = {
  href?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Async action (e.g. API → wa_me_url) before open; or use with href for direct open. */
  onClick?: () => void | Promise<void>;
};

const baseClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:opacity-50";

export default function WhatsAppButton({ href, label = "WhatsApp", className = "", disabled = false, onClick }: Props) {
  const classes = `${baseClass} ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        className={classes}
      >
        <span aria-hidden>📱</span>
        {label}
      </button>
    );
  }

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        openWhatsAppLink(href);
        e.preventDefault();
      }}
      className={classes}
      aria-disabled={disabled}
    >
      <span aria-hidden>📱</span>
      {label}
    </a>
  );
}
