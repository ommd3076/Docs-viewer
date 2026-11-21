import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Sparkles,
  X,
} from 'lucide-react';
import { HookSidebar } from '../rareui/hook-sidebar';
import { toast } from '../rareui/toast';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import {
  formatByteSize,
  GUEST_MAX_FILE_BYTES,
} from '../../utils/documentRules';
import type { LocalDocumentRecord } from '../../types/workspace';

export const WorkspaceSidebar: React.FC = () => {
  const {
    mode,
    setMode,
    folders,
    folderFilter,
    setFolderFilter,
    createFolder,
    documents,
    activeDocId,
    openDocumentTab,
    reducedMotion,
    setReducedMotion,
    userAccount,
    setAccountModalOpen,
  } = useWorkspaceStore();

  // Auto-expand on Homepage (library), auto-contract into icon-only rail on Viewer/Canvas/X-Ray/Compare
  const [isCollapsed, setIsCollapsed] = useState(mode !== 'library');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickFolderName, setQuickFolderName] = useState('');

  useEffect(() => {
    setIsCollapsed(mode !== 'library');
  }, [mode]);

  const collectionItems: {
    key: string;
    label: string;
    badge: number;
  }[] = [
    {
      key: 'all',
      label: 'All Local Files',
      badge: documents.length,
    },
    ...folders.map((folder) => ({
      key: folder.id,
      label: folder.name,
      badge: documents.filter((d) => d.folderCategory === folder.id).length,
    })),
  ];

  const activeCollectionIndex = Math.max(
    0,
    collectionItems.findIndex((c) => c.key === folderFilter),
  );

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const activeDocIndex = Math.max(
    0,
    readyDocs.findIndex((d) => d.id === activeDocId),
  );

  const totalLocalBytes = documents.reduce((acc, d) => acc + d.sizeBytes, 0);

  const handleQuickCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFolderName.trim()) return;
    createFolder(quickFolderName.trim(), 'Custom Folder');
    setQuickFolderName('');
    setQuickCreateOpen(false);
    setMode('library');
  };

  const getFolderIcon = (key: string, active: boolean) => {
    if (key === 'all') return <Layers className="size-4" />;
    if (key === 'images') return <ImageIcon className="size-4" />;
    if (key === 'office') return <FileSpreadsheet className="size-4" />;
    return active ? (
      <FolderOpen className="size-4" />
    ) : (
      <Folder className="size-4" />
    );
  };

  const getDocIcon = (format: LocalDocumentRecord['format']) => {
    switch (format) {
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="size-4" />;
      case 'pptx':
        return <Presentation className="size-4" />;
      case 'image':
        return <ImageIcon className="size-4" />;
      default:
        return <FileText className="size-4" />;
    }
  };

  // Compact Icon-Only Rail Mode (Auto-active outside Library homepage)
  if (isCollapsed) {
    return (
      <aside
        aria-label="Compact Workspace Rail"
        data-testid="workspace-sidebar-rail"
        data-collapsed="true"
        className="flex w-full lg:w-16 lg:sticky lg:top-20 lg:self-start shrink-0 flex-row lg:flex-col items-center justify-between gap-2 rounded-[24px] bg-[#F3F5F7] p-2.5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07] transition-[width] duration-200"
      >
        <div className="flex flex-row lg:flex-col items-center gap-2 overflow-x-auto lg:overflow-visible">
          {/* Expand Rail Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#14171A] hover:bg-[#93C5FD]/40 dark:bg-[#0D1117] dark:text-white dark:hover:bg-[#21262D] border border-black/[0.06] dark:border-white/[0.07] transition cursor-pointer"
          >
            <PanelLeftOpen className="size-4" />
          </button>

          <div className="hidden lg:block h-px w-7 bg-black/10 dark:bg-white/10 my-0.5" />

          {/* Folder Icon Buttons */}
          {collectionItems.slice(0, 6).map((item) => {
            const active = folderFilter === item.key && mode === 'library';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setFolderFilter(item.key);
                  setMode('library');
                }}
                aria-label={`${item.label} (${item.badge})`}
                title={`${item.label} (${item.badge})`}
                className={`relative grid size-10 shrink-0 place-items-center rounded-xl transition cursor-pointer ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-xs dark:bg-[#60A5FA] dark:text-[#0D1117]'
                    : 'bg-white/80 text-[#475569] hover:bg-white hover:text-[#14171A] dark:bg-[#0D1117]/80 dark:text-[#94A3B8] dark:hover:bg-[#21262D] dark:hover:text-white'
                }`}
              >
                {getFolderIcon(item.key, active)}
                {item.badge > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-[16px] h-4 place-items-center rounded-full bg-[#1C1E21] px-1 font-mono text-[9px] font-bold text-white dark:bg-[#FDE047] dark:text-[#14171A]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="hidden lg:block h-px w-7 bg-black/10 dark:bg-white/10 my-0.5" />

          {/* Quick Open Document Icons */}
          {readyDocs.slice(0, 5).map((doc) => {
            const isCurrent = doc.id === activeDocId && mode === 'viewer';
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => openDocumentTab(doc.id, true)}
                aria-label={`Open ${doc.name}`}
                title={doc.name}
                className={`grid size-10 shrink-0 place-items-center rounded-xl transition cursor-pointer ${
                  isCurrent
                    ? 'bg-[#93C5FD] text-[#14171A] shadow-xs'
                    : 'bg-white/60 text-[#64748B] hover:bg-white hover:text-[#14171A] dark:bg-[#0D1117]/60 dark:text-[#94A3B8] dark:hover:bg-[#21262D] dark:hover:text-white'
                }`}
              >
                {getDocIcon(doc.format)}
              </button>
            );
          })}
        </div>

        {/* Bottom Compact Storage & Motion Icons */}
        <div className="flex flex-row lg:flex-col items-center gap-1.5 pt-0 lg:pt-2 lg:border-t lg:border-black/[0.06] lg:dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => setAccountModalOpen(true)}
            aria-label="Local Storage and Backup Settings"
            title={`Local Storage (${formatByteSize(totalLocalBytes)} used)`}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80 text-[#D97706] hover:bg-white dark:bg-[#0D1117]/80 dark:text-[#FACC15] dark:hover:bg-[#21262D] transition cursor-pointer"
          >
            <HardDrive className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !reducedMotion;
              setReducedMotion(next);
              toast.info(
                next ? 'Reduced Motion Enabled' : 'Fluid Motion Active',
              );
            }}
            aria-label="Toggle Reduced Motion"
            aria-pressed={reducedMotion}
            title={reducedMotion ? 'Motion: Reduced' : 'Motion: Fluid'}
            className={`grid size-10 shrink-0 place-items-center rounded-xl transition cursor-pointer ${
              reducedMotion
                ? 'bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA]'
                : 'bg-white/80 text-[#64748B] hover:text-[#14171A] dark:bg-[#0D1117]/80 dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <Sparkles className="size-4" />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded Full Sidebar Mode (Auto-active on Library homepage)
  return (
    <aside
      aria-label="Workspace Folders and Quick Access"
      data-testid="workspace-sidebar-rail"
      data-collapsed="false"
      className="flex w-full lg:w-68 lg:sticky lg:top-20 lg:self-start shrink-0 flex-col gap-5 rounded-[28px] bg-[#F3F5F7] p-5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07] transition-[width] duration-200"
    >
      <div className="space-y-4">
        {/* Sidebar Header with Contract Toggle */}
        <div className="flex items-center justify-between px-0.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Workspace
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse sidebar to icon rail"
            title="Collapse to icon rail"
            className="grid size-7 place-items-center rounded-lg text-[#64748B] hover:bg-black/5 hover:text-[#14171A] dark:text-[#94A3B8] dark:hover:bg-white/10 dark:hover:text-white transition cursor-pointer"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Dynamic Local Folders Rail */}
        <div className="rounded-2xl bg-white/85 p-3.5 dark:bg-[#0D1117]/80 border border-black/[0.05] dark:border-white/[0.06]">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              Folders
            </span>
            <button
              type="button"
              onClick={() => setQuickCreateOpen((o) => !o)}
              aria-label="Create new folder"
              className="flex items-center gap-1 rounded-lg bg-[#F3F5F7] px-2 py-1 text-[11px] font-semibold text-[#14171A] hover:bg-[#93C5FD]/40 dark:bg-[#21262D] dark:text-white cursor-pointer"
            >
              <FolderPlus className="size-3 text-[#2563EB] dark:text-[#60A5FA]" />
              <span>New</span>
            </button>
          </div>

          {quickCreateOpen && (
            <form
              onSubmit={handleQuickCreateSubmit}
              className="my-2 flex items-center gap-1.5"
            >
              <input
                type="text"
                value={quickFolderName}
                onChange={(e) => setQuickFolderName(e.target.value)}
                placeholder="e.g. C Programming"
                aria-label="New folder name"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-[#F3F5F7] px-2.5 py-1.5 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#161B22] dark:text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#1C1E21] px-2.5 py-1.5 text-[11px] font-semibold text-white dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setQuickCreateOpen(false)}
                aria-label="Cancel new folder"
                className="p-1 text-[#64748B] hover:text-[#14171A] dark:hover:text-white cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </form>
          )}

          <HookSidebar
            items={collectionItems.map((c) => ({
              label: c.label,
              badge: c.badge,
            }))}
            value={activeCollectionIndex}
            color="#2563EB"
            dashed
            onChange={(idx) => {
              const picked = collectionItems[idx];
              if (!picked) return;
              setFolderFilter(picked.key);
              setMode('library');
            }}
          />
        </div>

        {/* Quick Open Recent Documents */}
        {readyDocs.length > 0 && (
          <div className="rounded-2xl bg-white/85 p-3.5 dark:bg-[#0D1117]/80 border border-black/[0.05] dark:border-white/[0.06]">
            <HookSidebar
              label="Quick Open"
              items={readyDocs.slice(0, 6).map((d) => ({
                label: d.name.slice(0, 22),
                badge: d.format.toUpperCase(),
              }))}
              value={activeDocIndex}
              color="#D97706"
              dashed
              onChange={(idx) => {
                const picked = readyDocs[idx];
                if (!picked) return;
                openDocumentTab(picked.id, true);
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Local Quota & Reduced Motion Controls (Theme Switch moved to Top Bar) */}
      <div className="mt-2 space-y-3 border-t border-black/[0.07] pt-4 dark:border-white/[0.08]">
        <div className="rounded-2xl bg-white p-3.5 dark:bg-[#0D1117] border border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#14171A] dark:text-white">
            <span>
              {userAccount ? `${userAccount.name} (Pro)` : 'Guest Local Mode'}
            </span>
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="text-[11px] font-semibold text-[#2563EB] hover:underline dark:text-[#60A5FA] cursor-pointer"
            >
              {userAccount ? 'Manage' : 'Configure'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Per-file cap:{' '}
            <span className="font-mono font-semibold text-[#14171A] dark:text-white">
              {userAccount ? '250.0 MB' : formatByteSize(GUEST_MAX_FILE_BYTES)}
            </span>{' '}
            · Used:{' '}
            <span className="font-mono font-semibold text-[#14171A] dark:text-white">
              {formatByteSize(totalLocalBytes)}
            </span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#21262D]">
            <div
              className="h-full rounded-full bg-[#93C5FD] dark:bg-[#60A5FA] hatch-blue transition-all duration-200"
              style={{
                width: `${Math.min(100, Math.max(12, (totalLocalBytes / GUEST_MAX_FILE_BYTES) * 100))}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !reducedMotion;
            setReducedMotion(next);
            toast.info(
              next ? 'Reduced Motion Enabled' : 'Fluid Motion Active',
              {
                description: next
                  ? 'Decorative transitions minimized.'
                  : 'Smooth workspace transitions restored.',
              },
            );
          }}
          aria-pressed={reducedMotion}
          className="flex w-full items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-[11px] font-medium text-[#64748B] hover:text-[#14171A] dark:bg-[#0D1117]/70 dark:text-[#94A3B8] dark:hover:text-white transition cursor-pointer"
          title="Toggle Reduced Motion Accessibility Mode"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Motion Preference</span>
          </span>
          <span className="font-mono font-semibold">
            {reducedMotion ? 'Reduced' : 'Fluid'}
          </span>
        </button>
      </div>
    </aside>
  );
};
