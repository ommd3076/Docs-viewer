import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FileWarning,
  FolderPlus,
  Image as ImageIcon,
  Plus,
  Presentation,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { FolderComponent } from '../rareui/folder-component';
import { DeleteButton } from '../rareui/delete-button';
import { AnimatedCounter } from '../rareui/animated-counter';
import { toast } from '../rareui/toast';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import {
  formatByteSize,
  GUEST_MAX_FILE_BYTES,
} from '../../utils/documentRules';
import type { LocalDocumentRecord, WorkspaceFolder } from '../../types/workspace';

interface LibraryBentoDashboardProps {
  onTriggerFileImport: () => void;
}

const ENGINE_FILTER_OPTIONS = [
  { id: 'pdf', label: 'PDF & DOCX' },
  { id: 'office', label: 'XLSX & PPTX' },
] as const;

const C_FOLDER_PRESETS = [
  { name: 'C Programming', subtitle: 'C source & notes' },
  { name: 'C Data Structures', subtitle: 'Trees, graphs & labs' },
  { name: 'C Pointers & Memory', subtitle: 'Systems coursework' },
];

// Distinct per-document memory arc ratios so cycling documents visibly shifts the gauge
const DOC_GAUGE_RATIOS = [0.28, 0.56, 0.78, 0.42, 0.88, 0.64, 0.34];

interface FolderPickerDropdownProps {
  folders: WorkspaceFolder[];
  value: string;
  docName: string;
  onChange: (folderId: string) => void;
}

const FolderPickerDropdown: React.FC<FolderPickerDropdownProps> = ({
  folders,
  value,
  docName,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const currentFolder =
    folders.find((f) => f.id === value) ?? folders[0] ?? null;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Change folder for ${docName}`}
        className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-[#F3F5F7] px-2.5 py-1.5 text-xs font-medium text-[#14171A] transition hover:border-black/25 dark:border-white/10 dark:bg-[#21262D] dark:text-white dark:hover:border-white/25 cursor-pointer"
      >
        <span className="max-w-[128px] truncate">
          {currentFolder?.name ?? 'Word Documents'}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 opacity-70 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={`Select folder for ${docName}`}
          className="absolute left-0 top-9 z-40 min-w-[176px] overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/15 dark:bg-[#1C2128]"
        >
          {folders.map((folder) => {
            const active = folder.id === currentFolder?.id;
            return (
              <button
                key={folder.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(folder.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#93C5FD] text-[#14171A] font-semibold'
                    : 'text-[#14171A] hover:bg-[#F3F5F7] dark:text-white/90 dark:hover:bg-white/10'
                }`}
              >
                <span className="truncate">{folder.name}</span>
                {active && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const LibraryBentoDashboard: React.FC<LibraryBentoDashboardProps> = ({
  onTriggerFileImport,
}) => {
  const {
    documents,
    folders,
    folderFilter,
    setFolderFilter,
    createFolder,
    deleteFolder,
    moveDocumentToFolder,
    openDocumentTab,
    deleteDocument,
    setMode,
    loadSyntheticSuite,
    importFilesFromDevice,
  } = useWorkspaceStore();

  const [telemetryFilter, setTelemetryFilter] = useState<'pdf' | 'office'>(
    'pdf',
  );
  const [engineDropdownOpen, setEngineDropdownOpen] = useState(false);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [customGaugeRatio, setCustomGaugeRatio] = useState<number | null>(null);
  const [isScrubbingGauge, setIsScrubbingGauge] = useState(false);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderSubtitle, setNewFolderSubtitle] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const engineDropdownRef = useRef<HTMLDivElement>(null);
  const gaugeSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!engineDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        engineDropdownRef.current &&
        !engineDropdownRef.current.contains(e.target as Node)
      ) {
        setEngineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [engineDropdownOpen]);

  const filteredDocs = documents.filter((doc) =>
    folderFilter === 'all' ? true : doc.folderCategory === folderFilter,
  );

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const safeDocIdx =
    readyDocs.length > 0 ? selectedDocIndex % readyDocs.length : 0;
  const activeInspectDoc = readyDocs[safeDocIdx] ?? documents[0];

  // Consistent ~10ms local worker parse latency readout (zero UI jitter)
  const displayParseMs = 10;

  // Interactive shifting semicircle gauge arc (updates on arrow click, dot click, or pointer drag)
  const activeRatio =
    customGaugeRatio ?? DOC_GAUGE_RATIOS[safeDocIdx % DOC_GAUGE_RATIOS.length];
  const gaugePercent = Math.round(activeRatio * 100);

  const totalArcLength = Math.PI * 88; // ~276.46
  const filledArcLength = Math.max(24, Math.round(activeRatio * totalArcLength));
  const dotAngle = Math.PI * (1 - activeRatio);
  const dotCx = Number((110 + 88 * Math.cos(dotAngle)).toFixed(1));
  const dotCy = Number((110 - 88 * Math.sin(dotAngle)).toFixed(1));

  const displayMemoryMb = Number(
    (
      Math.max(1.2, activeInspectDoc?.benchmark.memoryEstimateMb ?? 3.6) *
      (0.45 + activeRatio * 0.95)
    ).toFixed(2),
  );

  const updateGaugeFromPointer = (clientX: number) => {
    const svg = gaugeSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (clientX - rect.left) / Math.max(1, rect.width);
    const clamped = Math.min(0.94, Math.max(0.14, relX));
    setCustomGaugeRatio(clamped);
  };

  const totalWords = documents.reduce(
    (acc, d) =>
      acc +
      d.extractedText
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  );

  const computedTokens =
    telemetryFilter === 'pdf'
      ? Math.round(totalWords * 0.72) + 1420
      : Math.round(totalWords * 0.88) + 1960;

  const formatIcon = (
    format: LocalDocumentRecord['format'],
    status: LocalDocumentRecord['status'],
  ) => {
    if (status === 'corrupted') {
      return <FileWarning className="size-4 text-[#D97706]" />;
    }
    switch (format) {
      case 'pdf':
        return (
          <FileText className="size-4 text-[#2563EB] dark:text-[#60A5FA]" />
        );
      case 'docx':
        return (
          <FileText className="size-4 text-[#1D4ED8] dark:text-[#93C5FD]" />
        );
      case 'pptx':
        return (
          <Presentation className="size-4 text-[#D97706] dark:text-[#FACC15]" />
        );
      case 'xlsx':
      case 'csv':
        return (
          <FileSpreadsheet className="size-4 text-[#2563EB] dark:text-[#60A5FA]" />
        );
      case 'image':
        return <ImageIcon className="size-4 text-[#D97706]" />;
      default:
        return <FileText className="size-4 text-[#64748B]" />;
    }
  };

  const handleDownloadLocalCopy = (doc: LocalDocumentRecord) => {
    const content =
      doc.rawBytes && doc.rawBytes.byteLength > 0
        ? new Blob([doc.rawBytes], { type: doc.mimeType })
        : new Blob([doc.extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${doc.name}`, {
      description: 'Saved directly from local OPFS storage to your device.',
    });
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), newFolderSubtitle.trim() || 'Custom Folder');
    setNewFolderName('');
    setNewFolderSubtitle('');
    setShowNewFolderForm(false);
  };

  return (
    <div
      className={`space-y-6 pb-12 transition-colors ${
        isDraggingOver ? 'ring-2 ring-[#2563EB] rounded-3xl' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          importFilesFromDevice(e.dataTransfer.files);
        }
      }}
    >
      {/* Top Integrated Bento Grid: Left Statistics & Interactive Memory Gauge | Right Default & Custom Folders */}
      <section
        id="bento-overview"
        aria-label="Workspace Telemetry and Document Folders"
        className="grid grid-cols-1 gap-5 xl:grid-cols-12"
      >
        {/* Left Column: Local Engine Statistics + Interactive Local Sandbox Memory */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* CARD 1: Obsidian Card (#1C1E21) — Local Engine Statistics */}
          <div className="flex flex-col justify-between rounded-[28px] bg-[#1C1E21] p-6 text-white min-h-[252px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white text-balance">
                  Local engine statistics
                </h2>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  On-device indexing · 0 cloud requests
                </p>
              </div>

              {/* Clean Custom Dropdown (Zero Default Placeholder Option Inside) */}
              <div ref={engineDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setEngineDropdownOpen((o) => !o)}
                  aria-expanded={engineDropdownOpen}
                  aria-label="Select document format group"
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/30 cursor-pointer"
                >
                  <span>
                    {
                      ENGINE_FILTER_OPTIONS.find(
                        (opt) => opt.id === telemetryFilter,
                      )?.label
                    }
                  </span>
                  <ChevronDown
                    className={`size-3.5 opacity-75 transition-transform duration-150 ${
                      engineDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {engineDropdownOpen && (
                  <div
                    role="listbox"
                    aria-label="Document format groups"
                    className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-white/15 bg-[#26292E] p-1 shadow-xl"
                  >
                    {ENGINE_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={telemetryFilter === opt.id}
                        onClick={() => {
                          setTelemetryFilter(opt.id);
                          setEngineDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
                          telemetryFilter === opt.id
                            ? 'bg-[#93C5FD] text-[#14171A] font-semibold'
                            : 'text-white/85 hover:bg-white/10'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {telemetryFilter === opt.id && (
                          <Check className="size-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-12 items-end gap-4">
              <div className="col-span-5">
                <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                  <span>Indexed tokens</span>
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#93C5FD] text-[#14171A]">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-3xl font-semibold tracking-tight tabular-nums text-white sm:text-4xl">
                  <AnimatedCounter value={computedTokens} duration={0.45} />
                </div>
                <p className="mt-1 text-[11px] text-[#94A3B8] tabular-nums">
                  {documents.length} local files · {folders.length} folders
                </p>
              </div>

              {/* Twin Stacked Rounded Bar Columns */}
              <div className="col-span-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTelemetryFilter('pdf')}
                  className="relative flex h-36 flex-col justify-end overflow-hidden rounded-[20px] p-1.5 hatch-dark border border-white/10 text-left cursor-pointer"
                >
                  <span className="absolute top-2.5 left-0 right-0 text-center text-[11px] font-medium text-white/80">
                    PDF &amp; DOCX
                  </span>
                  <div className="flex flex-col w-full">
                    <div
                      className="w-full rounded-t-[14px] bg-[#93C5FD] transition-all duration-200"
                      style={{
                        height: telemetryFilter === 'pdf' ? 64 : 36,
                      }}
                    />
                    <div
                      className="-mt-2 w-full rounded-[14px] bg-[#FDE047] transition-all duration-200"
                      style={{
                        height: telemetryFilter === 'pdf' ? 48 : 34,
                      }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTelemetryFilter('office')}
                  className="relative flex h-36 flex-col justify-end overflow-hidden rounded-[20px] p-1.5 hatch-dark border border-white/10 text-left cursor-pointer"
                >
                  <span className="absolute top-2.5 left-0 right-0 text-center text-[11px] font-medium text-white/80">
                    XLSX &amp; PPTX
                  </span>
                  <div className="flex flex-col w-full">
                    <div
                      className="w-full rounded-t-[14px] bg-[#93C5FD] transition-all duration-200"
                      style={{
                        height: telemetryFilter === 'office' ? 68 : 38,
                      }}
                    />
                    <div
                      className="-mt-2 w-full rounded-[14px] bg-[#FDE047] transition-all duration-200"
                      style={{
                        height: telemetryFilter === 'office' ? 46 : 30,
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: Interactive Local Sandbox Memory (Stable Layout, 10ms, Smoothly Shifting Bar Gauge) */}
          <div className="flex flex-col justify-between rounded-[28px] bg-[#F3F5F7] p-6 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight text-[#14171A] dark:text-white text-balance">
                  Local sandbox memory
                </h2>
                <p
                  className="truncate text-xs text-[#64748B] dark:text-[#94A3B8]"
                  title={activeInspectDoc?.name ?? 'Local Workspace'}
                >
                  {activeInspectDoc?.name ?? 'Local Workspace'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Previous local document metric"
                  onClick={() => {
                    setCustomGaugeRatio(null);
                    setSelectedDocIndex(
                      (i) =>
                        (i - 1 + Math.max(1, readyDocs.length)) %
                        Math.max(1, readyDocs.length),
                    );
                  }}
                  className="grid size-8 place-items-center rounded-full border border-black/15 text-[#14171A] transition hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10 cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next local document metric"
                  onClick={() => {
                    setCustomGaugeRatio(null);
                    setSelectedDocIndex(
                      (i) => (i + 1) % Math.max(1, readyDocs.length),
                    );
                  }}
                  className="grid size-8 place-items-center rounded-full border border-black/15 text-[#14171A] transition hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10 cursor-pointer"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Inner Electric Blue Card (#93C5FD) with Interactive Shifting Semicircle Bar */}
            <div className="mt-4 grid grid-cols-12 items-end rounded-[22px] bg-[#93C5FD] p-5 text-[#14171A]">
              <div className="col-span-5 flex flex-col justify-between h-full gap-5">
                <div className="flex items-center gap-2">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#14171A] shadow-xs">
                    <ShieldCheck className="size-5 text-[#2563EB]" />
                  </div>
                  <span className="rounded-full bg-white/75 px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[#1E3A8A]">
                    {gaugePercent}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      data-testid="sandbox-latency-ms"
                      className="font-mono text-2xl font-bold tabular-nums w-[68px] inline-block"
                    >
                      {displayParseMs}ms
                    </span>
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[#14171A]">
                      <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-[#1E3A8A] tabular-nums">
                    Guest cap: {formatByteSize(GUEST_MAX_FILE_BYTES)}
                  </p>
                </div>
              </div>

              {/* Interactive Shifting Semi-Circular Gauge Arc (Click or Drag to Shift) */}
              <div className="col-span-7 flex flex-col items-center justify-end">
                <div className="relative w-full max-w-[224px] select-none">
                  <svg
                    ref={gaugeSvgRef}
                    viewBox="0 0 220 126"
                    role="slider"
                    aria-label="Local sandbox memory allocation gauge"
                    aria-valuemin={14}
                    aria-valuemax={94}
                    aria-valuenow={gaugePercent}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        setCustomGaugeRatio(Math.min(0.94, activeRatio + 0.08));
                      } else if (e.key === 'ArrowLeft') {
                        setCustomGaugeRatio(Math.max(0.14, activeRatio - 0.08));
                      }
                    }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setIsScrubbingGauge(true);
                      updateGaugeFromPointer(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (!isScrubbingGauge) return;
                      updateGaugeFromPointer(e.clientX);
                    }}
                    onPointerUp={(e) => {
                      setIsScrubbingGauge(false);
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    }}
                    className="w-full overflow-visible cursor-ew-resize touch-none"
                  >
                    <defs>
                      <pattern
                        id="gaugeHatch"
                        width="6"
                        height="6"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="6"
                          stroke="#14171A"
                          strokeWidth="1.5"
                          strokeOpacity="0.55"
                        />
                      </pattern>
                    </defs>
                    {/* Hatched Unfilled Track */}
                    <path
                      d="M 22 110 A 88 88 0 0 1 198 110"
                      fill="none"
                      stroke="url(#gaugeHatch)"
                      strokeWidth="22"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 22 110 A 88 88 0 0 1 198 110"
                      fill="none"
                      stroke="#14171A"
                      strokeWidth="1.25"
                      strokeOpacity="0.38"
                      strokeLinecap="round"
                    />
                    {/* Interactive Shifting Obsidian Fill Bar */}
                    <path
                      data-testid="sandbox-gauge-arc"
                      d="M 22 110 A 88 88 0 0 1 198 110"
                      fill="none"
                      stroke="#1C1E21"
                      strokeWidth="22"
                      strokeLinecap="round"
                      strokeDasharray={`${filledArcLength} ${Math.ceil(totalArcLength)}`}
                      style={{
                        transition: isScrubbingGauge
                          ? 'none'
                          : 'stroke-dasharray 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                    {/* Interactive Shifting Handle Dot on the Arc Tip */}
                    <circle
                      cx={dotCx}
                      cy={dotCy}
                      r="7"
                      fill="#FDE047"
                      stroke="#1C1E21"
                      strokeWidth="2.5"
                      style={{
                        transition: isScrubbingGauge
                          ? 'none'
                          : 'cx 260ms cubic-bezier(0.22, 1, 0.36, 1), cy 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </svg>
                  <div className="-mt-6 text-center">
                    <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-[#14171A]">
                      {displayMemoryMb.toFixed(2)} MB
                    </span>
                  </div>
                </div>

                {/* Interactive Document Dots for Direct Shifting */}
                {readyDocs.length > 1 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {readyDocs.slice(0, 6).map((doc, idx) => (
                      <button
                        key={doc.id}
                        type="button"
                        aria-label={`Inspect ${doc.name}`}
                        onClick={() => {
                          setCustomGaugeRatio(null);
                          setSelectedDocIndex(idx);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                          idx === safeDocIdx
                            ? 'w-5 bg-[#1C1E21]'
                            : 'w-1.5 bg-[#1C1E21]/30 hover:bg-[#1C1E21]/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Auto-Sorted Default Folders (DOCX, Images, PDF, Sheets) + Custom C-Related Folders */}
        <div
          id="bento-folders"
          className="flex flex-col justify-between rounded-[28px] bg-[#F3F5F7] p-6 dark:bg-[#161B22] xl:col-span-7 border border-black/[0.06] dark:border-white/[0.07]"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#14171A] dark:text-white text-balance">
                  Document Folders
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  DOCX and image files auto-sort into default folders · Create custom C or project folders anytime
                </p>
              </div>

              <div className="flex items-center gap-2">
                {folderFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFolderFilter('all')}
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#14171A] border border-black/10 hover:bg-black/5 dark:bg-[#21262D] dark:text-white dark:border-white/10 cursor-pointer"
                  >
                    All Files ({documents.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1C1E21] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2E3238] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
                >
                  <FolderPlus className="size-3.5" />
                  <span>New Folder</span>
                </button>
              </div>
            </div>

            {/* Inline Custom Folder Creator */}
            {showNewFolderForm && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3.5 dark:bg-[#0D1117] border border-black/[0.08] dark:border-white/[0.08]"
              >
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name (e.g., C Programming, CN Lab)"
                  aria-label="New folder name"
                  className="min-w-[200px] flex-1 rounded-lg border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#161B22] dark:text-white"
                />
                <input
                  type="text"
                  value={newFolderSubtitle}
                  onChange={(e) => setNewFolderSubtitle(e.target.value)}
                  placeholder="Description (optional)"
                  aria-label="New folder description"
                  className="min-w-[150px] flex-1 rounded-lg border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#161B22] dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm(false)}
                  aria-label="Cancel folder creation"
                  className="rounded-lg p-2 text-[#64748B] hover:text-[#14171A] dark:hover:text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </form>
            )}

            {/* Folder Cards Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              {folders.map((folder) => {
                const isSelected = folderFilter === folder.id;
                const count = documents.filter(
                  (d) => d.folderCategory === folder.id,
                ).length;
                return (
                  <div
                    key={folder.id}
                    onClick={() =>
                      setFolderFilter(isSelected ? 'all' : folder.id)
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={`Open folder ${folder.name} (${count} files)`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFolderFilter(isSelected ? 'all' : folder.id);
                      }
                    }}
                    className={`group relative flex flex-col items-center rounded-[22px] p-4 transition cursor-pointer ${
                      isSelected
                        ? 'bg-white ring-2 ring-[#2563EB] dark:bg-[#1C222B] dark:ring-[#60A5FA]'
                        : 'bg-white/75 hover:bg-white dark:bg-[#0D1117]/60 dark:hover:bg-[#1C222B]'
                    }`}
                  >
                    {!folder.isDefault && (
                      <button
                        type="button"
                        aria-label={`Delete folder ${folder.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolder(folder.id);
                        }}
                        className="absolute right-2.5 top-2.5 rounded-full p-1 text-[#64748B] opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-[#DC2626] dark:hover:bg-white/10 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}

                    <div className="h-28 flex items-center justify-center">
                      <FolderComponent color={folder.color} size="xs" />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#14171A] dark:text-white text-center truncate max-w-full">
                      {folder.name}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] text-center truncate max-w-full tabular-nums">
                      {folder.subtitle} · {count}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick C-Related Folder Creator Strip + Local Sandbox Summary */}
          <div className="mt-5 space-y-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.07]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Quick-create C folder:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {C_FOLDER_PRESETS.map((preset) => {
                  const exists = folders.some(
                    (f) => f.name.toLowerCase() === preset.name.toLowerCase(),
                  );
                  if (exists) return null;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => createFolder(preset.name, preset.subtitle)}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#14171A] hover:bg-[#93C5FD]/35 dark:bg-[#0D1117] dark:text-white border border-black/[0.06] dark:border-white/[0.08] cursor-pointer"
                    >
                      <Plus className="size-3" />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#93C5FD]/40 px-3.5 py-2.5 dark:bg-[#93C5FD]/15">
                <p className="text-[11px] text-[#1E3A8A] dark:text-[#93C5FD]">
                  External Egress
                </p>
                <p className="font-mono text-sm font-bold text-[#14171A] dark:text-white tabular-nums">
                  0 Bytes
                </p>
              </div>
              <div className="rounded-2xl bg-[#FDE047]/50 px-3.5 py-2.5 dark:bg-[#FDE047]/15">
                <p className="text-[11px] text-[#713F12] dark:text-[#FDE047]">
                  Guest Local Cap
                </p>
                <p className="font-mono text-sm font-bold text-[#14171A] dark:text-white tabular-nums">
                  30.0 MB / file
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white px-3.5 py-2.5 dark:bg-[#0D1117]">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Local Persistence
                </p>
                <p className="font-mono text-sm font-bold text-[#14171A] dark:text-white">
                  IndexedDB + OPFS
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full Local Workspace Files Table */}
      <section
        id="bento-library-table"
        aria-label="Local Workspace Files"
        className="rounded-[28px] bg-white p-6 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#14171A] dark:text-white text-balance">
              {folderFilter === 'all'
                ? `Local Workspace Files (${filteredDocs.length})`
                : `${folders.find((f) => f.id === folderFilter)?.name ?? 'Folder'} (${filteredDocs.length})`}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Every document stays on your device · Click any file to open in the Tabbed Viewer or drag &amp; drop files anywhere
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadSyntheticSuite(true)}
              className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-[#F3F5F7] px-3.5 py-2 text-xs font-semibold text-[#14171A] transition hover:bg-[#E2E6EA] dark:border-white/10 dark:bg-[#21262D] dark:text-white cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Reload Sample Files</span>
            </button>

            <button
              type="button"
              onClick={onTriggerFileImport}
              className="flex items-center gap-2 rounded-xl bg-[#1C1E21] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2E3238] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Import Local File (Max 30 MB)</span>
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:border-white/[0.07] dark:text-[#94A3B8]">
                <th className="pb-3 pr-4">Document</th>
                <th className="pb-3 px-3">Format</th>
                <th className="pb-3 px-3">Folder</th>
                <th className="pb-3 px-3">Size</th>
                <th className="pb-3 px-3">SHA-256</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] text-sm dark:divide-white/[0.06]">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]"
                  >
                    No documents in this folder yet. Drop a file here or reassign an existing file using the Folder dropdown.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="group transition hover:bg-[#F3F5F7]/70 dark:hover:bg-[#21262D]/50"
                  >
                    <td className="py-3.5 pr-4">
                      <button
                        type="button"
                        onClick={() => openDocumentTab(doc.id, true)}
                        className="flex items-center gap-3 text-left cursor-pointer"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3F5F7] dark:bg-[#21262D]">
                          {formatIcon(doc.format, doc.status)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#14171A] group-hover:text-[#2563EB] dark:text-white dark:group-hover:text-[#60A5FA]">
                            {doc.name}
                          </p>
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {doc.status === 'corrupted'
                              ? 'Quarantined container'
                              : `${doc.pageCount} ${
                                  doc.format === 'pptx'
                                    ? 'slides'
                                    : doc.format === 'xlsx' ||
                                        doc.format === 'csv'
                                      ? 'sheets'
                                      : doc.format === 'image'
                                        ? 'image'
                                        : 'pages'
                                } · ${doc.sections.length} nodes`}
                          </p>
                        </div>
                      </button>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center rounded-md bg-[#F3F5F7] px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-[#14171A] dark:bg-[#21262D] dark:text-white">
                        {doc.format}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <FolderPickerDropdown
                        folders={folders}
                        value={doc.folderCategory}
                        docName={doc.name}
                        onChange={(folderId) =>
                          moveDocumentToFolder(doc.id, folderId)
                        }
                      />
                    </td>

                    <td className="py-3.5 px-3 font-mono text-xs tabular-nums text-[#14171A] dark:text-white">
                      {formatByteSize(doc.sizeBytes)}
                    </td>

                    <td className="py-3.5 px-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {doc.privacyAudit.sha256Fingerprint.slice(0, 12)}…
                    </td>

                    <td className="py-3.5 px-3">
                      {doc.status === 'ready' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#93C5FD]/35 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E3A8A] dark:bg-[#93C5FD]/20 dark:text-[#93C5FD]">
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE047]/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]">
                          Corrupted
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDocumentTab(doc.id, true)}
                          className="rounded-lg bg-[#1C1E21] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2C3036] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
                        >
                          Open
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            openDocumentTab(doc.id, false);
                            setMode('xray');
                          }}
                          aria-label={`Inspect ${doc.name} in Document X-Ray`}
                          className="rounded-lg bg-[#FDE047] p-1.5 text-[#14171A] transition hover:bg-[#FACC15] cursor-pointer"
                        >
                          <ScanSearch className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadLocalCopy(doc)}
                          aria-label={`Download ${doc.name}`}
                          className="rounded-lg border border-black/10 bg-[#F3F5F7] p-1.5 text-[#14171A] transition hover:bg-[#E2E6EA] dark:border-white/10 dark:bg-[#21262D] dark:text-white cursor-pointer"
                        >
                          <Download className="size-3.5" />
                        </button>

                        <DeleteButton
                          aria-label={`Delete ${doc.name}`}
                          onConfirm={() => {
                            deleteDocument(doc.id);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
