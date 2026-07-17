"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Mobile bottom sheet shell — backdrop, drag handle, slide animation
 */

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  /** Approx. 50–60% viewport height */
  heightClass?: string;
};

const DISMISS_DRAG_PX = 72;

export default function CoachBottomSheet({
  open,
  onClose,
  title,
  ariaLabelledBy,
  children,
  heightClass = "max-h-[58vh]"
}: Props) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_DRAG_PX || info.velocity.y > 420) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="關閉"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-ink/55 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={handleDragEnd}
            className={`fixed inset-x-0 bottom-0 z-[201] mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border border-ink/10 bg-surface shadow-2xl ${heightClass}`}
          >
            <div
              className="flex shrink-0 cursor-grab flex-col items-center pt-3 pb-2 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1 w-10 rounded-full bg-ink/25" aria-hidden />
            </div>
            {title ? (
              <div className="shrink-0 border-b border-ink/10 px-4 pb-3">
                <h2 id={ariaLabelledBy} className="text-sm font-semibold text-ink">
                  {title}
                </h2>
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
