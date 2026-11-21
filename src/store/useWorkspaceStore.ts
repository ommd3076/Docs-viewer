import { create } from 'zustand';
import type {
  CanvasNodeItem,
  DocumentAnnotation,
  DocumentBookmark,
  DocumentFormat,
  LocalDocumentRecord,
  LocalUserAccount,
  WorkspaceFolder,
  WorkspaceMode,
} from '../types/workspace';
import {
  generateCorruptedDocxBinary,
  generateSyntheticCsvBinary,
  generateSyntheticDocxBinary,
  generateSyntheticImageBinary,
  generateSyntheticPdfBinary,
  generateSyntheticPptxBinary,
  generateSyntheticXlsxBinary,
} from '../utils/syntheticFixtures';
import { parseLocalDocumentBuffer } from '../utils/documentEngines';
import { validateDocumentImport } from '../utils/documentRules';
import {
  deleteBinaryFromOpfs,
  loadPersistedWorkspaceState,
  type PersistedWorkspaceSnapshot,
  persistWorkspaceState,
  queryStorageDiagnostics,
} from '../utils/localPersistence';
import { toast } from '../components/rareui/toast';

export const DEFAULT_WORKSPACE_FOLDERS: WorkspaceFolder[] = [
  {
    id: 'docx',
    name: 'Word Documents',
    subtitle: 'DOCX files',
    color: 'blue',
    isDefault: true,
  },
  {
    id: 'images',
    name: 'Images & Media',
    subtitle: 'PNG, JPG, SVG, WEBP',
    color: 'amber',
    isDefault: true,
  },
  {
    id: 'pdf',
    name: 'PDF Documents',
    subtitle: 'PDF specs & manuals',
    color: 'black',
    isDefault: true,
  },
  {
    id: 'office',
    name: 'Sheets & Slides',
    subtitle: 'XLSX, CSV & PPTX',
    color: 'white',
    isDefault: true,
  },
];

export function resolveDefaultFolderForFormat(format: DocumentFormat): string {
  switch (format) {
    case 'docx':
      return 'docx';
    case 'image':
      return 'images';
    case 'pdf':
      return 'pdf';
    case 'xlsx':
    case 'csv':
    case 'pptx':
      return 'office';
    default:
      return 'docx';
  }
}

function mergeDefaultFolders(
  persistedFolders?: WorkspaceFolder[],
): WorkspaceFolder[] {
  if (!persistedFolders || persistedFolders.length === 0) {
    return [...DEFAULT_WORKSPACE_FOLDERS];
  }
  const existingIds = new Set(persistedFolders.map((f) => f.id));
  const missingDefaults = DEFAULT_WORKSPACE_FOLDERS.filter(
    (df) => !existingIds.has(df.id),
  );
  return [...missingDefaults, ...persistedFolders];
}

export interface WorkspaceStoreState {
  initialized: boolean;
  isLoadingFixtures: boolean;
  mode: WorkspaceMode;
  folderFilter: 'all' | string;
  folders: WorkspaceFolder[];
  documents: LocalDocumentRecord[];
  openTabIds: string[];
  activeDocId: string | null;
  compareDocAId: string | null;
  compareDocBId: string | null;
  bookmarks: DocumentBookmark[];
  annotations: DocumentAnnotation[];
  canvasNodes: CanvasNodeItem[];
  userAccount: LocalUserAccount | null;
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  commandPaletteOpen: boolean;
  accountModalOpen: boolean;
  workerIndexedTokens: number;
  storageStats: {
    usageBytes: number;
    quotaBytes: number;
    opfsAvailable: boolean;
    persisted: boolean;
  };

  initializeWorkspace: () => Promise<void>;
  loadSyntheticSuite: (notify?: boolean) => Promise<void>;
  importFilesFromDevice: (files: FileList | File[]) => Promise<void>;
  setMode: (mode: WorkspaceMode) => void;
  setFolderFilter: (filter: 'all' | string) => void;
  createFolder: (name: string, subtitle?: string) => void;
  deleteFolder: (folderId: string) => void;
  moveDocumentToFolder: (docId: string, folderId: string) => void;
  openDocumentTab: (docId: string, switchToViewer?: boolean) => void;
  closeDocumentTab: (docId: string) => void;
  deleteDocument: (docId: string) => Promise<void>;
  setCompareDocs: (docAId: string, docBId: string) => void;
  addBookmark: (bookmark: Omit<DocumentBookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  addAnnotation: (annotation: Omit<DocumentAnnotation, 'id' | 'createdAt'>) => void;
  removeAnnotation: (id: string) => void;
  updateCanvasNodePosition: (id: string, x: number, y: number) => void;
  addCanvasNoteNode: (title: string, content: string, accent: CanvasNodeItem['accent']) => void;
  removeCanvasNode: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setReducedMotion: (reduced: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAccountModalOpen: (open: boolean) => void;
  signInLocalAccount: (name: string, email: string) => void;
  signOutLocalAccount: () => void;
  exportWorkspaceJson: () => string;
  importWorkspaceJson: (jsonText: string) => boolean;
}

function buildDefaultCanvasNodes(docs: LocalDocumentRecord[]): CanvasNodeItem[] {
  const nodes: CanvasNodeItem[] = [];
  const positions = [
    { x: 60, y: 60, accent: 'obsidian' as const },
    { x: 430, y: 60, accent: 'blue' as const },
    { x: 60, y: 320, accent: 'yellow' as const },
    { x: 430, y: 320, accent: 'white' as const },
  ];

  docs.slice(0, 4).forEach((doc, idx) => {
    const pos = positions[idx % positions.length];
    nodes.push({
      id: `canvas-doc-${doc.id}`,
      documentId: doc.id,
      type: 'document',
      title: doc.name,
      subtitle: `${doc.format.toUpperCase()} · ${doc.pageCount} ${doc.format === 'pptx' ? 'slides' : doc.format === 'xlsx' ? 'sheets' : 'pages'}`,
      content: doc.extractedText.slice(0, 180) + '…',
      x: pos.x,
      y: pos.y,
      width: 320,
      height: 210,
      accent: pos.accent,
      connectedTo: idx === 0 && docs[1] ? [`canvas-doc-${docs[1].id}`] : [],
    });
  });

  nodes.push({
    id: 'canvas-note-synthesis',
    type: 'note',
    title: 'Zero-Upload Architecture Synthesis',
    subtitle: 'Spatial Workspace Pin',
    content:
      'Cross-checked PDF Architecture Spec against Q4 XLSX Forecast: 100% of document parsing runs in local workers with $0 cloud conversion bandwidth.',
    x: 800,
    y: 140,
    width: 300,
    height: 200,
    accent: 'blue',
  });

  return nodes;
}

async function generateDefaultSyntheticRecords(): Promise<LocalDocumentRecord[]> {
  const pdfBuf = generateSyntheticPdfBinary();
  const docxBuf = await generateSyntheticDocxBinary();
  const imageBuf = generateSyntheticImageBinary();
  const pptxBuf = await generateSyntheticPptxBinary();
  const xlsxBuf = generateSyntheticXlsxBinary();
  const csvBuf = generateSyntheticCsvBinary();
  const corruptBuf = generateCorruptedDocxBinary();

  const [pdfDoc, docxDoc, imageDoc, pptxDoc, xlsxDoc, csvDoc, corruptDoc] =
    await Promise.all([
      parseLocalDocumentBuffer({
        id: 'fixture-pdf-arch',
        name: 'VaultDocs-Zero-Trust-Architecture.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuf,
        folderCategory: 'pdf',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-docx-audit',
        name: 'Enterprise-Governance-Security-Audit.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: docxBuf,
        folderCategory: 'docx',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-image-topology',
        name: 'VaultDocs-Sandbox-Diagram.svg',
        mimeType: 'image/svg+xml',
        buffer: imageBuf,
        folderCategory: 'images',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-pptx-deck',
        name: 'Q4-Board-Briefing-Local-Engine.pptx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        buffer: pptxBuf,
        folderCategory: 'office',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-xlsx-forecast',
        name: 'FY2026-Local-Compute-Forecast.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: xlsxBuf,
        folderCategory: 'office',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-csv-controls',
        name: 'Privacy-Sandbox-Verification-Matrix.csv',
        mimeType: 'text/csv',
        buffer: csvBuf,
        folderCategory: 'office',
        isSyntheticFixture: true,
      }),
      parseLocalDocumentBuffer({
        id: 'fixture-corrupted-docx',
        name: 'Corrupted-Legacy-Macro-Stream.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: corruptBuf,
        folderCategory: 'docx',
        isSyntheticFixture: true,
      }),
    ]);

  return [pdfDoc, docxDoc, imageDoc, pptxDoc, xlsxDoc, csvDoc, corruptDoc];
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  initialized: false,
  isLoadingFixtures: false,
  mode: 'library',
  folderFilter: 'all',
  folders: [...DEFAULT_WORKSPACE_FOLDERS],
  documents: [],
  openTabIds: [],
  activeDocId: null,
  compareDocAId: null,
  compareDocBId: null,
  bookmarks: [],
  annotations: [],
  canvasNodes: [],
  userAccount: null,
  theme: 'light',
  reducedMotion: false,
  commandPaletteOpen: false,
  accountModalOpen: false,
  workerIndexedTokens: 482,
  storageStats: {
    usageBytes: 142080,
    quotaBytes: 536870912,
    opfsAvailable: true,
    persisted: false,
  },

  initializeWorkspace: async () => {
    if (get().initialized) return;
    set({ isLoadingFixtures: true });

    const persisted = await loadPersistedWorkspaceState();
    const diag = await queryStorageDiagnostics();

    if (persisted && persisted.documents.length > 0) {
      const mergedFolders = mergeDefaultFolders(persisted.folders);
      const validFolderIds = new Set(mergedFolders.map((f) => f.id));

      // Seamlessly migrate any legacy folder categories to default format-based folders
      const migratedDocs = persisted.documents.map((doc) =>
        validFolderIds.has(doc.folderCategory)
          ? doc
          : {
              ...doc,
              folderCategory: resolveDefaultFolderForFormat(doc.format),
            },
      );

      set({
        initialized: true,
        isLoadingFixtures: false,
        folders: mergedFolders,
        documents: migratedDocs,
        bookmarks: persisted.bookmarks,
        annotations: persisted.annotations,
        canvasNodes:
          persisted.canvasNodes.length > 0
            ? persisted.canvasNodes
            : buildDefaultCanvasNodes(migratedDocs),
        openTabIds:
          persisted.openTabIds.length > 0
            ? persisted.openTabIds
            : migratedDocs.slice(0, 4).map((d) => d.id),
        activeDocId: persisted.activeDocId ?? migratedDocs[0]?.id ?? null,
        compareDocAId: migratedDocs[0]?.id ?? null,
        compareDocBId: migratedDocs[1]?.id ?? migratedDocs[0]?.id ?? null,
        userAccount: persisted.userAccount,
        storageStats: diag,
      });
      return;
    }

    const docs = await generateDefaultSyntheticRecords();
    const defaultBookmarks: DocumentBookmark[] = [
      {
        id: 'bm-1',
        documentId: docs[0].id,
        sectionId: docs[0].sections[0]?.id,
        pageOrSlide: 1,
        label: 'Zero-Trust Invariants & OPFS Spec',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'bm-2',
        documentId: docs[4].id,
        sectionId: docs[4].sections[0]?.id,
        pageOrSlide: 1,
        label: 'Q4 Forecast SUM & AVERAGE Formulas',
        createdAt: new Date().toISOString(),
      },
    ];

    const defaultAnnotations: DocumentAnnotation[] = [
      {
        id: 'ann-1',
        documentId: docs[0].id,
        pageOrSlide: 1,
        quote:
          'Every imported document remains strictly inside the user browser memory, IndexedDB, and OPFS.',
        note: 'Verified by automated network-isolation test: 0 upload requests emitted during multi-format parsing.',
        color: 'blue',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        documentId: docs[1].id,
        pageOrSlide: 1,
        quote:
          'Guest sessions enforce a transparent 30 MB per-file local processing limit.',
        note: 'Client-side memory guardrail clearly distinguished from cloud storage quotas.',
        color: 'yellow',
        createdAt: new Date().toISOString(),
      },
    ];

    const defaultCanvas = buildDefaultCanvasNodes(docs);
    const openTabIds = docs.slice(0, 4).map((d) => d.id);

    set({
      initialized: true,
      isLoadingFixtures: false,
      folders: [...DEFAULT_WORKSPACE_FOLDERS],
      documents: docs,
      bookmarks: defaultBookmarks,
      annotations: defaultAnnotations,
      canvasNodes: defaultCanvas,
      openTabIds,
      activeDocId: docs[0].id,
      compareDocAId: docs[0].id,
      compareDocBId: docs[1].id,
      storageStats: diag,
    });

    await persistWorkspaceState({
      documents: docs,
      folders: [...DEFAULT_WORKSPACE_FOLDERS],
      bookmarks: defaultBookmarks,
      annotations: defaultAnnotations,
      canvasNodes: defaultCanvas,
      openTabIds,
      activeDocId: docs[0].id,
      userAccount: null,
    });
  },

  loadSyntheticSuite: async (notify = true) => {
    set({ isLoadingFixtures: true });
    const docs = await generateDefaultSyntheticRecords();
    const defaultCanvas = buildDefaultCanvasNodes(docs);
    const openTabIds = docs.slice(0, 4).map((d) => d.id);
    const folders = mergeDefaultFolders(get().folders);

    set({
      isLoadingFixtures: false,
      folders,
      documents: docs,
      canvasNodes: defaultCanvas,
      openTabIds,
      activeDocId: docs[0].id,
      compareDocAId: docs[0].id,
      compareDocBId: docs[1].id,
    });

    await persistWorkspaceState({
      documents: docs,
      folders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: defaultCanvas,
      openTabIds,
      activeDocId: docs[0].id,
      userAccount: get().userAccount,
    });

    if (notify) {
      toast.success('Sample Workspace Restored', {
        description:
          'Loaded 7 local binary fixtures (PDF, DOCX, Image, PPTX, XLSX, CSV, Corrupted) into IndexedDB + OPFS.',
      });
    }
  },

  importFilesFromDevice: async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const isAuthenticated = get().userAccount?.tier === 'local-pro';
    const currentFolderFilter = get().folderFilter;
    const currentFolders = get().folders;
    const isCustomFilterActive =
      currentFolderFilter !== 'all' &&
      currentFolders.some((f) => f.id === currentFolderFilter && !f.isDefault);

    const importedDocs: LocalDocumentRecord[] = [];

    for (const file of files) {
      const check = validateDocumentImport(
        file.name,
        file.size,
        isAuthenticated,
        file.type,
      );

      if (!check.allowed) {
        toast.error('Local Import Guardrail Triggered', {
          description: check.reason,
        });
        continue;
      }

      const buffer = await file.arrayBuffer();
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // DOCX files always default to 'docx' and Image files always default to 'images',
      // unless the user explicitly imports while inside a custom folder they created.
      const folderCategory = isCustomFilterActive
        ? currentFolderFilter
        : resolveDefaultFolderForFormat(check.format);

      const parsed = await parseLocalDocumentBuffer({
        id,
        name: file.name,
        mimeType: file.type,
        buffer,
        folderCategory,
        isSyntheticFixture: false,
      });

      importedDocs.push(parsed);
    }

    if (importedDocs.length === 0) return;

    const nextDocs = [...importedDocs, ...get().documents];
    const nextTabs = Array.from(
      new Set([...importedDocs.map((d) => d.id), ...get().openTabIds]),
    );
    const firstId = importedDocs[0].id;

    const newCanvasNodes: CanvasNodeItem[] = [
      ...get().canvasNodes,
      ...importedDocs.map((d, i) => ({
        id: `canvas-doc-${d.id}`,
        documentId: d.id,
        type: 'document' as const,
        title: d.name,
        subtitle: `${d.format.toUpperCase()} · Local Device File`,
        content:
          d.extractedText.slice(0, 160) || 'Binary document loaded locally.',
        x: 120 + i * 60,
        y: 120 + i * 60,
        width: 320,
        height: 210,
        accent: 'blue' as const,
      })),
    ];

    set({
      documents: nextDocs,
      openTabIds: nextTabs,
      activeDocId: firstId,
      mode: 'viewer',
      canvasNodes: newCanvasNodes,
    });

    const diag = await queryStorageDiagnostics();
    set({ storageStats: diag });

    await persistWorkspaceState({
      documents: nextDocs,
      folders: get().folders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: newCanvasNodes,
      openTabIds: nextTabs,
      activeDocId: firstId,
      userAccount: get().userAccount,
    });

    const firstDoc = importedDocs[0];
    const targetFolder = get().folders.find(
      (f) => f.id === firstDoc.folderCategory,
    );
    if (firstDoc.status === 'corrupted') {
      toast.warning(`Opened "${firstDoc.name}" in Safe Diagnostic Mode`, {
        description: firstDoc.errorMessage,
      });
    } else {
      toast.success(`Processed ${importedDocs.length} file(s) 100% locally`, {
        description: `"${firstDoc.name}" sorted into ${targetFolder?.name ?? 'Library'} (${firstDoc.benchmark.parseDurationMs}ms).`,
      });
    }
  },

  setMode: (mode) => set({ mode }),
  setFolderFilter: (folderFilter) => set({ folderFilter }),

  createFolder: (name, subtitle = 'Custom Folder') => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = get().folders.find(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      set({ folderFilter: existing.id });
      toast.info(`Folder "${existing.name}" already exists`);
      return;
    }

    const palette: WorkspaceFolder['color'][] = ['blue', 'amber', 'black', 'white'];
    const color = palette[get().folders.length % palette.length];
    const id = `custom-${trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;

    const nextFolder: WorkspaceFolder = {
      id,
      name: trimmed,
      subtitle: subtitle.trim() || 'Custom Folder',
      color,
      isDefault: false,
    };

    const nextFolders = [...get().folders, nextFolder];
    set({ folders: nextFolders, folderFilter: id });

    persistWorkspaceState({
      documents: get().documents,
      folders: nextFolders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount: get().userAccount,
    });

    toast.success(`Created folder "${trimmed}"`, {
      description: 'Assign or drop files directly into this folder.',
    });
  },

  deleteFolder: (folderId) => {
    const target = get().folders.find((f) => f.id === folderId);
    if (!target || target.isDefault) return;

    const nextFolders = get().folders.filter((f) => f.id !== folderId);
    const nextDocs = get().documents.map((doc) =>
      doc.folderCategory === folderId
        ? {
            ...doc,
            folderCategory: resolveDefaultFolderForFormat(doc.format),
          }
        : doc,
    );

    set({
      folders: nextFolders,
      documents: nextDocs,
      folderFilter: get().folderFilter === folderId ? 'all' : get().folderFilter,
    });

    persistWorkspaceState({
      documents: nextDocs,
      folders: nextFolders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount: get().userAccount,
    });

    toast.info(`Deleted folder "${target.name}"`, {
      description: 'Files inside were moved back to their default format folders.',
    });
  },

  moveDocumentToFolder: (docId, folderId) => {
    const folder = get().folders.find((f) => f.id === folderId);
    const doc = get().documents.find((d) => d.id === docId);
    if (!folder || !doc) return;

    const nextDocs = get().documents.map((d) =>
      d.id === docId ? { ...d, folderCategory: folderId } : d,
    );
    set({ documents: nextDocs });

    persistWorkspaceState({
      documents: nextDocs,
      folders: get().folders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount: get().userAccount,
    });

    toast.success(`Moved "${doc.name}"`, {
      description: `Now organized in ${folder.name}.`,
    });
  },

  openDocumentTab: (docId, switchToViewer = true) => {
    const { openTabIds, documents } = get();
    const exists = documents.some((d) => d.id === docId);
    if (!exists) return;

    const nextTabs = openTabIds.includes(docId)
      ? openTabIds
      : [...openTabIds, docId];

    set({
      openTabIds: nextTabs,
      activeDocId: docId,
      ...(switchToViewer ? { mode: 'viewer' } : {}),
    });
  },

  closeDocumentTab: (docId) => {
    const nextTabs = get().openTabIds.filter((id) => id !== docId);
    const currentActive = get().activeDocId;
    const nextActive =
      currentActive === docId
        ? nextTabs[0] ?? get().documents[0]?.id ?? null
        : currentActive;
    set({ openTabIds: nextTabs, activeDocId: nextActive });
  },

  deleteDocument: async (docId) => {
    const target = get().documents.find((d) => d.id === docId);
    const nextDocs = get().documents.filter((d) => d.id !== docId);
    const nextTabs = get().openTabIds.filter((id) => id !== docId);
    const nextActive =
      get().activeDocId === docId
        ? nextTabs[0] ?? nextDocs[0]?.id ?? null
        : get().activeDocId;
    const nextCanvas = get().canvasNodes.filter((n) => n.documentId !== docId);

    set({
      documents: nextDocs,
      openTabIds: nextTabs,
      activeDocId: nextActive,
      canvasNodes: nextCanvas,
    });

    await deleteBinaryFromOpfs(docId);
    await persistWorkspaceState({
      documents: nextDocs,
      folders: get().folders,
      bookmarks: get().bookmarks.filter((b) => b.documentId !== docId),
      annotations: get().annotations.filter((a) => a.documentId !== docId),
      canvasNodes: nextCanvas,
      openTabIds: nextTabs,
      activeDocId: nextActive,
      userAccount: get().userAccount,
    });

    if (target) {
      toast.info(`Removed "${target.name}" from local storage`, {
        description: 'Purged from IndexedDB and Origin Private File System.',
      });
    }
  },

  setCompareDocs: (docAId, docBId) =>
    set({ compareDocAId: docAId, compareDocBId: docBId }),

  addBookmark: (bm) => {
    const next: DocumentBookmark = {
      ...bm,
      id: `bm-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const bookmarks = [next, ...get().bookmarks];
    set({ bookmarks });
    persistWorkspaceState({
      documents: get().documents,
      folders: get().folders,
      bookmarks,
      annotations: get().annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount: get().userAccount,
    });
    toast.success('Bookmark saved locally', {
      description: bm.label,
    });
  },

  removeBookmark: (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    set({ bookmarks });
  },

  addAnnotation: (ann) => {
    const next: DocumentAnnotation = {
      ...ann,
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const annotations = [next, ...get().annotations];
    set({ annotations });
    persistWorkspaceState({
      documents: get().documents,
      folders: get().folders,
      bookmarks: get().bookmarks,
      annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount: get().userAccount,
    });
    toast.success('Annotation recorded in local store', {
      description: ann.note.slice(0, 64),
    });
  },

  removeAnnotation: (id) => {
    const annotations = get().annotations.filter((a) => a.id !== id);
    set({ annotations });
  },

  updateCanvasNodePosition: (id, x, y) => {
    const canvasNodes = get().canvasNodes.map((n) =>
      n.id === id ? { ...n, x, y } : n,
    );
    set({ canvasNodes });
  },

  addCanvasNoteNode: (title, content, accent) => {
    const newNode: CanvasNodeItem = {
      id: `canvas-note-${Date.now()}`,
      type: 'note',
      title,
      subtitle: 'Spatial Synthesis Note',
      content,
      x: 240 + Math.round(Math.random() * 140),
      y: 160 + Math.round(Math.random() * 120),
      width: 300,
      height: 195,
      accent,
    };
    const canvasNodes = [...get().canvasNodes, newNode];
    set({ canvasNodes });
    toast.success('Added spatial card to Infinite Canvas');
  },

  removeCanvasNode: (id) => {
    set({ canvasNodes: get().canvasNodes.filter((n) => n.id !== id) });
  },

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    set({ theme });
  },

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setAccountModalOpen: (accountModalOpen) => set({ accountModalOpen }),

  signInLocalAccount: (name, email) => {
    const userAccount: LocalUserAccount = {
      id: `local-user-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      tier: 'local-pro',
      createdAt: new Date().toISOString(),
    };
    set({ userAccount, accountModalOpen: false });
    persistWorkspaceState({
      documents: get().documents,
      folders: get().folders,
      bookmarks: get().bookmarks,
      annotations: get().annotations,
      canvasNodes: get().canvasNodes,
      openTabIds: get().openTabIds,
      activeDocId: get().activeDocId,
      userAccount,
    });
    toast.success(`Signed in as ${userAccount.name} (Local Pro)`, {
      description: 'Per-file local worker limit increased from 30 MB to 250 MB.',
    });
  },

  signOutLocalAccount: () => {
    set({ userAccount: null });
    toast.info('Switched to Guest Mode', {
      description: '30 MB per-file local processing limit active.',
    });
  },

  exportWorkspaceJson: () => {
    const state = get();
    const snapshot: PersistedWorkspaceSnapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documents: state.documents.map(({ rawBytes: _rb, ...rest }) => rest),
      folders: state.folders,
      bookmarks: state.bookmarks,
      annotations: state.annotations,
      canvasNodes: state.canvasNodes,
      openTabIds: state.openTabIds,
      activeDocId: state.activeDocId,
      userAccount: state.userAccount,
    };
    return JSON.stringify(snapshot, null, 2);
  },

  importWorkspaceJson: (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText) as PersistedWorkspaceSnapshot;
      if (!parsed || !Array.isArray(parsed.documents)) {
        throw new Error('Invalid workspace snapshot schema');
      }
      set({
        folders: mergeDefaultFolders(parsed.folders),
        bookmarks: parsed.bookmarks ?? [],
        annotations: parsed.annotations ?? [],
        canvasNodes: parsed.canvasNodes ?? get().canvasNodes,
      });
      toast.success('Workspace Snapshot Restored', {
        description: `Restored ${parsed.bookmarks?.length ?? 0} bookmarks and ${parsed.annotations?.length ?? 0} annotations.`,
      });
      return true;
    } catch (err) {
      toast.error('Failed to restore workspace JSON', {
        description: err instanceof Error ? err.message : 'Malformed JSON file',
      });
      return false;
    }
  },
}));
