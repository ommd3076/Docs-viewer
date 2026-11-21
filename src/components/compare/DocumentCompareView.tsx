import React from 'react';
import { ArrowLeftRight, GitCompare, PlusCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { computeDocumentDiff } from '../../utils/documentRules';

export const DocumentCompareView: React.FC = () => {
  const { documents, compareDocAId, compareDocBId, setCompareDocs, openDocumentTab } =
    useWorkspaceStore();

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const docA =
    readyDocs.find((d) => d.id === compareDocAId) ?? readyDocs[0] ?? documents[0];
  const docB =
    readyDocs.find((d) => d.id === compareDocBId) ??
    readyDocs[1] ??
    readyDocs[0] ??
    documents[0];

  if (!docA || !docB) return null;

  const diff = computeDocumentDiff(docA, docB);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Compare Selector Header */}
      <div className="rounded-[28px] bg-[#F3F5F7] p-6 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[#14171A] dark:text-white">
              <GitCompare className="size-5 text-[#2563EB] dark:text-[#60A5FA]" />
              <span>Multi-Document Local Compare Mode</span>
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Side-by-side structural &amp; line-level diff computed 100% locally in memory
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCompareDocs(docB.id, docA.id)}
            className="flex items-center gap-1.5 rounded-xl bg-[#1C1E21] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2E3238] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
          >
            <ArrowLeftRight className="size-3.5" />
            <span>Swap A ↔ B</span>
          </button>
        </div>

        {/* Selectors for Document A and Document B */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/10">
            <label
              htmlFor="compare-select-a"
              className="block font-mono text-[11px] font-bold uppercase text-[#2563EB] dark:text-[#60A5FA]"
            >
              Baseline Document (A)
            </label>
            <select
              id="compare-select-a"
              value={docA.id}
              onChange={(e) => setCompareDocs(e.target.value, docB.id)}
              className="mt-1.5 w-full rounded-xl bg-[#F3F5F7] px-3 py-2 text-xs font-semibold text-[#14171A] outline-none dark:bg-[#161B22] dark:text-white cursor-pointer"
            >
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.format.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-white p-4 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/10">
            <label
              htmlFor="compare-select-b"
              className="block font-mono text-[11px] font-bold uppercase text-[#D97706] dark:text-[#FACC15]"
            >
              Comparison Target (B)
            </label>
            <select
              id="compare-select-b"
              value={docB.id}
              onChange={(e) => setCompareDocs(docA.id, e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-[#F3F5F7] px-3 py-2 text-xs font-semibold text-[#14171A] outline-none dark:bg-[#161B22] dark:text-white cursor-pointer"
            >
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.format.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-[#1C1E21] p-4 text-white">
            <span className="text-xs text-[#94A3B8]">Structural Overlap</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#93C5FD]">
              {diff.similarityPercent}%
            </p>
          </div>
          <div className="rounded-2xl bg-[#93C5FD] p-4 text-[#14171A]">
            <span className="text-xs font-medium text-[#1E3A8A]">
              Added Lines in B
            </span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              +{diff.addedCount}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FDE047] p-4 text-[#14171A]">
            <span className="text-xs font-medium text-[#713F12]">
              Modified Blocks
            </span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {diff.modifiedCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-[#14171A] dark:bg-[#0D1117] dark:text-white">
            <span className="text-xs text-[#64748B]">Removed from A</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              -{diff.removedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Line & Content Diff Table */}
      <div
        data-testid="compare-diff-view"
        className="rounded-[28px] bg-white p-6 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#14171A] dark:text-white">
            Synchronized Content Delta ({diff.lines.length} blocks)
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openDocumentTab(docA.id, true)}
              className="rounded-xl bg-[#F3F5F7] px-3 py-1.5 text-xs font-semibold text-[#14171A] dark:bg-[#21262D] dark:text-white cursor-pointer"
            >
              Open A
            </button>
            <button
              type="button"
              onClick={() => openDocumentTab(docB.id, true)}
              className="rounded-xl bg-[#F3F5F7] px-3 py-1.5 text-xs font-semibold text-[#14171A] dark:bg-[#21262D] dark:text-white cursor-pointer"
            >
              Open B
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[540px] overflow-y-auto font-mono text-xs">
          {diff.lines.map((line, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-1 gap-3 rounded-xl p-3 md:grid-cols-2 ${
                line.type === 'added'
                  ? 'bg-[#93C5FD]/25 border border-[#93C5FD]'
                  : line.type === 'removed'
                    ? 'bg-black/[0.05] dark:bg-white/[0.05]'
                    : line.type === 'modified'
                      ? 'bg-[#FDE047]/30 border border-[#FDE047]'
                      : 'bg-[#F3F5F7]/50 dark:bg-[#0D1117]'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-6 shrink-0 text-[#64748B] tabular-nums">
                  {line.lineNumberA ?? '—'}
                </span>
                <span className="break-words text-[#14171A] dark:text-white">
                  {line.textA ?? '(Not present in A)'}
                </span>
              </div>

              <div className="flex items-start gap-2 min-w-0 border-t border-black/5 pt-2 md:border-t-0 md:border-l md:pl-3 md:pt-0 dark:border-white/10">
                <span className="w-6 shrink-0 text-[#64748B] tabular-nums">
                  {line.lineNumberB ?? '—'}
                </span>
                <span className="break-words text-[#14171A] dark:text-white">
                  {line.textB ?? '(Removed in B)'}
                </span>
                <span className="ml-auto shrink-0">
                  {line.type === 'added' && (
                    <PlusCircle className="size-3.5 text-[#2563EB]" />
                  )}
                  {line.type === 'removed' && (
                    <MinusCircle className="size-3.5 text-[#64748B]" />
                  )}
                  {line.type === 'modified' && (
                    <RefreshCw className="size-3.5 text-[#D97706]" />
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
