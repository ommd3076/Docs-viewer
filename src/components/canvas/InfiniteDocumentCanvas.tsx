import React, { useState } from 'react';
import {
  ArrowUpRight,
  Compass,
  Maximize2,
  Move,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { CanvasNodeItem } from '../../types/workspace';

export const InfiniteDocumentCanvas: React.FC = () => {
  const {
    canvasNodes,
    updateCanvasNodePosition,
    addCanvasNoteNode,
    removeCanvasNode,
    openDocumentTab,
  } = useWorkspaceStore();

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteAccent, setNoteAccent] =
    useState<CanvasNodeItem['accent']>('blue');

  const accentClasses: Record<CanvasNodeItem['accent'], string> = {
    obsidian: 'bg-[#1C1E21] text-white border-white/10',
    blue: 'bg-[#93C5FD] text-[#14171A] border-[#1E3A8A]/15',
    yellow: 'bg-[#FDE047] text-[#14171A] border-[#713F12]/15',
    white:
      'bg-white text-[#14171A] border-black/10 dark:bg-[#1C222B] dark:text-white dark:border-white/10',
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Canvas Header & Spatial Note Creator */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-[#F3F5F7] p-5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#14171A] dark:text-white">
            <Compass className="size-5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Visual Infinite Document Canvas</span>
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Drag document cards spatially, inspect cross-document links, or pin local synthesis notes
          </p>
        </div>

        {/* Zoom / Reset Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 dark:bg-[#21262D]">
            <button
              type="button"
              aria-label="Zoom out canvas"
              onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))))}
              className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F3F5F7] dark:text-[#94A3B8] cursor-pointer"
            >
              <ZoomOut className="size-4" />
            </button>
            <span className="px-2 font-mono text-xs font-semibold tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in canvas"
              onClick={() => setScale((s) => Math.min(1.5, Number((s + 0.1).toFixed(2))))}
              className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F3F5F7] dark:text-[#94A3B8] cursor-pointer"
            >
              <ZoomIn className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#14171A] hover:bg-[#E2E6EA] dark:bg-[#21262D] dark:text-white cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Add Spatial Note Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!noteTitle.trim()) return;
          addCanvasNoteNode(
            noteTitle.trim(),
            noteContent.trim() || 'Local spatial synthesis card.',
            noteAccent,
          );
          setNoteTitle('');
          setNoteContent('');
        }}
        className="flex flex-wrap items-center gap-3 rounded-[24px] bg-white p-4 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
      >
        <input
          type="text"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="New spatial card title…"
          aria-label="New spatial card title"
          className="w-56 rounded-xl border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#0D1117] dark:text-white"
        />
        <input
          type="text"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Synthesis observation or cross-reference note…"
          aria-label="New spatial card content"
          className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#0D1117] dark:text-white"
        />
        <select
          aria-label="Card color theme"
          value={noteAccent}
          onChange={(e) =>
            setNoteAccent(e.target.value as CanvasNodeItem['accent'])
          }
          className="rounded-xl border border-black/10 bg-[#F3F5F7] px-3 py-2 text-xs font-semibold text-[#14171A] dark:border-white/10 dark:bg-[#21262D] dark:text-white cursor-pointer"
        >
          <option value="blue">Electric Blue</option>
          <option value="yellow">Solar Yellow</option>
          <option value="obsidian">Obsidian Dark</option>
          <option value="white">Alabaster White</option>
        </select>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-[#1C1E21] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2E3238] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Add Spatial Card</span>
        </button>
      </form>

      {/* Interactive Infinite Canvas Surface */}
      <div
        data-testid="infinite-document-canvas"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).dataset.canvasBg === 'true') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
          }
        }}
        onPointerMove={(e) => {
          if (draggingNodeId) {
            const nextX = Math.round((e.clientX - dragOffset.x) / scale);
            const nextY = Math.round((e.clientY - dragOffset.y) / scale);
            updateCanvasNodePosition(draggingNodeId, nextX, nextY);
          } else if (isPanning) {
            setPan({
              x: e.clientX - panStart.x,
              y: e.clientY - panStart.y,
            });
          }
        }}
        onPointerUp={() => {
          setDraggingNodeId(null);
          setIsPanning(false);
        }}
        onPointerLeave={() => {
          setDraggingNodeId(null);
          setIsPanning(false);
        }}
        data-canvas-bg="true"
        className="relative h-[620px] w-full overflow-hidden rounded-[32px] bg-[#E5E9ED] dark:bg-[#0D1117] border border-black/[0.08] dark:border-white/[0.08] select-none cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(20,23,26,0.16) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          data-canvas-bg="true"
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {/* SVG Connection Lines between linked documents */}
          <svg
            className="pointer-events-none absolute inset-0 h-[1400px] w-[1800px]"
            aria-hidden
          >
            {canvasNodes.length >= 2 && (
              <path
                d={`M ${canvasNodes[0].x + 320} ${canvasNodes[0].y + 100} C ${
                  canvasNodes[0].x + 375
                } ${canvasNodes[0].y + 100}, ${canvasNodes[1].x - 55} ${
                  canvasNodes[1].y + 100
                }, ${canvasNodes[1].x} ${canvasNodes[1].y + 100}`}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeDasharray="6 6"
              />
            )}
          </svg>

          {canvasNodes.map((node) => (
            <div
              key={node.id}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
              }}
              className={`absolute flex flex-col justify-between rounded-[26px] border p-5 shadow-md transition-shadow hover:shadow-lg ${
                accentClasses[node.accent]
              }`}
            >
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingNodeId(node.id);
                  setDragOffset({
                    x: e.clientX - node.x * scale,
                    y: e.clientY - node.y * scale,
                  });
                }}
                className="flex items-start justify-between gap-2 cursor-move"
              >
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-bold uppercase opacity-75">
                    {node.subtitle ?? node.type}
                  </span>
                  <h3 className="truncate text-sm font-bold">{node.title}</h3>
                </div>
                <Move className="size-4 shrink-0 opacity-60" />
              </div>

              <p className="my-3 line-clamp-3 text-xs leading-relaxed opacity-85">
                {node.content}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-current/10">
                <span className="font-mono text-[10px] opacity-70">
                  ({node.x}, {node.y})
                </span>
                <div className="flex items-center gap-1.5">
                  {node.documentId && (
                    <button
                      type="button"
                      onClick={() => openDocumentTab(node.documentId!, true)}
                      className="flex items-center gap-1 rounded-xl bg-black/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-black/25 cursor-pointer"
                    >
                      <Maximize2 className="size-3" />
                      <span>Open Viewer</span>
                      <ArrowUpRight className="size-3" />
                    </button>
                  )}
                  {node.type === 'note' && (
                    <button
                      type="button"
                      aria-label={`Remove spatial card ${node.title}`}
                      onClick={() => removeCanvasNode(node.id)}
                      className="rounded-lg p-1 opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
