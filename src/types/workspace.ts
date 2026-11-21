export type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'csv'
  | 'txt'
  | 'image'
  | 'unknown';

export type WorkspaceMode =
  | 'library'
  | 'viewer'
  | 'canvas'
  | 'xray'
  | 'compare';

export interface WorkspaceFolder {
  id: string;
  name: string;
  subtitle: string;
  color: 'blue' | 'amber' | 'black' | 'white';
  isDefault?: boolean;
}

export interface DocumentSection {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  kind: 'title' | 'subtitle' | 'section' | 'body' | 'table' | 'slide' | 'sheet' | 'formula';
  pageOrSlide?: number;
  previewText?: string;
  wordCount?: number;
}

export interface SpreadsheetSheet {
  name: string;
  rows: (string | number | boolean | null)[][];
  formulas: { cell: string; formula: string; value: string | number | null }[];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
}

export interface PresentationSlide {
  index: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
  layout: 'title' | 'two-column' | 'metrics' | 'architecture';
  accentColor: 'blue' | 'yellow' | 'obsidian' | 'slate';
  shapes?: { type: string; label: string; value?: string }[];
}

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  sectionId?: string;
  pageOrSlide?: number;
  targetLabel?: string;
  quote?: string;
  note: string;
  color: 'blue' | 'yellow' | 'slate';
  createdAt: string;
}

export interface DocumentBookmark {
  id: string;
  documentId: string;
  sectionId?: string;
  pageOrSlide?: number;
  label: string;
  createdAt: string;
}

export interface PrivacySecurityAudit {
  networkRequestsBlocked: number;
  macrosNeutralized: number;
  externalLinksSanitized: number;
  executedInWebWorker: boolean;
  localPersistenceEngine: 'IndexedDB + OPFS' | 'IndexedDB';
  sha256Fingerprint: string;
  unsupportedFeatures: string[];
}

export interface EngineBenchmarkMetrics {
  engineName: string;
  parseDurationMs: number;
  renderDurationMs: number;
  memoryEstimateMb: number;
  fidelityScore: string;
  license: string;
}

export interface LocalDocumentRecord {
  id: string;
  name: string;
  format: DocumentFormat;
  mimeType: string;
  sizeBytes: number;
  importedAt: string;
  lastOpenedAt: string;
  folderCategory: 'architecture' | 'financials' | 'presentations' | 'audits' | string;
  status: 'ready' | 'parsing' | 'corrupted' | 'unsupported';
  errorMessage?: string;
  rawBytes?: ArrayBuffer;
  extractedText: string;
  htmlPreview?: string;
  pageCount: number;
  sections: DocumentSection[];
  sheets?: SpreadsheetSheet[];
  slides?: PresentationSlide[];
  imageDataUrl?: string;
  privacyAudit: PrivacySecurityAudit;
  benchmark: EngineBenchmarkMetrics;
  isSyntheticFixture?: boolean;
}

export interface CanvasNodeItem {
  id: string;
  documentId?: string;
  type: 'document' | 'note' | 'xray-card';
  title: string;
  subtitle?: string;
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: 'blue' | 'yellow' | 'obsidian' | 'white';
  connectedTo?: string[];
}

export interface CompareDiffLine {
  lineNumberA?: number;
  lineNumberB?: number;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  textA?: string;
  textB?: string;
}

export interface CompareResult {
  docAId: string;
  docBId: string;
  similarityPercent: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  sectionDelta: {
    onlyInA: string[];
    onlyInB: string[];
    shared: string[];
  };
  lines: CompareDiffLine[];
}

export interface LocalUserAccount {
  id: string;
  name: string;
  email: string;
  tier: 'guest' | 'local-pro';
  createdAt: string;
}
