"use client"

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"

type Side = "left" | "right"
type SectionKind = "title" | "subtitle" | "section" | "body"
type SectionLevel = 1 | 2 | 3 | 4 | 5 | 6

export type ProximitySection = {
  id: string
  label: string
  kind?: SectionKind
  level?: SectionLevel
}

type DashPreset = {
  base: number
  bump: number
  thickness: number
  idleClass: string
  activeClass: string
}

type DashProps = {
  active: boolean
  mouseY: MotionValue<number>
  onSelect: (id: string) => void
  onHoverChange: (section: ProximitySection | null) => void
  registerDash: (id: string, node: HTMLButtonElement | null) => void
  section: ProximitySection
  sectionKind: SectionKind
  side: Side
}

type ProximitySidebarProps = {
  activeOffset?: number
  className?: string
  sections: ProximitySection[]
  side?: Side
  containerRef?: React.RefObject<HTMLElement | null>
  onSelectSection?: (id: string, index: number) => void
}

const RADIUS = 42
const MAX_DASH_WIDTH = 96
const SCROLL_IDLE_RESET_DELAY = 90

const DASH_PRESETS: Record<SectionKind, DashPreset> = {
  title: {
    base: 42,
    bump: 52,
    thickness: 3,
    idleClass: "bg-[#14171A]/75 dark:bg-white/80",
    activeClass: "bg-[#2563EB] dark:bg-[#60A5FA]",
  },
  subtitle: {
    base: 36,
    bump: 48,
    thickness: 2.5,
    idleClass: "bg-[#14171A]/60 dark:bg-white/65",
    activeClass: "bg-[#2563EB] dark:bg-[#60A5FA]",
  },
  section: {
    base: 28,
    bump: 44,
    thickness: 2,
    idleClass: "bg-[#64748B]/60 dark:bg-[#94A3B8]/55",
    activeClass: "bg-[#2563EB] dark:bg-[#60A5FA]",
  },
  body: {
    base: 22,
    bump: 38,
    thickness: 2,
    idleClass: "bg-[#64748B]/45 dark:bg-[#94A3B8]/40",
    activeClass: "bg-[#2563EB] dark:bg-[#60A5FA]",
  },
}

const getSectionElement = (id: string) =>
  typeof document === "undefined" ? null : document.getElementById(id)

const getSectionKind = (section: ProximitySection): SectionKind => {
  if (section.kind) return section.kind
  if (section.level === 1) return "title"
  if (section.level === 2) return "subtitle"
  if (section.level === 3) return "section"
  return "body"
}

const Dash = ({
  active,
  mouseY,
  onSelect,
  onHoverChange,
  registerDash,
  section,
  sectionKind,
  side,
}: DashProps) => {
  const ref = useRef<HTMLButtonElement>(null)
  const preset = DASH_PRESETS[sectionKind]
  const activeWidth = Math.min(MAX_DASH_WIDTH, preset.base + preset.bump)

  useEffect(() => {
    registerDash(section.id, ref.current)
    return () => registerDash(section.id, null)
  }, [registerDash, section.id])

  const distance = useTransform(mouseY, (y) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return RADIUS
    return y - (rect.top + rect.height / 2)
  })

  const targetScaleX = useTransform(
    distance,
    [-RADIUS, 0, RADIUS],
    [
      (active ? Math.min(MAX_DASH_WIDTH, preset.base + 14) : preset.base) /
        MAX_DASH_WIDTH,
      activeWidth / MAX_DASH_WIDTH,
      (active ? Math.min(MAX_DASH_WIDTH, preset.base + 14) : preset.base) /
        MAX_DASH_WIDTH,
    ],
    { clamp: true }
  )

  const scaleX = useSpring(targetScaleX, {
    stiffness: 340,
    damping: 32,
    mass: 0.65,
  })

  return (
    <button
      ref={ref}
      type="button"
      aria-current={active ? "location" : undefined}
      aria-label={`Go to ${section.label}`}
      title={section.label}
      className="group flex h-3.5 w-[96px] items-center border-0 bg-transparent p-0 outline-none cursor-pointer"
      onClick={() => onSelect(section.id)}
      onPointerEnter={() => onHoverChange(section)}
      onFocus={() => onHoverChange(section)}
    >
      <motion.span
        className={`block rounded-full transition-colors duration-150 ease-out group-hover:bg-[#2563EB] dark:group-hover:bg-[#60A5FA] group-focus-visible:ring-2 group-focus-visible:ring-[#2563EB] ${
          active ? preset.activeClass : preset.idleClass
        }`}
        style={{
          height: active ? preset.thickness + 0.75 : preset.thickness,
          scaleX,
          transformOrigin: side === "left" ? "left center" : "right center",
          width: MAX_DASH_WIDTH,
        }}
      />
    </button>
  )
}

const ProximitySidebar = ({
  activeOffset = 0.32,
  className = "",
  side = "left",
  sections,
  containerRef,
  onSelectSection,
}: ProximitySidebarProps) => {
  const mouseY = useMotionValue(Infinity)
  const shouldReduceMotion = useReducedMotion()
  const dashRefs = useRef(new Map<string, HTMLButtonElement>())
  const pointerInside = useRef(false)
  const resetTimer = useRef<number | null>(null)
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const [hoveredSection, setHoveredSection] = useState<ProximitySection | null>(
    null
  )

  const sectionIds = useMemo(
    () => sections.map((section) => section.id).join("|"),
    [sections]
  )

  useEffect(() => {
    setActiveId(sections[0]?.id)
  }, [sectionIds, sections])

  const registerDash = useCallback(
    (id: string, node: HTMLButtonElement | null) => {
      if (node) {
        dashRefs.current.set(id, node)
        return
      }
      dashRefs.current.delete(id)
    },
    []
  )

  const clearPendingReset = useCallback(() => {
    if (!resetTimer.current) return
    window.clearTimeout(resetTimer.current)
    resetTimer.current = null
  }, [])

  const setMouseToDash = useCallback(
    (id?: string) => {
      if (!id) {
        mouseY.set(Infinity)
        return
      }
      const node = dashRefs.current.get(id)
      if (!node) return
      const rect = node.getBoundingClientRect()
      mouseY.set(rect.top + rect.height / 2)
    },
    [mouseY]
  )

  const pulseDash = useCallback(
    (id?: string) => {
      setMouseToDash(id)
      clearPendingReset()
      if (!id || pointerInside.current) return
      resetTimer.current = window.setTimeout(() => {
        mouseY.set(Infinity)
        resetTimer.current = null
      }, SCROLL_IDLE_RESET_DELAY)
    },
    [clearPendingReset, mouseY, setMouseToDash]
  )

  const selectSection = useCallback(
    (id: string) => {
      const idx = sections.findIndex((s) => s.id === id)
      setActiveId(id)
      pulseDash(id)

      if (onSelectSection && idx !== -1) {
        onSelectSection(id, idx)
        return
      }

      const element = getSectionElement(id)
      const scroller = containerRef?.current
      if (element && scroller && scroller.contains(element)) {
        const top =
          element.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
        scroller.scrollTo({
          top: Math.max(0, top - 12),
          behavior: shouldReduceMotion ? "auto" : "smooth",
        })
      } else if (element) {
        element.scrollIntoView({
          behavior: shouldReduceMotion ? "auto" : "smooth",
          block: "start",
        })
      }
    },
    [containerRef, onSelectSection, pulseDash, sections, shouldReduceMotion]
  )

  useEffect(() => () => clearPendingReset(), [clearPendingReset])

  useEffect(() => {
    if (!sections.length) return

    let frame = 0
    const scroller = containerRef?.current

    const updateActiveSection = () => {
      frame = 0

      const viewportRect = scroller
        ? scroller.getBoundingClientRect()
        : { top: 0, height: window.innerHeight }
      const anchorY = viewportRect.top + viewportRect.height * activeOffset

      let nextActiveId = sections[0]?.id
      let shortestDistance = Number.POSITIVE_INFINITY

      for (const section of sections) {
        const element = getSectionElement(section.id)
        if (!element) continue

        const rect = element.getBoundingClientRect()
        const containsAnchor = rect.top <= anchorY && rect.bottom >= anchorY
        const distance = containsAnchor
          ? 0
          : Math.min(
              Math.abs(rect.top - anchorY),
              Math.abs(rect.bottom - anchorY)
            )

        if (distance < shortestDistance) {
          shortestDistance = distance
          nextActiveId = section.id
        }
      }

      if (nextActiveId) {
        setActiveId(nextActiveId)
        if (!pointerInside.current) {
          pulseDash(nextActiveId)
        }
      }
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveSection)
    }

    const scrollTarget: EventTarget = scroller ?? window
    updateActiveSection()
    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      scrollTarget.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [activeOffset, containerRef, pulseDash, sectionIds, sections])

  const displaySection =
    hoveredSection ??
    sections.find((s) => s.id === activeId) ??
    sections[0] ??
    null

  if (sections.length === 0) {
    return (
      <div className="px-2 py-4 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        No sections indexed.
      </div>
    )
  }

  return (
    <nav
      aria-label="Document minimap"
      data-testid="document-minimap"
      className={`flex flex-col gap-3 py-1 ${className}`}
    >
      {/* Active or Hovered Section Readout */}
      {displaySection && (
        <div className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-[#14171A] dark:bg-[#0D1117]/90 dark:text-white border border-black/[0.06] dark:border-white/[0.08] truncate">
          <span className="inline-block size-1.5 rounded-full bg-[#2563EB] dark:bg-[#60A5FA] mr-1.5 align-middle" />
          <span className="align-middle">{displaySection.label}</span>
        </div>
      )}

      <div
        className={`flex flex-col px-2 py-1 ${
          side === "right" ? "items-end" : "items-start"
        }`}
        style={{ gap: 2 }}
        onPointerMove={(event) => {
          clearPendingReset()
          pointerInside.current = true
          mouseY.set(event.clientY)
        }}
        onPointerLeave={() => {
          pointerInside.current = false
          mouseY.set(Infinity)
          setHoveredSection(null)
        }}
      >
        {sections.map((section) => (
          <Dash
            key={section.id}
            active={section.id === activeId}
            mouseY={mouseY}
            onSelect={selectSection}
            onHoverChange={setHoveredSection}
            registerDash={registerDash}
            section={section}
            sectionKind={getSectionKind(section)}
            side={side}
          />
        ))}
      </div>
    </nav>
  )
}

export default ProximitySidebar
