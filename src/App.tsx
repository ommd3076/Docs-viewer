import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  FolderKanban,
  GitCompare,
  ScanSearch,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { GooeyNav } from './components/rareui/gooey-nav';
import { NotificationBell } from './components/rareui/notification-bell';
import { ScrollProgress } from './components/rareui/scroll-progress';
import { Toaster, toast } from './components/rareui/toast';
import ThemeSwitch from './components/pinui/ThemeSwitch';
import { WorkspaceSidebar } from './components/navigation/WorkspaceSidebar';
import { LibraryBentoDashboard } from './components/library/LibraryBentoDashboard';
import { DocumentViewerWorkspace } from './components/viewer/DocumentViewerWorkspace';
import { InfiniteDocumentCanvas } from './components/canvas/InfiniteDocumentCanvas';
import { DocumentXRayView } from './components/xray/DocumentXRayView';
import { DocumentCompareView } from './components/compare/DocumentCompareView';
import { CommandSearchModal } from './components/modals/CommandSearchModal';
import { WorkspaceSettingsModal } from './components/modals/WorkspaceSettingsModal';
import { OfflineIndicator } from './components/pwa/PWAInstallButton';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { formatByteSize } from './utils/documentRules';
import type { WorkspaceMode } from './types/workspace';

const MODES: { id: WorkspaceMode; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'viewer', label: 'Viewer' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'xray', label: 'X-Ray' },
  { id: 'compare', label: 'Compare' },
];

const LIBRARY_SCROLL_SECTIONS = [
  { id: 'bento-overview', label: 'Overview & Memory' },
  { id: 'bento-folders', label: 'Document Folders' },
  { id: 'bento-library-table', label: 'Workspace Files' },
];

export default function App() {
  const {
    initializeWorkspace,
    mode,
    setMode,
    documents,
    importFilesFromDevice,
    setCommandPaletteOpen,
    theme,
    setTheme,
  } = useWorkspaceStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bellCount, setBellCount] = useState(3);
  const [bellFeedOpen, setBellFeedOpen] = useState(false);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Keep notification count synced with document imports
  useEffect(() => {
    if (documents.length > 0) {
      setBellCount((prev) => Math.max(prev, documents.length));
    }
  }, [documents.length]);

  // Run local background indexing inside Web Worker when documents change
  useEffect(() => {
    if (documents.length === 0 || typeof Worker === 'undefined') return;
    try {
      const worker = new Worker(
        new URL('./workers/documentIndex.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.postMessage({
        type: 'INDEX_DOCUMENTS',
        documents: documents.map((d) => ({
          id: d.id,
          name: d.name,
          extractedText: d.extractedText,
          sectionCount: d.sections.length,
        })),
      });
      return () => worker.terminate();
    } catch {
      // Fallback if Worker initialization is restricted
    }
  }, [documents]);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const activeModeIndex = Math.max(
    0,
    MODES.findIndex((m) => m.id === mode),
  );

  return (
    <div className="min-h-screen bg-[#DCE1E5] text-[#14171A] dark:bg-[#0D1117] dark:text-[#F0F4F8] flex flex-col">
      {/* Hidden Multi-Format Local File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.md,.json,.c,.h,.png,.jpg,.jpeg,.svg,.webp"
        aria-label="Import local document files"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            importFilesFromDevice(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Unified Single-Row Top Header */}
      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#F3F5F7]/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#161B22]/95">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          {/* Left: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setMode('library');
            }}
            className="text-lg font-bold tracking-tight text-[#14171A] whitespace-nowrap shrink-0 dark:text-white"
          >
            VaultDocs
          </a>

          {/* Center: Unified Interactive Mode Switcher */}
          <div className="overflow-x-auto max-w-full py-0.5">
            <GooeyNav
              items={[
                { label: 'Library', icon: <FolderKanban className="size-3.5" /> },
                { label: 'Viewer', icon: <BookOpen className="size-3.5" /> },
                { label: 'Canvas', icon: <Compass className="size-3.5" /> },
                { label: 'X-Ray', icon: <ScanSearch className="size-3.5" /> },
                { label: 'Compare', icon: <GitCompare className="size-3.5" /> },
              ]}
              value={activeModeIndex}
              onChange={(idx) => {
                const target = MODES[idx];
                if (target) setMode(target.id);
              }}
              size="sm"
              activeColor="#1C1E21"
              activeLabelColor="#FDE047"
            />
          </div>

          {/* Right: Search, Activity Bell, PinUI Theme Switch & Primary Import CTA */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open Local Workspace Search"
              className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium text-[#475569] transition hover:text-[#14171A] dark:border-white/10 dark:bg-[#0D1117] dark:text-[#94A3B8] dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="size-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#14171A] dark:bg-white/10 dark:text-white">
                ⌘K
              </kbd>
            </button>

            <div className="relative">
              <NotificationBell
                count={bellCount}
                size={36}
                color="blue"
                onClick={() => setBellFeedOpen((o) => !o)}
                title="Local Workspace Activity"
              />

              {bellFeedOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-[24px] border border-black/10 bg-white p-4 shadow-2xl dark:border-white/15 dark:bg-[#161B22]">
                  <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#2563EB] dark:text-[#60A5FA]" />
                      <span className="text-xs font-bold text-[#14171A] dark:text-white">
                        Workspace Activity ({bellCount})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBellFeedOpen(false)}
                      className="text-[11px] font-semibold text-[#64748B] hover:text-[#14171A] dark:hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                    {documents.slice(0, 5).map((d) => (
                      <div
                        key={d.id}
                        className="rounded-xl bg-[#F3F5F7] p-2.5 text-xs dark:bg-[#21262D]"
                      >
                        <p className="font-semibold text-[#14171A] dark:text-white truncate">
                          {d.name}
                        </p>
                        <p className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          {d.format.toUpperCase()} · {formatByteSize(d.sizeBytes)} · Local
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setBellCount(0);
                        setBellFeedOpen(false);
                        toast.info('Activity notifications cleared');
                      }}
                      className="rounded-xl bg-[#F3F5F7] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:text-[#14171A] dark:bg-[#21262D] dark:text-[#94A3B8] cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Minimal Sun/Moon Theme Switch with Smooth Radial Transition */}
            <ThemeSwitch
              variant="topbar"
              theme={theme}
              onThemeChange={(next) => setTheme(next)}
            />

            <button
              type="button"
              onClick={triggerFilePicker}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1E21] rounded-xl hover:bg-[#2E3238] transition-colors whitespace-nowrap shrink-0 dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
            >
              <Upload className="size-3.5 text-[#FDE047] dark:text-[#0D1117]" />
              <span>Import File</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace Container: Auto-Contracting Left Sidebar + Active Workspace View */}
      <div
        id="top"
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row"
      >
        <WorkspaceSidebar />

        <main className="min-w-0 flex-1">
          {mode === 'library' && (
            <LibraryBentoDashboard onTriggerFileImport={triggerFilePicker} />
          )}
          {mode === 'viewer' && (
            <DocumentViewerWorkspace onTriggerFileImport={triggerFilePicker} />
          )}
          {mode === 'canvas' && <InfiniteDocumentCanvas />}
          {mode === 'xray' && <DocumentXRayView />}
          {mode === 'compare' && <DocumentCompareView />}
        </main>
      </div>

      {/* Floating Scroll Progress Pill on Library Dashboard */}
      {mode === 'library' && (
        <ScrollProgress
          sections={LIBRARY_SCROLL_SECTIONS}
          offset={180}
          resetKey={mode}
        />
      )}

      {/* Clean Minimal Footer */}
      <footer className="mt-auto border-t border-black/[0.06] bg-[#F3F5F7]/70 px-6 py-3.5 text-xs text-[#64748B] dark:border-white/[0.06] dark:bg-[#161B22]/70 dark:text-[#94A3B8]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <p>VaultDocs · Local-First Document Workspace</p>
          <p className="font-mono text-[11px]">
            Zero Cloud Uploads · IndexedDB + OPFS
          </p>
        </div>
      </footer>

      {/* Universal Modals, Offline Status & Notification Stack */}
      <CommandSearchModal />
      <WorkspaceSettingsModal />
      <OfflineIndicator />
      <Toaster position="bottom-right" />
    </div>
  );
}
