import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Pin,
  Plus,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { HookSidebar } from '../rareui/hook-sidebar';
import ProximitySidebar from '../rareui/proximity-sidebar';
import ScrollProgress from '../rareui/scroll-progress';
import { GridReveal } from '../rareui/grid-reveal';
import { toast } from '../rareui/toast';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatByteSize } from '../../utils/documentRules';
import { readBinaryFromOpfs } from '../../utils/localPersistence';

if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: <T>(fn: () => T) => Promise<T> }).try = function <T>(
    fn: () => T,
  ): Promise<T> {
    return new Promise<T>((resolve) => resolve(fn()));
  };
}
if (
  typeof Uint8Array !== 'undefined' &&
  typeof (Uint8Array.prototype as unknown as { toHex?: unknown }).toHex !== 'function'
) {
  (Uint8Array.prototype as unknown as { toHex: () => string }).toHex = function (
    this: Uint8Array,
  ) {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

if (
  typeof window !== 'undefined' &&
  pdfjsLib.GlobalWorkerOptions &&
  !pdfjsLib.GlobalWorkerOptions.workerSrc
) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SelectableTextItem {
  str: string;
  leftPercent: number;
  topPercent: number;
  fontSizePx: number;
}

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  totalPages: number;
  zoom: number;
  fallbackText: string;
  sha256: string;
  sectionId: string;
  onPageVisible?: (pageNumber: number) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  totalPages,
  zoom,
  fallbackText,
  sha256,
  sectionId,
  onPageVisible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(pageNumber <= 4);
  const [textItems, setTextItems] = useState<SelectableTextItem[]>([]);
  const [pageWidthPx, setPageWidthPx] = useState<number>(760);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
            if (entry.intersectionRatio >= 0.35) {
              onPageVisible?.(pageNumber);
            }
          }
        }
      },
      { rootMargin: '900px 0px' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onPageVisible]);

  useEffect(() => {
    if (!isNearViewport) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    const renderPage = async () => {
      if (pdfDoc && pageNumber <= pdfDoc.numPages) {
        try {
          const page = await pdfDoc.getPage(pageNumber);
          if (cancelled) return;

          const baseScale = 1.38 * (zoom / 100);
          const viewport = page.getViewport({ scale: baseScale });
          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.maxWidth = `${Math.round(viewport.width)}px`;
          setPageWidthPx(Math.round(viewport.width));

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(dpr, dpr);

          renderTask = page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          });
          await renderTask.promise;
          ctx.restore();

          const tc = await page.getTextContent();
          if (!cancelled) {
            const rawWidth = viewport.width / baseScale || 612;
            const rawHeight = viewport.height / baseScale || 792;
            const extracted: SelectableTextItem[] = [];
            for (const item of tc.items) {
              if (
                'str' in item &&
                item.str.trim().length > 0 &&
                Array.isArray(item.transform)
              ) {
                const tx = Number(item.transform[4]) || 0;
                const ty = Number(item.transform[5]) || 0;
                const fontH = Math.abs(Number(item.transform[0]) || 11);
                const leftPercent = Math.min(
                  94,
                  Math.max(2, (tx / rawWidth) * 100),
                );
                const topPercent = Math.min(
                  96,
                  Math.max(2, ((rawHeight - ty) / rawHeight) * 100 - 2),
                );
                extracted.push({
                  str: item.str,
                  leftPercent,
                  topPercent,
                  fontSizePx: Math.max(10, Math.round(fontH * (zoom / 100))),
                });
              }
            }
            setTextItems(extracted);
          }
          return;
        } catch {
          // Fall through to clean vector fallback
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx || cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const logicalW = Math.round(740 * (zoom / 100));
      const logicalH = Math.round(520 * (zoom / 100));
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${logicalW}px`;
      setPageWidthPx(logicalW);
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, logicalW, logicalH);

      ctx.fillStyle = '#1C1E21';
      ctx.fillRect(0, 0, logicalW, 8);
      ctx.fillStyle = '#93C5FD';
      ctx.fillRect(32, 24, 90, 5);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(130, 24, 52, 5);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(
        `PDF.JS LOCAL VECTOR LAYER · PAGE ${pageNumber} OF ${totalPages} · SHA-256 ${sha256.slice(0, 12)}`,
        32,
        46,
      );

      const lines = fallbackText.split('\n').filter(Boolean);
      let y = 78;
      lines.slice(0, 13).forEach((line, idx) => {
        if (idx === 0) {
          ctx.fillStyle = '#14171A';
          ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(line.slice(0, 72), 32, y);
          y += 28;
        } else {
          ctx.fillStyle = '#334155';
          ctx.font = '400 12.5px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(line.slice(0, 92), 32, y);
          y += 22;
        }
      });
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore cancel errors
        }
      }
    };
  }, [isNearViewport, pdfDoc, pageNumber, totalPages, zoom, fallbackText, sha256]);

  return (
    <div
      ref={containerRef}
      id={sectionId}
      data-page-number={pageNumber}
      className="mx-auto w-full scroll-mt-16"
      style={{ maxWidth: `${Math.max(660, pageWidthPx)}px` }}
    >
      <div className="relative overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-xs dark:border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-black/[0.05] bg-[#F8FAFC] px-4 py-1.5 text-[11px] font-mono text-[#64748B] select-none">
          <span>
            Page {pageNumber} of {totalPages}
          </span>
        </div>

        <div className="relative flex justify-center bg-white p-2 sm:p-4">
          <canvas
            ref={canvasRef}
            data-testid={pageNumber === 1 ? 'pdf-canvas-surface' : undefined}
            aria-label={`PDF Page ${pageNumber}`}
            className="block h-auto w-full pointer-events-none"
          />

          {textItems.length > 0 && (
            <div
              className="absolute inset-0 select-text overflow-hidden"
              style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              {textItems.map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${item.leftPercent}%`,
                    top: `${item.topPercent}%`,
                    fontSize: `${item.fontSizePx}px`,
                    lineHeight: 1.35,
                  }}
                  className="text-transparent selection:bg-[#2563EB]/25 selection:text-[#14171A] cursor-text whitespace-pre-wrap"
                >
                  {item.str}{' '}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DocumentViewerWorkspaceProps {
  onTriggerFileImport: () => void;
}

export const DocumentViewerWorkspace: React.FC<DocumentViewerWorkspaceProps> = ({
  onTriggerFileImport,
}) => {
  const {
    documents,
    openTabIds,
    activeDocId,
    openDocumentTab,
    closeDocumentTab,
    bookmarks,
    addBookmark,
    removeBookmark,
    annotations,
    addAnnotation,
    removeAnnotation,
  } = useWorkspaceStore();

  const activeDoc =
    documents.find((d) => d.id === activeDocId) ?? documents[0] ?? null;

  const [zoom, setZoom] = useState(100);
  const [isFullView, setIsFullView] = useState(false);
  const [outlineRailMode, setOutlineRailMode] = useState<'hook' | 'proximity'>(
    'hook',
  );
  const [activeOutlineIdx, setActiveOutlineIdx] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [pdfDocProxy, setPdfDocProxy] = useState<PDFDocumentProxy | null>(null);
  const [resolvedPageCount, setResolvedPageCount] = useState<number>(1);
  const [docxAnchorCount, setDocxAnchorCount] = useState(0);

  const [bookmarkInput, setBookmarkInput] = useState('');
  const [annotationInput, setAnnotationInput] = useState('');
  const [annotationQuote, setAnnotationQuote] = useState('');
  const [annotationScope, setAnnotationScope] = useState<'item' | 'all'>('item');
  const [annotationColor, setAnnotationColor] = useState<
    'blue' | 'yellow' | 'slate'
  >('blue');

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveSlideIndex(0);
    setActiveSheetIndex(0);
    setSelectedRowIdx(null);
    setActiveOutlineIdx(0);
    setCurrentPdfPage(1);
    setAnnotationQuote('');
    setResolvedPageCount(activeDoc?.pageCount ?? 1);
  }, [activeDocId, activeDoc?.pageCount]);

  useEffect(() => {
    if (!isFullView) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullView(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullView]);

  // Load real PDF.js PDFDocumentProxy when activeDoc is a PDF
  useEffect(() => {
    if (
      !activeDoc ||
      activeDoc.format !== 'pdf' ||
      activeDoc.status !== 'ready'
    ) {
      setPdfDocProxy(null);
      return;
    }

    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;

    const loadPdfDocument = async () => {
      let buffer = activeDoc.rawBytes;
      if (!buffer || buffer.byteLength === 0) {
        buffer = await readBinaryFromOpfs(activeDoc.id);
      }
      if (!buffer || buffer.byteLength === 0 || cancelled) {
        setPdfDocProxy(null);
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          standardFontDataUrl: '/standard_fonts/',
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.cleanup();
          return;
        }
        loadedDoc = pdf;
        setPdfDocProxy(pdf);
        setResolvedPageCount(Math.max(1, pdf.numPages));
      } catch {
        setPdfDocProxy(null);
      }
    };

    loadPdfDocument();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.cleanup().catch(() => {});
      }
    };
  }, [activeDoc?.id, activeDoc?.format, activeDoc?.status]);

  // Render real DOCX binary using docx-preview
  useEffect(() => {
    if (
      activeDoc &&
      activeDoc.format === 'docx' &&
      activeDoc.status === 'ready' &&
      docxContainerRef.current
    ) {
      const container = docxContainerRef.current;
      container.innerHTML = '';

      const renderDocx = async () => {
        let buffer = activeDoc.rawBytes;
        if (!buffer || buffer.byteLength === 0) {
          buffer = await readBinaryFromOpfs(activeDoc.id);
        }
        if (!buffer) return;
        await renderAsync(buffer.slice(0), container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
        })
          .then(() => {
            const blocks = container.querySelectorAll(
              'h1, h2, h3, h4, p, table',
            );
            let anchorIdx = 0;
            blocks.forEach((el) => {
              const text = (el.textContent ?? '').trim();
              if (!text || anchorIdx >= 24) return;
              if (
                el.tagName.startsWith('H') ||
                el.tagName === 'TABLE' ||
                anchorIdx === 0 ||
                text.length > 42
              ) {
                el.id = `docx-anchor-${anchorIdx}`;
                anchorIdx += 1;
              }
            });
            setDocxAnchorCount(anchorIdx);
          })
          .catch(() => {});
      };

      renderDocx();
    }
  }, [activeDoc?.id, activeDoc?.format, activeDoc?.status]);

  if (!activeDoc) {
    return (
      <div className="rounded-[28px] bg-white p-12 text-center dark:bg-[#161B22]">
        <p className="text-base font-semibold text-[#14171A] dark:text-white">
          No document open
        </p>
        <button
          type="button"
          onClick={onTriggerFileImport}
          className="mt-4 rounded-full bg-[#1C1E21] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          Open Local File
        </button>
      </div>
    );
  }

  const totalPdfPages = Math.max(activeDoc.pageCount, resolvedPageCount, 1);
  const activeSheet =
    activeDoc.sheets?.[activeSheetIndex] ?? activeDoc.sheets?.[0] ?? null;

  const outlineSections = useMemo(() => {
    if (activeDoc.format === 'pdf' && totalPdfPages > activeDoc.sections.length) {
      return Array.from({ length: Math.min(totalPdfPages, 65) }, (_, idx) => {
        const p = idx + 1;
        const existing = activeDoc.sections.find(
          (s) => s.pageOrSlide === p || s.id === `pdf-page-${p}`,
        );
        return {
          id: existing?.id ?? `pdf-page-${p}`,
          label: existing?.title ?? `Page ${p}`,
          pageNumber: p,
          kind: (idx === 0 ? 'title' : 'section') as 'title' | 'subtitle' | 'section' | 'body',
        };
      });
    }

    if (
      (activeDoc.format === 'xlsx' || activeDoc.format === 'csv') &&
      activeSheet
    ) {
      const items: {
        id: string;
        label: string;
        pageNumber: number;
        kind: 'title' | 'subtitle' | 'section' | 'body';
        rowIdx?: number;
      }[] = [
        {
          id: `sheet-${activeSheet.name}`,
          label: `Sheet: ${activeSheet.name}`,
          pageNumber: activeSheetIndex + 1,
          kind: 'title',
        },
      ];
      activeSheet.rows.slice(0, 24).forEach((row, rIdx) => {
        const firstVal = String(row.find((c) => c !== null && c !== '') ?? `Row ${rIdx + 1}`).trim();
        items.push({
          id: `sheet-${activeSheet.name}-row-${rIdx}`,
          label: `R${rIdx + 1}: ${firstVal.slice(0, 26)}`,
          pageNumber: rIdx + 1,
          kind: rIdx <= 1 ? 'subtitle' : 'body',
          rowIdx: rIdx,
        });
      });
      return items;
    }

    if (activeDoc.format === 'pptx' && activeDoc.slides?.length) {
      return activeDoc.slides.map((s, idx) => ({
        id: `pptx-slide-${s.index}`,
        label: `${s.index}. ${s.title}`,
        pageNumber: s.index,
        kind: (idx === 0 ? 'title' : 'section') as 'title' | 'subtitle' | 'section' | 'body',
      }));
    }

    if (activeDoc.format === 'docx' && docxAnchorCount > 0) {
      return Array.from({ length: Math.min(docxAnchorCount, 24) }, (_, idx) => {
        const sec = activeDoc.sections[idx];
        return {
          id: `docx-anchor-${idx}`,
          label: sec?.title ?? `Section ${idx + 1}`,
          pageNumber: sec?.pageOrSlide ?? 1,
          kind: (idx === 0 ? 'title' : idx < 3 ? 'subtitle' : 'section') as 'title' | 'subtitle' | 'section' | 'body',
        };
      });
    }

    return activeDoc.sections.map((s, idx) => ({
      id: s.id,
      label: s.title,
      pageNumber: s.pageOrSlide ?? idx + 1,
      kind: (idx === 0 ? 'title' : 'section') as 'title' | 'subtitle' | 'section' | 'body',
    }));
  }, [activeDoc, totalPdfPages, activeSheet, activeSheetIndex, docxAnchorCount]);

  // Compute the current item anchor for item-specific annotations & bookmarks
  const currentItemTarget = useMemo(() => {
    if (activeDoc.format === 'pdf') {
      return {
        sectionId: `pdf-page-${currentPdfPage}`,
        pageOrSlide: currentPdfPage,
        targetLabel: `Page ${currentPdfPage}`,
      };
    }
    if (activeDoc.format === 'pptx' && activeDoc.slides?.length) {
      const slide =
        activeDoc.slides[activeSlideIndex] ?? activeDoc.slides[0];
      return {
        sectionId: `pptx-slide-${slide.index}`,
        pageOrSlide: slide.index,
        targetLabel: `Slide ${slide.index}`,
      };
    }
    if (
      (activeDoc.format === 'xlsx' || activeDoc.format === 'csv') &&
      activeSheet
    ) {
      if (selectedRowIdx !== null) {
        return {
          sectionId: `sheet-${activeSheet.name}-row-${selectedRowIdx}`,
          pageOrSlide: activeSheetIndex + 1,
          targetLabel: `${activeSheet.name} · Row ${selectedRowIdx + 1}`,
        };
      }
      return {
        sectionId: `sheet-${activeSheet.name}`,
        pageOrSlide: activeSheetIndex + 1,
        targetLabel: `Sheet: ${activeSheet.name}`,
      };
    }
    const sec = outlineSections[activeOutlineIdx] ?? outlineSections[0];
    return {
      sectionId: sec?.id ?? `doc-${activeDoc.id}`,
      pageOrSlide: sec?.pageNumber ?? 1,
      targetLabel: sec?.label ? sec.label.slice(0, 28) : 'Document',
    };
  }, [
    activeDoc,
    currentPdfPage,
    activeSlideIndex,
    activeSheet,
    activeSheetIndex,
    selectedRowIdx,
    outlineSections,
    activeOutlineIdx,
  ]);

  const scrollToElementId = (targetId: string, pageNum?: number) => {
    if (activeDoc.format === 'pptx' && targetId.startsWith('pptx-slide-')) {
      const slideNo = Number(targetId.replace('pptx-slide-', ''));
      if (!Number.isNaN(slideNo) && slideNo >= 1) {
        setActiveSlideIndex(slideNo - 1);
      }
      return;
    }

    if (
      (activeDoc.format === 'xlsx' || activeDoc.format === 'csv') &&
      targetId.includes('-row-')
    ) {
      const parts = targetId.split('-row-');
      const rowNum = Number(parts[1]);
      if (!Number.isNaN(rowNum)) {
        setSelectedRowIdx(rowNum);
      }
    }

    const targetEl =
      document.getElementById(targetId) ??
      (pageNum ? document.getElementById(`pdf-page-${pageNum}`) : null);
    const scroller = scrollContainerRef.current;
    if (targetEl && scroller && scroller.contains(targetEl)) {
      const top =
        targetEl.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      scroller.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
    } else if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (pageNum && activeDoc.format === 'pdf') {
      setCurrentPdfPage(pageNum);
    }
  };

  const jumpToPdfPage = (pageNum: number) => {
    const clamped = Math.min(totalPdfPages, Math.max(1, pageNum));
    setCurrentPdfPage(clamped);
    const sectionMatch = outlineSections.find((s) => s.pageNumber === clamped);
    scrollToElementId(sectionMatch?.id ?? `pdf-page-${clamped}`, clamped);
  };

  const docBookmarks = bookmarks.filter((b) => b.documentId === activeDoc.id);
  const allDocAnnotations = annotations.filter(
    (a) => a.documentId === activeDoc.id,
  );
  const visibleAnnotations =
    annotationScope === 'all'
      ? allDocAnnotations
      : allDocAnnotations.filter(
          (a) =>
            a.sectionId === currentItemTarget.sectionId ||
            (activeDoc.format === 'pdf' &&
              a.pageOrSlide === currentPdfPage) ||
            (activeDoc.format === 'pptx' &&
              a.pageOrSlide === activeSlideIndex + 1),
        );

  const handleCaptureSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? '';
    if (text.length >= 3) {
      setAnnotationQuote(text.slice(0, 140));
    }
  };

  const handleSaveBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    const label = bookmarkInput.trim() || currentItemTarget.targetLabel;
    addBookmark({
      documentId: activeDoc.id,
      sectionId: currentItemTarget.sectionId,
      pageOrSlide: currentItemTarget.pageOrSlide,
      label,
    });
    setBookmarkInput('');
    toast.success('Bookmark saved locally', {
      description: label,
    });
  };

  const handleSaveAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationInput.trim()) return;
    addAnnotation({
      documentId: activeDoc.id,
      sectionId: currentItemTarget.sectionId,
      pageOrSlide: currentItemTarget.pageOrSlide,
      targetLabel: currentItemTarget.targetLabel,
      quote: annotationQuote || undefined,
      note: annotationInput.trim(),
      color: annotationColor,
    });
    setAnnotationInput('');
    setAnnotationQuote('');
    toast.success(`Pinned note to ${currentItemTarget.targetLabel}`);
  };

  const handleDownloadActiveDoc = () => {
    const content =
      activeDoc.rawBytes && activeDoc.rawBytes.byteLength > 0
        ? new Blob([activeDoc.rawBytes], { type: activeDoc.mimeType })
        : new Blob([activeDoc.extractedText], {
            type: 'text/plain;charset=utf-8',
          });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${activeDoc.name}`);
  };

  const lines = activeDoc.extractedText.split('\n').filter(Boolean);
  const page2MarkerIdx = lines.findIndex((l) => /^Page 2:/i.test(l));
  const splitIdx =
    page2MarkerIdx > 0 ? page2MarkerIdx : Math.ceil(lines.length / 2);

  return (
    <div
      className={
        isFullView
          ? 'fixed inset-0 z-50 flex flex-col bg-[#DCE1E5] p-3 sm:p-5 dark:bg-[#0D1117] overflow-y-auto space-y-3'
          : 'space-y-4 pb-16'
      }
    >
      {/* Top Open Document Tabs Bar (Sleek Custom Horizontal Scroller) */}
      <div
        role="tablist"
        aria-label="Open Document Tabs"
        className="vault-tab-scroll flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-[#F3F5F7] px-2 py-1.5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
      >
        {openTabIds.map((tabId) => {
          const doc = documents.find((d) => d.id === tabId);
          if (!doc) return null;
          const isCurrent = doc.id === activeDoc.id;
          return (
            <div
              key={doc.id}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
                isCurrent
                  ? 'bg-[#93C5FD] text-[#14171A] shadow-xs'
                  : 'bg-white/75 text-[#475569] hover:bg-white hover:text-[#14171A] dark:bg-[#21262D] dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => openDocumentTab(doc.id, false)}
                className="flex items-center gap-1.5 truncate max-w-[190px] cursor-pointer"
              >
                <span
                  className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    isCurrent
                      ? 'bg-[#1C1E21] text-white'
                      : 'bg-black/[0.07] text-[#14171A] dark:bg-white/10 dark:text-white'
                  }`}
                >
                  {doc.format}
                </span>
                <span className="truncate">{doc.name}</span>
              </button>
              {openTabIds.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close tab ${doc.name}`}
                  onClick={() => closeDocumentTab(doc.id)}
                  className="rounded-full p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onTriggerFileImport}
          aria-label="Open another local file"
          className="flex items-center gap-1 rounded-full border border-dashed border-black/20 px-3 py-1.5 text-xs font-semibold text-[#475569] hover:border-black/40 hover:text-[#14171A] dark:border-white/20 dark:text-[#94A3B8] dark:hover:text-white shrink-0 cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Import Tab</span>
        </button>
      </div>

      {/* Slim Single-Row Document Toolbar (Minimal, Zero Adapter Labels, Zero Redundant Nav Buttons) */}
      <div
        data-testid="viewer-file-toolbar"
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-[#F3F5F7] px-3.5 py-2 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 rounded-lg bg-[#93C5FD]/85 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#14171A]">
            {activeDoc.format}
          </span>
          <h2 className="truncate text-sm font-semibold text-[#14171A] dark:text-white">
            {activeDoc.name}
          </h2>
          <span className="hidden sm:inline-block shrink-0 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {formatByteSize(activeDoc.sizeBytes)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {activeDoc.format === 'pdf' && activeDoc.status === 'ready' && (
            <div className="flex items-center gap-0.5 rounded-lg bg-white px-2 py-1 text-[11px] font-mono tabular-nums text-[#14171A] dark:bg-[#21262D] dark:text-white border border-black/[0.06] dark:border-white/[0.07]">
              <button
                type="button"
                aria-label="Previous PDF Page"
                onClick={() => jumpToPdfPage(currentPdfPage - 1)}
                disabled={currentPdfPage <= 1}
                className="p-0.5 opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="px-1 font-semibold">
                {currentPdfPage}/{totalPdfPages}
              </span>
              <button
                type="button"
                aria-label="Next PDF Page"
                onClick={() => jumpToPdfPage(currentPdfPage + 1)}
                disabled={currentPdfPage >= totalPdfPages}
                className="p-0.5 opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}

          {/* Compact Zoom Controls */}
          <div className="flex items-center gap-0.5 rounded-lg bg-white px-1.5 py-1 dark:bg-[#21262D] border border-black/[0.06] dark:border-white/[0.07]">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(70, z - 10))}
              className="rounded p-0.5 text-[#475569] hover:text-[#14171A] dark:text-[#94A3B8] dark:hover:text-white cursor-pointer"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1 font-mono text-[11px] font-semibold tabular-nums text-[#14171A] dark:text-white">
              {zoom}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(160, z + 10))}
              className="rounded p-0.5 text-[#475569] hover:text-[#14171A] dark:text-[#94A3B8] dark:hover:text-white cursor-pointer"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullView((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#1C1E21] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2E3238] dark:bg-[#21262D] dark:hover:bg-[#30363D] cursor-pointer"
          >
            {isFullView ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Full View</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadActiveDoc}
            aria-label={`Download ${activeDoc.name}`}
            className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14171A] transition hover:bg-black/5 dark:bg-white/95 dark:text-[#14171A] border border-black/[0.06] cursor-pointer"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Document Surface + Right Bookmarks & Annotations */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left + Center Document Surface */}
        <div
          className={`flex flex-col rounded-[28px] bg-[#F3F5F7] p-4 sm:p-5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07] ${
            isFullView ? 'xl:col-span-12' : 'xl:col-span-8'
          }`}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left Document Outline Rail (HookSidebar / ProximitySidebar) */}
            {!isFullView && (
              <div className="lg:col-span-3 flex flex-col gap-3 border-b border-black/[0.06] pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3 dark:border-white/[0.07]">
                <div className="flex items-center gap-1 rounded-full bg-white/80 p-1 dark:bg-[#0D1117]">
                  <button
                    type="button"
                    onClick={() => setOutlineRailMode('hook')}
                    className={`flex-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      outlineRailMode === 'hook'
                        ? 'bg-[#93C5FD] text-[#14171A]'
                        : 'text-[#64748B] hover:text-[#14171A] dark:text-[#94A3B8] dark:hover:text-white'
                    }`}
                  >
                    Outline
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutlineRailMode('proximity')}
                    className={`flex-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      outlineRailMode === 'proximity'
                        ? 'bg-[#93C5FD] text-[#14171A]'
                        : 'text-[#64748B] hover:text-[#14171A] dark:text-[#94A3B8] dark:hover:text-white'
                    }`}
                  >
                    Minimap
                  </button>
                </div>

                <div className="max-h-[540px] overflow-y-auto pr-1">
                  {outlineRailMode === 'hook' ? (
                    <HookSidebar
                      label="DOCUMENT OUTLINE"
                      value={activeOutlineIdx}
                      color="#2563EB"
                      items={outlineSections.slice(0, 35).map((sec) => ({
                        label: sec.label,
                        badge: `P${sec.pageNumber}`,
                      }))}
                      onChange={(idx) => {
                        setActiveOutlineIdx(idx);
                        const sec = outlineSections[idx];
                        if (sec) {
                          scrollToElementId(sec.id, sec.pageNumber);
                        }
                      }}
                    />
                  ) : (
                    <ProximitySidebar
                      containerRef={scrollContainerRef}
                      sections={outlineSections.slice(0, 28).map((sec) => ({
                        id: sec.id,
                        label: sec.label,
                        kind: sec.kind,
                      }))}
                      onSelectSection={(id, idx) => {
                        setActiveOutlineIdx(idx);
                        const sec = outlineSections[idx];
                        scrollToElementId(id, sec?.pageNumber);
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Main Scrollable Document Stage */}
            <div
              ref={scrollContainerRef}
              onMouseUp={handleCaptureSelection}
              className={`relative max-h-[76dvh] overflow-y-auto rounded-2xl bg-white/60 p-3 sm:p-5 dark:bg-[#0D1117]/60 select-text ${
                isFullView ? 'lg:col-span-12 max-h-[82dvh]' : 'lg:col-span-9'
              }`}
              style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              {/* CORRUPTED FILE DIAGNOSTIC STATE */}
              {activeDoc.status === 'corrupted' && (
                <div className="mx-auto max-w-3xl rounded-2xl bg-[#1C1E21] p-8 text-white">
                  <div className="flex items-start gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#FDE047] text-[#14171A]">
                      <AlertTriangle className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Malformed or Corrupted Container Quarantined
                      </h3>
                      <p className="mt-1 text-sm text-[#94A3B8]">
                        {activeDoc.errorMessage}
                      </p>
                      <p className="mt-2 font-mono text-xs text-[#93C5FD]">
                        {activeDoc.name} · {formatByteSize(activeDoc.sizeBytes)} · SHA-256:{' '}
                        {activeDoc.privacyAudit.sha256Fingerprint.slice(0, 16)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 1. PDF ENGINE VIEW */}
              {activeDoc.status === 'ready' && activeDoc.format === 'pdf' && (
                <div className="space-y-6 pb-16">
                  {Array.from({ length: totalPdfPages }).map((_, pageIdx) => {
                    const pageNumber = pageIdx + 1;
                    const sectionId =
                      outlineSections[pageIdx]?.id ?? `pdf-page-${pageNumber}`;
                    const fallbackLines =
                      totalPdfPages <= 2
                        ? pageIdx === 0
                          ? lines.slice(0, splitIdx).join('\n')
                          : lines.slice(splitIdx).join('\n')
                        : lines
                            .slice(
                              Math.floor(
                                (pageIdx / totalPdfPages) * lines.length,
                              ),
                              Math.floor(
                                ((pageIdx + 1) / totalPdfPages) * lines.length,
                              ) + 6,
                            )
                            .join('\n') || activeDoc.extractedText;

                    return (
                      <PdfPageCanvas
                        key={`${activeDoc.id}-page-${pageNumber}`}
                        pdfDoc={pdfDocProxy}
                        pageNumber={pageNumber}
                        totalPages={totalPdfPages}
                        zoom={zoom}
                        fallbackText={fallbackLines}
                        sha256={activeDoc.privacyAudit.sha256Fingerprint}
                        sectionId={sectionId}
                        onPageVisible={(p) => {
                          setCurrentPdfPage(p);
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* 2. DOCX ENGINE VIEW */}
              {activeDoc.status === 'ready' && activeDoc.format === 'docx' && (
                <div className="mx-auto max-w-4xl pb-16 select-text">
                  <div
                    ref={docxContainerRef}
                    data-testid="docx-preview-container"
                    style={{
                      zoom: `${zoom}%`,
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                    }}
                    className="rounded-xl bg-white p-6 sm:p-8 shadow-xs dark:bg-[#0D1117] dark:text-white border border-black/[0.06] dark:border-white/[0.08] select-text cursor-text"
                  />
                </div>
              )}

              {/* 3. PPTX SLIDE DECK ENGINE VIEW */}
              {activeDoc.status === 'ready' &&
                activeDoc.format === 'pptx' &&
                activeDoc.slides && (
                  <div className="mx-auto max-w-4xl space-y-5 pb-16 select-text">
                    {(() => {
                      const slide =
                        activeDoc.slides[activeSlideIndex] ??
                        activeDoc.slides[0];
                      const slideThemes = {
                        obsidian: 'bg-[#1C1E21] text-white',
                        blue: 'bg-[#93C5FD] text-[#14171A]',
                        yellow: 'bg-[#FDE047] text-[#14171A]',
                        slate:
                          'bg-white text-[#14171A] dark:bg-[#0D1117] dark:text-white',
                      };
                      return (
                        <div
                          id={`pptx-slide-${slide.index}`}
                          data-testid="pptx-slide-stage"
                          className={`flex min-h-[420px] flex-col justify-between rounded-2xl p-8 sm:p-10 shadow-xs transition-colors select-text ${
                            slideThemes[slide.accentColor]
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold opacity-75">
                              Slide {slide.index} of {activeDoc.slides.length}
                            </span>
                          </div>

                          <div className="my-6 space-y-4">
                            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl text-balance">
                              {slide.title}
                            </h3>
                            {slide.subtitle && (
                              <p className="text-sm font-medium opacity-80">
                                {slide.subtitle}
                              </p>
                            )}
                            <ul className="mt-5 space-y-3">
                              {slide.bullets.map((b, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-3 text-base font-medium leading-relaxed"
                                >
                                  <span className="mt-2 size-2 shrink-0 rounded-full bg-current opacity-80" />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {slide.notes && (
                            <div className="rounded-xl bg-black/10 p-3.5 text-xs">
                              <span className="font-semibold">
                                Speaker Notes:{' '}
                              </span>
                              <span>{slide.notes}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-3.5 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlideIndex((i) => Math.max(0, i - 1))
                        }
                        disabled={activeSlideIndex === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-[#F3F5F7] px-3.5 py-2 text-xs font-semibold text-[#14171A] disabled:opacity-40 dark:bg-[#21262D] dark:text-white cursor-pointer"
                      >
                        <ChevronLeft className="size-4" />
                        <span>Previous</span>
                      </button>

                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {activeDoc.slides.map((s, idx) => (
                          <button
                            key={s.index}
                            type="button"
                            onClick={() => setActiveSlideIndex(idx)}
                            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition cursor-pointer ${
                              idx === activeSlideIndex
                                ? 'bg-[#1C1E21] text-[#FDE047] dark:bg-[#60A5FA] dark:text-[#0D1117]'
                                : 'bg-[#F3F5F7] text-[#64748B] hover:text-[#14171A] dark:bg-[#21262D] dark:text-[#94A3B8]'
                            }`}
                          >
                            {s.index}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlideIndex((i) =>
                            Math.min(
                              (activeDoc.slides?.length ?? 1) - 1,
                              i + 1,
                            ),
                          )
                        }
                        disabled={
                          activeSlideIndex >=
                          (activeDoc.slides?.length ?? 1) - 1
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-[#1C1E21] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                )}

              {/* 4. XLSX & CSV SPREADSHEET ENGINE VIEW */}
              {activeDoc.status === 'ready' &&
                (activeDoc.format === 'xlsx' || activeDoc.format === 'csv') &&
                activeDoc.sheets && (
                  <div className="mx-auto max-w-5xl space-y-4 pb-16 select-text">
                    {activeDoc.sheets.length > 1 && (
                      <div className="flex items-center gap-2 rounded-xl bg-white p-2.5 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/[0.08]">
                        {activeDoc.sheets.map((sheet, idx) => (
                          <button
                            key={sheet.name}
                            type="button"
                            onClick={() => {
                              setActiveSheetIndex(idx);
                              setSelectedRowIdx(null);
                            }}
                            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                              idx === activeSheetIndex
                                ? 'bg-[#1C1E21] text-white dark:bg-[#60A5FA] dark:text-[#0D1117]'
                                : 'bg-[#F3F5F7] text-[#475569] hover:text-[#14171A] dark:bg-[#21262D] dark:text-[#94A3B8]'
                            }`}
                          >
                            <FileSpreadsheet className="size-3.5" />
                            <span>{sheet.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const sheet =
                        activeDoc.sheets[activeSheetIndex] ??
                        activeDoc.sheets[0];
                      return (
                        <div
                          id={`sheet-${sheet.name}`}
                          data-testid="xlsx-sheet-grid"
                          className="overflow-x-auto rounded-xl bg-white p-5 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/[0.08] select-text"
                        >
                          <table className="w-full border-collapse text-left text-xs select-text">
                            <thead>
                              <tr className="bg-[#F3F5F7] font-mono text-[11px] text-[#64748B] dark:bg-[#161B22] dark:text-[#94A3B8]">
                                <th className="border border-black/[0.07] px-2.5 py-2 text-center w-10 dark:border-white/10">
                                  #
                                </th>
                                {Array.from({
                                  length: Math.max(
                                    1,
                                    ...sheet.rows.map((r) => r.length),
                                  ),
                                }).map((_, colIdx) => (
                                  <th
                                    key={colIdx}
                                    className="border border-black/[0.07] px-3 py-2 font-semibold dark:border-white/10"
                                  >
                                    {String.fromCharCode(65 + colIdx)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="font-mono tabular-nums select-text">
                              {sheet.rows.map((row, rIdx) => {
                                const isMergedTitleRow =
                                  rIdx === 0 && sheet.merges.length > 0;
                                const rowAnchorId = `sheet-${sheet.name}-row-${rIdx}`;
                                const isSelectedRow = selectedRowIdx === rIdx;
                                const hasRowAnnotation = allDocAnnotations.some(
                                  (a) => a.sectionId === rowAnchorId,
                                );
                                return (
                                  <tr
                                    key={rIdx}
                                    id={rowAnchorId}
                                    onClick={() =>
                                      setSelectedRowIdx((prev) =>
                                        prev === rIdx ? null : rIdx,
                                      )
                                    }
                                    title="Click row to pin an item-specific annotation"
                                    className={`cursor-pointer transition-colors ${
                                      isSelectedRow
                                        ? 'bg-[#2563EB]/15 ring-1 ring-inset ring-[#2563EB]/60 dark:bg-[#60A5FA]/20'
                                        : rIdx === 0
                                          ? 'bg-[#1C1E21] text-white font-semibold'
                                          : rIdx === 1
                                            ? 'bg-[#93C5FD]/25 font-semibold text-[#14171A] dark:text-white'
                                            : 'hover:bg-[#F3F5F7]/60 dark:hover:bg-[#161B22]'
                                    }`}
                                  >
                                    <td className="border border-black/[0.07] px-2 py-2 text-center text-[#64748B] dark:border-white/10 relative">
                                      <span>{rIdx + 1}</span>
                                      {hasRowAnnotation && (
                                        <span
                                          className="absolute right-1 top-1 size-1.5 rounded-full bg-[#FDE047]"
                                          title="Pinned annotation"
                                        />
                                      )}
                                    </td>
                                    {isMergedTitleRow ? (
                                      <td
                                        colSpan={Math.max(1, row.length)}
                                        className="border border-black/[0.07] px-3 py-2.5 text-[#FDE047] dark:border-white/10"
                                      >
                                        {row[0] ?? ''}
                                      </td>
                                    ) : (
                                      row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className={`border border-black/[0.07] px-3 py-2 dark:border-white/10 ${
                                            typeof cell === 'number'
                                              ? 'text-right'
                                              : ''
                                          }`}
                                        >
                                          {typeof cell === 'number'
                                            ? cell.toLocaleString('en-US')
                                            : cell ?? ''}
                                        </td>
                                      ))
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}

              {/* 5. IMAGE ENGINE VIEW */}
              {activeDoc.status === 'ready' && activeDoc.format === 'image' && (
                <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 dark:bg-[#0D1117] border border-black/[0.06] dark:border-white/[0.08]">
                  <GridReveal
                    src={activeDoc.imageDataUrl ?? '/icon.svg'}
                    alt={activeDoc.name}
                    aspect={16 / 10}
                    caption={activeDoc.name}
                  />
                </div>
              )}

              {/* 6. PLAINTEXT VIEW */}
              {activeDoc.status === 'ready' && activeDoc.format === 'txt' && (
                <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 font-mono text-sm leading-relaxed text-[#14171A] dark:bg-[#0D1117] dark:text-[#E2E8F0] select-text">
                  <pre className="whitespace-pre-wrap select-text">
                    {activeDoc.extractedText}
                  </pre>
                </div>
              )}

              {/* Floating Bottom ScrollProgress Pill (3s hover reveals dismiss ×) */}
              {outlineSections.length > 0 && (
                <ScrollProgress
                  sections={outlineSections.slice(0, 45).map((s) => ({
                    id: s.id,
                    label: s.label.slice(0, 32),
                  }))}
                  containerRef={scrollContainerRef}
                  resetKey={`${activeDoc.id}-${activeSheetIndex}`}
                  onSelectSection={(id, idx) => {
                    setActiveOutlineIdx(idx);
                    const sec = outlineSections[idx];
                    scrollToElementId(id, sec?.pageNumber);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Bookmarks & Item-Specific Local Annotations (Privacy Telemetry Removed) */}
        {!isFullView && (
          <div className="xl:col-span-4 flex flex-col gap-5">
            {/* Document Bookmarks Card */}
            <div className="rounded-[24px] bg-[#F3F5F7] p-5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-[#2563EB] dark:text-[#60A5FA]" />
                  <h3 className="text-sm font-bold text-[#14171A] dark:text-white">
                    Document Bookmarks ({docBookmarks.length})
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[#64748B]">
                  {currentItemTarget.targetLabel}
                </span>
              </div>

              <form onSubmit={handleSaveBookmark} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={bookmarkInput}
                  onChange={(e) => setBookmarkInput(e.target.value)}
                  placeholder={`Bookmark ${currentItemTarget.targetLabel}...`}
                  aria-label="Bookmark label"
                  className="flex-1 rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#0D1117] dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#93C5FD] px-4 py-2 text-xs font-bold text-[#14171A] transition hover:bg-[#60A5FA] cursor-pointer"
                >
                  Save
                </button>
              </form>

              <div className="mt-3 space-y-2">
                {docBookmarks.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    No bookmarks yet for this document.
                  </p>
                ) : (
                  docBookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs dark:bg-[#0D1117] border border-black/[0.05] dark:border-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          scrollToElementId(
                            bm.sectionId ?? 'pdf-page-1',
                            bm.pageOrSlide,
                          )
                        }
                        className="truncate font-semibold text-[#14171A] hover:text-[#2563EB] dark:text-white dark:hover:text-[#60A5FA] text-left cursor-pointer"
                      >
                        {bm.label}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove bookmark ${bm.label}`}
                        onClick={() => removeBookmark(bm.id)}
                        className="text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Item-Specific / Page-Specific Local Annotations Card */}
            <div
              data-testid="item-annotations-card"
              className="rounded-[24px] bg-[#F3F5F7] p-5 dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.07]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="size-4 text-[#D97706] dark:text-[#FDE047]" />
                  <h3 className="text-sm font-bold text-[#14171A] dark:text-white">
                    Item Annotations ({visibleAnnotations.length})
                  </h3>
                </div>

                {/* This Item vs All Document Annotations Toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-white/80 p-0.5 dark:bg-[#0D1117]">
                  <button
                    type="button"
                    onClick={() => setAnnotationScope('item')}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                      annotationScope === 'item'
                        ? 'bg-[#1C1E21] text-white dark:bg-[#60A5FA] dark:text-[#0D1117]'
                        : 'text-[#64748B] hover:text-[#14171A] dark:text-[#94A3B8]'
                    }`}
                  >
                    This Item
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnotationScope('all')}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                      annotationScope === 'all'
                        ? 'bg-[#1C1E21] text-white dark:bg-[#60A5FA] dark:text-[#0D1117]'
                        : 'text-[#64748B] hover:text-[#14171A] dark:text-[#94A3B8]'
                    }`}
                  >
                    All ({allDocAnnotations.length})
                  </button>
                </div>
              </div>

              {/* Active Target Pin Context + Color Dots */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-[#2563EB] dark:bg-[#0D1117] dark:text-[#60A5FA] border border-black/[0.06] dark:border-white/[0.08] truncate">
                  <Pin className="size-3 shrink-0" />
                  <span className="truncate">{currentItemTarget.targetLabel}</span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {(['blue', 'yellow', 'slate'] as const).map((col) => {
                    const bgMap = {
                      blue: 'bg-[#93C5FD]',
                      yellow: 'bg-[#FDE047]',
                      slate: 'bg-[#94A3B8]',
                    };
                    return (
                      <button
                        key={col}
                        type="button"
                        aria-label={`Select ${col} annotation tag`}
                        onClick={() => setAnnotationColor(col)}
                        className={`size-4 rounded-full ${bgMap[col]} ${
                          annotationColor === col
                            ? 'ring-2 ring-[#14171A] dark:ring-white'
                            : 'opacity-60'
                        } cursor-pointer`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Highlighted Text Quote Preview (if user highlighted text in viewer) */}
              {annotationQuote && (
                <div className="mt-2 flex items-start justify-between gap-2 rounded-xl bg-[#93C5FD]/20 px-3 py-2 text-[11px] italic text-[#14171A] dark:bg-[#60A5FA]/15 dark:text-[#E2E8F0]">
                  <span className="line-clamp-2">“{annotationQuote}”</span>
                  <button
                    type="button"
                    aria-label="Clear selected quote"
                    onClick={() => setAnnotationQuote('')}
                    className="shrink-0 text-[#64748B] hover:text-[#14171A] dark:hover:text-white cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveAnnotation} className="mt-2.5 space-y-2.5">
                <textarea
                  rows={2}
                  value={annotationInput}
                  onChange={(e) => setAnnotationInput(e.target.value)}
                  placeholder={`Note for ${currentItemTarget.targetLabel}…`}
                  aria-label="Item-specific annotation note"
                  className="w-full rounded-2xl border border-black/10 bg-white p-3 text-xs text-[#14171A] outline-none focus:border-[#2563EB] dark:border-white/10 dark:bg-[#0D1117] dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#FDE047] py-2 text-xs font-bold text-[#14171A] transition hover:bg-[#FACC15] cursor-pointer"
                >
                  Pin Note to {currentItemTarget.targetLabel}
                </button>
              </form>

              <div className="mt-3 space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
                {visibleAnnotations.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {activeDoc.format === 'xlsx' || activeDoc.format === 'csv'
                      ? 'Click any row to pin a row-specific note, or add a sheet note above.'
                      : `No notes pinned to ${currentItemTarget.targetLabel} yet.`}
                  </p>
                ) : (
                  visibleAnnotations.map((ann) => (
                    <div
                      key={ann.id}
                      className={`rounded-xl p-3 text-xs ${
                        ann.color === 'blue'
                          ? 'bg-[#93C5FD]/35 text-[#14171A] dark:bg-[#93C5FD]/15 dark:text-white'
                          : ann.color === 'yellow'
                            ? 'bg-[#FDE047]/45 text-[#14171A] dark:bg-[#FDE047]/15 dark:text-white'
                            : 'bg-white text-[#14171A] dark:bg-[#0D1117] dark:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() =>
                            scrollToElementId(
                              ann.sectionId ?? 'pdf-page-1',
                              ann.pageOrSlide,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 cursor-pointer"
                        >
                          <Pin className="size-2.5" />
                          <span>
                            {ann.targetLabel ??
                              (ann.pageOrSlide
                                ? `Page ${ann.pageOrSlide}`
                                : 'Pinned Item')}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Delete annotation"
                          onClick={() => removeAnnotation(ann.id)}
                          className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {ann.quote && (
                        <p className="mb-1 border-l-2 border-current/40 pl-2 text-[11px] italic opacity-80 line-clamp-2">
                          “{ann.quote}”
                        </p>
                      )}
                      <p className="leading-relaxed">{ann.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
