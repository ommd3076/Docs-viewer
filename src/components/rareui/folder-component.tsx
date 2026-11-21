/**
 * Rare UI — Folder Component
 * Copyright (c) 2026 Swami Malode (https://rareui.com)
 * Enhanced with amber/yellow & slate themes + accessible button trigger for VaultDocs collections
 */

import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const themes = {
  black: {
    backFill: "#1C1E21",
    backInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.37 0",
    backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.25)",
    flapFill: "#292D32",
    flapFillOpacity: 0.45,
    flapStroke: "#64748B",
    flapInsetColor: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0",
    cardFill: "#F8FAFC",
    cardStroke: "#E2E8F0",
    cardLineFill: "#93C5FD",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
  },
  white: {
    backFill: "#FFFFFF",
    backInsetColor: "0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0.25 0",
    backInsetShadow: "inset 0 0 6px 2px rgba(148,163,184,0.25)",
    flapFill: "#F1F5F9",
    flapFillOpacity: 0.85,
    flapStroke: "#CBD5E1",
    flapInsetColor: "0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0.15 0",
    cardFill: "#1E293B",
    cardStroke: "#334155",
    cardLineFill: "#FACC15",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0",
  },
  blue: {
    backFill: "#3B82F6",
    backInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0",
    backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.35)",
    flapFill: "#2563EB",
    flapFillOpacity: 0.55,
    flapStroke: "#93C5FD",
    flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0",
    cardFill: "#F8FAFC",
    cardStroke: "#DBEAFE",
    cardLineFill: "#93C5FD",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
  },
  amber: {
    backFill: "#FACC15",
    backInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0",
    backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.45)",
    flapFill: "#EAB308",
    flapFillOpacity: 0.5,
    flapStroke: "#FEF08A",
    flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0",
    cardFill: "#1C1E21",
    cardStroke: "#334155",
    cardLineFill: "#FDE047",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.2 0",
  },
} as const;

const sizeScales = {
  xs: 0.38,
  sm: 0.55,
  md: 1,
  lg: 1.35,
} as const;

type FolderComponentProps = Omit<React.ComponentProps<"div">, "color"> & {
  color?: "black" | "white" | "blue" | "amber";
  size?: "xs" | "sm" | "md" | "lg";
  onFolderSelect?: () => void;
};

const BASE_WIDTH = 321;
const BASE_HEIGHT = 270;

const FLAP_PATH =
  "M0 25C0 11.1929 11.1929 0 25 0H136.084C143.044 0 149.689 2.90139 154.42 8.00608L178.08 33.5343C182.811 38.639 189.456 41.5404 196.416 41.5404H296C309.807 41.5404 321 52.7333 321 66.5404V216C321 229.807 309.807 241 296 241H25C11.1929 241 0 229.807 0 216V25Z";

const FolderComponent = ({
  color = "blue",
  size = "sm",
  onFolderSelect,
  className,
  ...props
}: FolderComponentProps) => {
  const theme = themes[color] ?? themes.blue;
  const scale = sizeScales[size];
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div
      data-slot="folder"
      className={cn(
        "relative flex items-center justify-center",
        className,
      )}
      {...props}
    >
      <div
        className="relative cursor-pointer select-none"
        style={{
          width: BASE_WIDTH * scale,
          height: BASE_HEIGHT * scale,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsOpen(false);
        }}
        onClick={() => {
          setIsOpen((o) => !o);
          onFolderSelect?.();
        }}
      >
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
            perspective: 800 * scale,
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                borderRadius: 25,
                backgroundColor: theme.backFill,
                boxShadow: theme.backInsetShadow,
              }}
            />
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? -160 : isHovered ? -30 : -10,
                x: isOpen ? 70 : 40,
                rotate: isOpen ? 18 : isHovered ? 14 : 10,
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 120,
                      damping: 13,
                      delay: isOpen ? 0.1 : isHovered ? 0.12 : 0,
                    }
              }
            >
              <Card id={`1-${color}`} theme={theme} />
            </motion.div>
            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? -180 : isHovered ? -35 : -20,
                x: isOpen ? 0 : 3,
                rotate: isOpen ? -3 : isHovered ? -1 : 2,
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 120,
                      damping: 13,
                      delay: isOpen ? 0.05 : isHovered ? 0.06 : 0,
                    }
              }
            >
              <Card id={`2-${color}`} theme={theme} />
            </motion.div>
            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? -170 : isHovered ? -44 : -22,
                x: isOpen ? -65 : -40,
                rotate: isOpen ? -14 : isHovered ? -9 : -5,
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 120,
                      damping: 13,
                    }
              }
            >
              <Card id={`3-${color}`} theme={theme} />
            </motion.div>
          </div>

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-4"
            style={{
              transformOrigin: "bottom center",
              transformStyle: "preserve-3d",
              width: 321,
              height: 241,
            }}
            animate={{ rotateX: isOpen ? -55 : isHovered ? -45 : -15 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 120, damping: 14 }
            }
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                clipPath: `path('${FLAP_PATH}')`,
                WebkitClipPath: `path('${FLAP_PATH}')`,
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                willChange: "transform",
              }}
            />
            <svg
              className="absolute inset-0"
              width="321"
              height="241"
              viewBox="0 0 321 241"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g>
                <path
                  d={FLAP_PATH}
                  fill={theme.flapFill}
                  fillOpacity={theme.flapFillOpacity}
                />
                <path
                  d="M25 0.5H136.084C142.905 0.5 149.417 3.3431 154.054 8.3457L177.713 33.874C182.539 39.0808 189.317 42.04 196.416 42.04H296C309.531 42.04 320.5 53.0092 320.5 66.54V216C320.5 229.531 309.531 240.5 296 240.5H25C11.469 240.5 0.5 229.531 0.5 216V25C0.5 11.469 11.469 0.5 25 0.5Z"
                  stroke={theme.flapStroke}
                />
              </g>
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FolderComponent;
export { FolderComponent, FolderComponent as Folder };
export type { FolderComponentProps };

type Theme = (typeof themes)[keyof typeof themes];

const Card = ({ id, theme }: { id: string; theme: Theme }) => {
  return (
    <div data-slot="folder-card">
      <svg
        width="164"
        height="214"
        viewBox="0 0 164 214"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          width="163.078"
          height="213.262"
          rx="20"
          fill={theme.cardFill}
        />
        <rect
          x="0.5"
          y="0.5"
          width="162.078"
          height="212.262"
          rx="19.5"
          stroke={theme.cardStroke}
        />
        <rect
          x="14.1193"
          y="31.2091"
          width="134.84"
          height="11.8892"
          rx="5.94459"
          fill={theme.cardLineFill}
        />
        <rect x="14.8" y="61" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.65" />
        <rect x="84.4" y="61" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.65" />
        <rect x="14.8" y="75" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.5" />
        <rect x="84.4" y="75" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.5" />
        <rect x="14.8" y="89" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.4" />
        <rect x="84.4" y="89" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.4" />
        <rect x="14.8" y="103" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.3" />
        <rect x="84.4" y="103" width="64.5" height="5.88" rx="2.94" fill={theme.cardLineFill} opacity="0.3" />
      </svg>
    </div>
  );
};
