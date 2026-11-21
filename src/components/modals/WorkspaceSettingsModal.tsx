import React, { useState } from 'react';
import {
  Download,
  HardDrive,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatByteSize } from '../../utils/documentRules';

export const WorkspaceSettingsModal: React.FC = () => {
  const {
    accountModalOpen,
    setAccountModalOpen,
    userAccount,
    signInLocalAccount,
    signOutLocalAccount,
    exportWorkspaceJson,
    importWorkspaceJson,
    storageStats,
  } = useWorkspaceStore();

  const [name, setName] = useState(userAccount?.name ?? '');
  const [email, setEmail] = useState(userAccount?.email ?? '');
  const [formError, setFormError] = useState('');

  if (!accountModalOpen) return null;

  const handleDownloadSnapshot = () => {
    const json = exportWorkspaceJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultdocs-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-settings-title"
    >
      <div className="w-full max-w-xl rounded-[30px] bg-[#F3F5F7] p-6 shadow-2xl dark:bg-[#161B22] border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between">
          <h2
            id="workspace-settings-title"
            className="text-lg font-bold text-[#14171A] dark:text-white"
          >
            Local Persistence, Eviction Recovery &amp; Account Tier
          </h2>
          <button
            type="button"
            aria-label="Close workspace settings"
            onClick={() => setAccountModalOpen(false)}
            className="rounded-xl bg-white p-1.5 text-[#64748B] hover:text-[#14171A] dark:bg-[#21262D] dark:text-white cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Storage Diagnostics & JSON Export/Restore */}
        <div className="mt-4 rounded-2xl bg-white p-4 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-[#14171A] dark:text-white">
              <HardDrive className="size-4 text-[#2563EB]" />
              <span>IndexedDB + OPFS Storage Diagnostics</span>
            </span>
            <span className="font-mono text-xs text-[#2563EB] dark:text-[#60A5FA]">
              {storageStats.opfsAvailable ? 'OPFS Active' : 'IndexedDB Mode'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Browser Quota Allocated:{' '}
            <span className="font-mono font-semibold text-[#14171A] dark:text-white">
              {formatByteSize(storageStats.quotaBytes)}
            </span>{' '}
            · Export your workspace bundle at any time to protect against browser storage eviction.
          </p>

          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSnapshot}
              className="flex items-center gap-1.5 rounded-xl bg-[#1C1E21] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2E3238] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export Workspace JSON</span>
            </button>

            <label className="flex items-center gap-1.5 rounded-xl bg-[#93C5FD]/40 px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] hover:bg-[#93C5FD]/70 dark:bg-[#21262D] dark:text-white cursor-pointer">
              <Upload className="size-3.5" />
              <span>Restore Workspace JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  importWorkspaceJson(text);
                }}
              />
            </label>
          </div>
        </div>

        {/* Optional Local Account Authentication */}
        <div className="mt-4 rounded-2xl bg-white p-4 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-[#14171A] dark:text-white">
              <UserCheck className="size-4 text-[#D97706]" />
              <span>
                Optional Local Pro Account (Lifts 30 MB Guest Per-File Limit)
              </span>
            </span>
            <ShieldCheck className="size-4 text-[#2563EB]" />
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Guest users can use all workspace features without an account (30 MB per-file local processing limit). Sign in locally to unlock 250 MB per-file worker buffers.
          </p>

          {userAccount ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F3F5F7] p-3 dark:bg-[#161B22]">
              <div>
                <p className="text-xs font-bold text-[#14171A] dark:text-white">
                  {userAccount.name} ({userAccount.email})
                </p>
                <p className="font-mono text-[11px] text-[#2563EB] dark:text-[#60A5FA]">
                  Tier: Local Pro · 250 MB Per-File Worker Limit
                </p>
              </div>
              <button
                type="button"
                onClick={signOutLocalAccount}
                className="rounded-xl bg-[#1C1E21] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                Switch to Guest
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || !email.trim() || !email.includes('@')) {
                  setFormError(
                    'Please enter both a valid name and email address.',
                  );
                  return;
                }
                setFormError('');
                signInLocalAccount(name, email);
              }}
              className="mt-3 space-y-2.5"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineer Name"
                  aria-label="Engineer Name"
                  className="rounded-xl border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none dark:border-white/10 dark:bg-[#161B22] dark:text-white"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@local.workspace"
                  aria-label="Account Email"
                  className="rounded-xl border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none dark:border-white/10 dark:bg-[#161B22] dark:text-white"
                />
              </div>
              {formError && (
                <p className="text-xs font-medium text-[#DC2626]">{formError}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-[#FDE047] py-2 text-xs font-bold text-[#14171A] hover:bg-[#FACC15] cursor-pointer"
              >
                Activate Local Pro Account (250 MB Per-File Cap)
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
