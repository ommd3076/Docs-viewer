/**
 * Rare UI — Bounce Sidebar
 * Copyright (c) 2026 Swami Malode (https://rareui.com)
 * Adapted for React + Vite SPA (removed next/link dependency, added Blue/Yellow accent default & icons)
 */

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { arc } from "motion";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type BounceSidebarItem =
  | string
  | { id?: string; label: string; href?: string; icon?: ReactNode; count?: number | string }
  | { label: string; heading: true };

export type BounceSidebarProps = Omit<ComponentProps<"ul">, "onChange"> & {
  items: BounceSidebarItem[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  dotColor?: string;
};

export function BounceSidebar({
  items,
  value,
  defaultValue = 0,
  onChange,
  dotColor = "#3B82F6",
  className,
  ...props
}: BounceSidebarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeIndex = value ?? internalValue;
  const reducedMotion = useReducedMotion();

  const [dot, animate] = useAnimate<HTMLSpanElement>();
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const prevY = useRef<number | null>(null);

  const [dotSize, setDotSize] = useState(7);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    setDotSize(Math.round(7 * dpr) / dpr);
  }, []);

  useIsomorphicLayoutEffect(() => {
    let cancelled = false;
    const snap = () => {
      const el = itemRefs.current[activeIndex];
      if (cancelled || !el || !dot.current) return;
      const dpr = window.devicePixelRatio || 1;
      const size = Math.round(7 * dpr) / dpr;
      const toY =
        Math.round((el.offsetTop + el.offsetHeight / 2 - size / 2) * dpr) / dpr;
      animate(dot.current, { x: 0, y: toY }, { duration: 0 });
      prevY.current = toY;
      setReady(true);
    };

    snap();
    const raf = requestAnimationFrame(snap);
    document.fonts?.ready.then(snap).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el || !dot.current) return;

    const dpr = window.devicePixelRatio || 1;
    const toY =
      Math.round((el.offsetTop + el.offsetHeight / 2 - dotSize / 2) * dpr) /
      dpr;

    if (prevY.current === null || reducedMotion) {
      animate(dot.current, { x: 0, y: toY }, { duration: 0 });
      prevY.current = toY;
      return;
    }

    const fromY = prevY.current;
    const delta = toY - fromY;
    prevY.current = toY;
    if (delta === 0) return;

    const distance = Math.abs(delta);
    const path = arc({
      strength: Math.min(0.8, 14 / distance),
      direction: delta > 0 ? "ccw" : "cw",
    });

    animate(
      dot.current,
      { x: 0, y: toY },
      { duration: 0.25, ease: "easeOut", path },
    );
  }, [activeIndex, animate, dot, dotSize, reducedMotion]);

  const select = (index: number) => {
    if (value === undefined) setInternalValue(index);
    onChange?.(index);
  };

  return (
    <ul
      data-slot="bounce-sidebar"
      className={cn("relative flex flex-col gap-1 pl-6", className)}
      {...props}
    >
      <span
        ref={dot}
        aria-hidden
        className="absolute left-1.5 top-0 rounded-full transition-opacity duration-150"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: dotColor,
          opacity: ready ? 1 : 0,
        }}
      />

      {items.map((item, index) => {
        const label = typeof item === "string" ? item : item.label;

        if (typeof item !== "string" && "heading" in item) {
          return (
            <li
              key={`${index}-${label}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="presentation"
              data-slot="bounce-sidebar-heading"
              className="px-2 pb-1 pt-5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] first:pt-0"
            >
              {label}
            </li>
          );
        }

        const href = typeof item === "string" ? undefined : item.href;
        const icon = typeof item === "string" ? undefined : item.icon;
        const count = typeof item === "string" ? undefined : item.count;
        const isActive = index === activeIndex;
        const itemClassName = cn(
          "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]",
          isActive
            ? "bg-[#14171A]/[0.06] text-[#14171A] dark:bg-white/[0.08] dark:text-white font-semibold"
            : "text-[#14171A]/60 hover:text-[#14171A] hover:bg-[#14171A]/[0.03] dark:text-white/60 dark:hover:text-white dark:hover:bg-white/[0.04]",
        );

        return (
          <li
            key={`${index}-${label}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
          >
            {href ? (
              <motion.a
                href={href}
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                onClick={(e) => {
                  e.preventDefault();
                  select(index);
                }}
                className={itemClassName}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {icon}
                  <span className="truncate">{label}</span>
                </span>
                {count !== undefined && (
                  <span className="font-mono text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {count}
                  </span>
                )}
              </motion.a>
            ) : (
              <motion.button
                type="button"
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                onClick={() => select(index)}
                className={itemClassName}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {icon}
                  <span className="truncate">{label}</span>
                </span>
                {count !== undefined && (
                  <span className="font-mono text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {count}
                  </span>
                )}
              </motion.button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
