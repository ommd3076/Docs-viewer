"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ScrollProgressSection = { id: string; label: string };

const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SIZE_SPRING = { type: "spring", bounce: 0.16, duration: 0.5 } as const;
const LABEL_CROSSFADE = { duration: 0.22, ease: EASE_OUT } as const;
const LAYER_FADE = { duration: 0.24, ease: EASE_IN_OUT } as const;

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type Size = { width: number; height: number };

export type ScrollProgressProps = React.ComponentProps<"div"> & {
  sections?: ScrollProgressSection[];
  containerRef?: React.RefObject<HTMLElement | null>;
  offset?: number;
  resetKey?: string;
  onSelectSection?: (id: string, index: number) => void;
};

const ScrollProgress = ({
  className,
  sections = [],
  containerRef,
  offset = 140,
  resetKey,
  onSelectSection,
  ...props
}: ScrollProgressProps) => {
  const layoutId = React.useId();
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll(
    containerRef ? { container: containerRef } : undefined,
  );
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  const [percent, setPercent] = React.useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (Number.isFinite(v)) {
      setPercent(Math.round(Math.min(1, Math.max(0, v)) * 100));
    }
  });

  const [activeId, setActiveId] = React.useState(sections[0]?.id);
  const [open, setOpen] = React.useState(false);

  // 3-second consecutive hover reveals a dismiss 'x' mark; returns automatically on next doc/view/reload
  const [dismissed, setDismissed] = React.useState(false);
  const [showDismiss, setShowDismiss] = React.useState(false);
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    setDismissed(false);
    setShowDismiss(false);
    setOpen(false);
  }, [resetKey]);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setShowDismiss(true);
    }, 3000);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    setShowDismiss(false);
  };

  React.useEffect(
    () => () => {
      clearTimeout(hoverTimerRef.current);
    },
    [],
  );

  const scrollLock = React.useRef(false);
  const scrollLockTimer =
    React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    setActiveId((prev) =>
      sections.some((s) => s.id === prev) ? prev : sections[0]?.id,
    );
  }, [sections]);

  React.useEffect(() => {
    const scroller = containerRef?.current ?? window;

    const update = () => {
      if (scrollLock.current) return;
      const anchor =
        (containerRef?.current?.getBoundingClientRect().top ?? 0) + offset;
      const active = sections.findLast(({ id }) => {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        return top !== undefined && top <= anchor;
      });
      setActiveId(active?.id ?? sections[0]?.id);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections, containerRef, offset]);

  const label =
    sections.find((s) => s.id === activeId)?.label ??
    sections[0]?.label ??
    "Workspace";

  const labelVersion = React.useRef(0);
  const prevLabel = React.useRef(label);
  if (label !== prevLabel.current) {
    prevLabel.current = label;
    labelVersion.current += 1;
  }

  const collapsedRef = React.useRef<HTMLDivElement>(null);
  const openRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const [collapsedSize, setCollapsedSize] = React.useState<Size>();
  const [openSize, setOpenSize] = React.useState<Size>();
  const [labelWidth, setLabelWidth] = React.useState<number>();

  useIsoLayoutEffect(() => {
    const measure = () => {
      if (labelRef.current) setLabelWidth(labelRef.current.offsetWidth);
      if (collapsedRef.current) {
        setCollapsedSize({
          width: collapsedRef.current.offsetWidth,
          height: collapsedRef.current.offsetHeight,
        });
      }
      if (openRef.current) {
        setOpenSize({
          width: openRef.current.offsetWidth,
          height: openRef.current.offsetHeight,
        });
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (labelRef.current) ro.observe(labelRef.current);
    if (collapsedRef.current) ro.observe(collapsedRef.current);
    if (openRef.current) ro.observe(openRef.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [sections, label, percent, showDismiss]);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => () => clearTimeout(scrollLockTimer.current), []);

  const selectSection = (id: string, index: number) => {
    scrollLock.current = true;
    clearTimeout(scrollLockTimer.current);
    scrollLockTimer.current = setTimeout(
      () => {
        scrollLock.current = false;
      },
      reduceMotion ? 0 : 700,
    );

    setActiveId(id);
    setOpen(false);
    onSelectSection?.(id, index);

    const targetEl = document.getElementById(id);
    const scrollerEl = containerRef?.current;
    if (targetEl && scrollerEl && scrollerEl.contains(targetEl)) {
      const top =
        targetEl.getBoundingClientRect().top -
        scrollerEl.getBoundingClientRect().top +
        scrollerEl.scrollTop;
      scrollerEl.scrollTo({
        top: Math.max(0, top - 16),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    } else if (targetEl) {
      targetEl.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  if (dismissed) return null;

  const size = open ? openSize : collapsedSize;
  const radius = open ? 24 : (collapsedSize?.height ?? 38) / 2;
  const squircle = "[corner-shape:squircle]";

  return (
    <div
      ref={rootRef}
      data-slot="scroll-progress"
      className={cn("fixed bottom-5 left-1/2 z-40 -translate-x-1/2", className)}
      {...props}
    >
      {/* Hidden measurement ghosts */}
      <div className="pointer-events-none invisible absolute" aria-hidden>
        <div
          ref={collapsedRef}
          className="inline-flex items-center gap-2.5 py-2 pl-3 pr-3.5"
        >
          <span className="h-5 w-5" />
          <span
            ref={labelRef}
            className="whitespace-nowrap text-xs font-semibold leading-none"
          >
            {label}
          </span>
          <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
            100%
          </span>
          {showDismiss && <span className="h-5 w-6" />}
        </div>
        <div ref={openRef} className="w-max max-h-[300px] p-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-3.5 py-2 text-xs font-semibold leading-none"
            >
              <span className="h-2 w-2" />
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {size && (
        <motion.div
          data-slot="scroll-progress-surface"
          data-testid="scroll-progress-pill"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden border border-white/15 bg-[#1C1E21]/95 text-white shadow-2xl backdrop-blur-md dark:border-white/20 dark:bg-[#0D1117]/95",
            squircle,
          )}
          initial={false}
          animate={{
            width: Math.max(size.width, 160),
            height: Math.max(size.height, 38),
            borderRadius: radius,
          }}
          transition={reduceMotion ? { duration: 0 } : SIZE_SPRING}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {open ? (
              <motion.ul
                key="list"
                className="absolute inset-0 flex flex-col overflow-y-auto p-2"
                initial={{
                  opacity: 0,
                  filter: reduceMotion ? undefined : "blur(4px)",
                }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: reduceMotion ? undefined : "blur(4px)",
                }}
                transition={LAYER_FADE}
              >
                {sections.map((s, i) => {
                  const isActive = s.id === activeId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => selectSection(s.id, i)}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2 text-left text-xs font-semibold leading-none transition-colors cursor-pointer",
                          squircle,
                          isActive
                            ? "text-[#14171A]"
                            : "text-white/70 hover:text-white",
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId={`${layoutId}-active`}
                            className={cn(
                              "absolute inset-0 rounded-[14px] bg-[#93C5FD]",
                              squircle,
                            )}
                            transition={
                              reduceMotion ? { duration: 0 } : SIZE_SPRING
                            }
                          />
                        )}
                        <motion.span
                          className={cn(
                            "relative h-2 w-2 shrink-0 rounded-full",
                            isActive ? "bg-[#14171A]" : "bg-[#FDE047]",
                          )}
                        />
                        <motion.span className="relative whitespace-nowrap">
                          {s.label}
                        </motion.span>
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            ) : (
              <motion.div
                key="pill"
                className="absolute inset-0 flex items-center justify-between gap-2 py-2 pl-3 pr-2.5"
                initial={{
                  opacity: 0,
                  filter: reduceMotion ? undefined : "blur(4px)",
                }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: reduceMotion ? undefined : "blur(4px)",
                }}
                transition={LAYER_FADE}
              >
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Show scroll progress sections"
                  className="flex flex-1 items-center justify-between gap-2.5 cursor-pointer text-left"
                >
                  <span className="shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9.5"
                        fill="none"
                        strokeWidth="2.75"
                        className="stroke-white/20"
                      />
                      <motion.circle
                        cx="12"
                        cy="12"
                        r="9.5"
                        fill="none"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                        className="stroke-[#93C5FD]"
                        style={{ pathLength: progress }}
                      />
                    </svg>
                  </span>

                  <span
                    className="relative h-5 shrink-0"
                    style={{ width: labelWidth }}
                  >
                    <AnimatePresence initial={false}>
                      {label && (
                        <motion.span
                          key={labelVersion.current}
                          data-slot="scroll-progress-label"
                          className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap text-xs font-semibold leading-none text-white"
                          initial={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, filter: "blur(1.5px)" }
                          }
                          animate={{ opacity: 1, filter: "blur(0px)" }}
                          exit={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, filter: "blur(1.5px)" }
                          }
                          transition={LABEL_CROSSFADE}
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>

                  <span className="rounded-full bg-[#FDE047] px-2 py-0.5 font-mono text-[10px] font-bold text-[#14171A] tabular-nums">
                    {percent}%
                  </span>
                </button>

                {/* Appears after hovering consecutively for 3 seconds */}
                <AnimatePresence>
                  {showDismiss && (
                    <motion.button
                      key="dismiss"
                      type="button"
                      aria-label="Hide scroll indicator"
                      data-testid="scroll-progress-dismiss"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDismissed(true);
                      }}
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-white/15 text-white/85 hover:bg-white/25 hover:text-white cursor-pointer"
                    >
                      <X className="size-3" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export { ScrollProgress };
export default ScrollProgress;
