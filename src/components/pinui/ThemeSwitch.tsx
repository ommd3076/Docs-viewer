"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  createThemeSwitch,
  type EffectName,
  type ThemeName,
  type ThemeSwitchEngine,
} from "./theme-switch-engine";
import "./theme-switch.css";

export type ThemeSwitchProps = {
  /** The theme the scene shows. A change from outside lands at once. */
  theme?: ThemeName;
  /** Called with the new theme once a switch commits. */
  onThemeChange?: (theme: ThemeName) => void;
  /** Which effect is chosen to begin with (only used in full "card" variant). */
  defaultEffect?: EffectName;
  /** Called when another effect is picked (only used in full "card" variant). */
  onEffectChange?: (effect: EffectName) => void;
  /** Diwali sound (only used in full "card" variant). */
  sound?: boolean;
  /** Take the container's whole box (only used in full "card" variant). */
  fill?: boolean;
  /** Minimal Sun/Moon topbar toggle or full interactive card. */
  variant?: "card" | "topbar";
};

const EFFECTS: { value: EffectName; label: string }[] = [
  { value: "droplet", label: "Droplet" },
  { value: "rain", label: "Rain" },
  { value: "diwali", label: "Diwali" },
];

const ICON_EASE = [0.22, 1, 0.36, 1] as const;

type ViewTransitionDoc = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

function MinimalTopbarThemeSwitch({
  theme,
  onThemeChange,
}: {
  theme: ThemeName;
  onThemeChange?: (theme: ThemeName) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const isDark = theme === "dark";

  const handleToggle = () => {
    const next: ThemeName = isDark ? "light" : "dark";
    const doc = document as ViewTransitionDoc;

    if (
      reduceMotion ||
      typeof doc.startViewTransition !== "function" ||
      !buttonRef.current
    ) {
      document.documentElement.classList.add("theme-transitioning");
      onThemeChange?.(next);
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 320);
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        onThemeChange?.(next);
      });
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 440,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // Ignore if transition is interrupted
      });
  };

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
      whileTap={reduceMotion ? undefined : { scale: 0.91 }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="topbar-theme-toggle"
      data-theme={theme}
      className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/10 bg-white text-[#14171A] transition-colors duration-200 hover:bg-[#F3F5F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-white/10 dark:bg-[#0D1117] dark:text-[#FDE047] dark:hover:bg-[#1C2128] cursor-pointer"
    >
      {/* Moon Icon (shown in light mode — click for dark) */}
      <motion.svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="col-start-1 row-start-1"
        initial={false}
        animate={
          isDark
            ? { opacity: 0, rotate: -90, scale: 0.55 }
            : { opacity: 1, rotate: 0, scale: 1 }
        }
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { duration: 0.38, ease: ICON_EASE }
        }
      >
        <path
          d="M20.985 12.486C20.8913 14.2221 20.2967 15.894 19.2731 17.2994C18.2495 18.7048 16.8407 19.7837 15.217 20.4055C13.5934 21.0274 11.8243 21.1656 10.1238 20.8035C8.42322 20.4414 6.86395 19.5945 5.63446 18.3652C4.40497 17.1358 3.55789 15.5766 3.19562 13.8761C2.83334 12.1756 2.97139 10.4065 3.59308 8.78282C4.21476 7.15909 5.29346 5.75019 6.69877 4.72644C8.10409 3.70268 9.77586 3.1079 11.512 3.014C11.917 2.992 12.129 3.474 11.914 3.817C11.1949 4.96755 10.887 6.32787 11.0405 7.67595C11.1949 9.02403 11.7999 10.2803 12.7593 11.2397C13.7187 12.1991 14.975 12.805 16.323 12.9585C17.6711 13.112 19.0314 12.8041 20.182 12.085C20.526 11.87 21.007 12.081 20.985 12.486Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>

      {/* Sun Icon (shown in dark mode — click for light) */}
      <motion.svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="col-start-1 row-start-1"
        initial={false}
        animate={
          isDark
            ? { opacity: 1, rotate: 0, scale: 1 }
            : { opacity: 0, rotate: 90, scale: 0.55 }
        }
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { duration: 0.38, ease: ICON_EASE }
        }
      >
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34" />
        </g>
      </motion.svg>
    </motion.button>
  );
}

export default function ThemeSwitch({
  theme = "light",
  onThemeChange,
  defaultEffect = "droplet",
  onEffectChange,
  sound = true,
  fill = false,
  variant = "card",
}: ThemeSwitchProps) {
  if (variant === "topbar") {
    return (
      <MinimalTopbarThemeSwitch theme={theme} onThemeChange={onThemeChange} />
    );
  }

  return (
    <FullCardThemeSwitch
      theme={theme}
      onThemeChange={onThemeChange}
      defaultEffect={defaultEffect}
      onEffectChange={onEffectChange}
      sound={sound}
      fill={fill}
    />
  );
}

function FullCardThemeSwitch({
  theme = "light",
  onThemeChange,
  defaultEffect = "droplet",
  onEffectChange,
  sound = true,
  fill = false,
}: Omit<ThemeSwitchProps, "variant">) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThemeSwitchEngine | null>(null);
  const [effect, setEffect] = useState<EffectName>(defaultEffect);
  const name = useId();

  const effectRef = useRef(effect);
  const soundRef = useRef(sound);
  const onThemeChangeRef = useRef(onThemeChange);
  useEffect(() => {
    effectRef.current = effect;
    soundRef.current = sound;
    onThemeChangeRef.current = onThemeChange;
  }, [effect, sound, onThemeChange]);

  useEffect(() => {
    const root = rootRef.current;
    const button = buttonRef.current;
    const fx = fxRef.current;
    if (!root || !button || !fx) return;
    const engine = createThemeSwitch({
      root,
      button,
      fx,
      effect: () => effectRef.current,
      sound: () => soundRef.current,
      onCommit: (next) => onThemeChangeRef.current?.(next),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || engineRef.current?.busy()) return;
    root.dataset.theme = theme;
    buttonRef.current?.setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
    );
  }, [theme]);

  useEffect(() => {
    if (effect !== "diwali") return;
    const run = () => engineRef.current?.prepare();
    if (window.requestIdleCallback) {
      const idle = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(run, 200);
    return () => window.clearTimeout(timer);
  }, [effect]);

  const pick = (value: EffectName) => {
    setEffect(value);
    onEffectChange?.(value);
  };

  return (
    <div
      ref={rootRef}
      className="pts"
      data-theme={theme}
      data-effect={effect}
      data-fill={fill || undefined}
    >
      <div className="pts__stage">
        <button
          ref={buttonRef}
          type="button"
          className="pts__toggle"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <svg
            className="pts__icon pts__icon--moon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20.985 12.486C20.8913 14.2221 20.2967 15.894 19.2731 17.2994C18.2495 18.7048 16.8407 19.7837 15.217 20.4055C13.5934 21.0274 11.8243 21.1656 10.1238 20.8035C8.42322 20.4414 6.86395 19.5945 5.63446 18.3652C4.40497 17.1358 3.55789 15.5766 3.19562 13.8761C2.83334 12.1756 2.97139 10.4065 3.59308 8.78282C4.21476 7.15909 5.29346 5.75019 6.69877 4.72644C8.10409 3.70268 9.77586 3.1079 11.512 3.014C11.917 2.992 12.129 3.474 11.914 3.817C11.1949 4.96755 10.887 6.32787 11.0405 7.67595C11.1949 9.02403 11.7999 10.2803 12.7593 11.2397C13.7187 12.1991 14.975 12.805 16.323 12.9585C17.6711 13.112 19.0314 12.8041 20.182 12.085C20.526 11.87 21.007 12.081 20.985 12.486Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg
            className="pts__icon pts__icon--sun"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <g
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34" />
            </g>
          </svg>
        </button>

        <fieldset className="pts__effects" data-pts-target="">
          <legend className="pts__sr">Theme switch effect</legend>
          <span className="pts__thumb" aria-hidden="true" />
          {EFFECTS.map((option) => (
            <label key={option.value} className="pts__option">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={effect === option.value}
                onChange={() => pick(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div ref={fxRef} className="pts__fx" aria-hidden="true" />
    </div>
  );
}
