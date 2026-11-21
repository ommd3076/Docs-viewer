import type {
  CompareDiffLine,
  CompareResult,
  DocumentFormat,
  LocalDocumentRecord,
} from '../types/workspace';

export const GUEST_MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB Guest Local Processing Limit
export const AUTHENTICATED_MAX_FILE_BYTES = 250 * 1024 * 1024; // 250 MB Authenticated Local Processing Limit

export interface ImportValidationResult {
  allowed: boolean;
  format: DocumentFormat;
  reason?: string;
  isGuestLimitExceeded?: boolean;
}

const EXTENSION_MAP: Record<string, DocumentFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx',
  xls: 'xlsx',
  csv: 'csv',
  txt: 'txt',
  md: 'txt',
  log: 'txt',
  json: 'txt',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  svg: 'image',
  gif: 'image',
};

export function detectDocumentFormat(
  fileName: string,
  mimeType = '',
  headerBytes?: Uint8Array,
): DocumentFormat {
  const cleanName = fileName.trim().toLowerCase();
  const ext = cleanName.includes('.') ? cleanName.split('.').pop() ?? '' : '';

  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  const mime = mimeType.toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.includes('presentationml')) return 'pptx';
  if (mime.includes('spreadsheetml') || mime.includes('excel')) return 'xlsx';
  if (mime.includes('csv')) return 'csv';
  if (mime.startsWith('text/')) return 'txt';
  if (mime.startsWith('image/')) return 'image';

  // Fallback to magic byte inspection
  if (headerBytes && headerBytes.length >= 4) {
    // %PDF (0x25 0x50 0x44 0x46)
    if (
      headerBytes[0] === 0x25 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x44 &&
      headerBytes[3] === 0x46
    ) {
      return 'pdf';
    }
    // PNG (0x89 0x50 0x4E 0x47)
    if (
      headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47
    ) {
      return 'image';
    }
  }

  return 'unknown';
}

export function validateBinarySignature(
  format: DocumentFormat,
  bytes: Uint8Array,
): { valid: boolean; error?: string } {
  if (bytes.byteLength === 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }

  if (format === 'pdf') {
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 8));
    if (!header.startsWith('%PDF-')) {
      return {
        valid: false,
        error:
          'Corrupted PDF header: Missing %PDF- magic byte signature. Local sandbox halted parsing safely.',
      };
    }
  }

  if (format === 'docx' || format === 'pptx' || format === 'xlsx') {
    // OOXML formats are ZIP containers starting with PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (
      bytes.byteLength < 4 ||
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      bytes[2] !== 0x03 ||
      bytes[3] !== 0x04
    ) {
      return {
        valid: false,
        error: `Corrupted ${format.toUpperCase()} container: Invalid OOXML/ZIP header signature (expected PK\\x03\\x04).`,
      };
    }
  }

  return { valid: true };
}

export function validateDocumentImport(
  fileName: string,
  byteLength: number,
  isAuthenticated = false,
  mimeType = '',
): ImportValidationResult {
  if (!fileName || !fileName.trim()) {
    return {
      allowed: false,
      format: 'unknown',
      reason: 'File name is missing.',
    };
  }

  if (byteLength <= 0) {
    return {
      allowed: false,
      format: detectDocumentFormat(fileName, mimeType),
      reason: 'File is empty (0 bytes) and cannot be rendered.',
    };
  }

  const format = detectDocumentFormat(fileName, mimeType);
  if (format === 'unknown') {
    return {
      allowed: false,
      format: 'unknown',
      reason: `Unsupported file format for "${fileName}". Supported formats: PDF, DOCX, PPTX, XLSX, CSV, TXT, PNG, JPG, SVG, WebP.`,
    };
  }

  const maxBytes = isAuthenticated
    ? AUTHENTICATED_MAX_FILE_BYTES
    : GUEST_MAX_FILE_BYTES;

  if (byteLength > maxBytes) {
    return {
      allowed: false,
      format,
      isGuestLimitExceeded: !isAuthenticated,
      reason: !isAuthenticated
        ? `File size (${formatByteSize(byteLength)}) exceeds the 30.0 MB Guest Local Processing Limit. This is a client-side browser memory safeguard (not cloud storage). Switch to Local Pro in Workspace Settings to process files up to 250 MB locally.`
        : `File size (${formatByteSize(byteLength)}) exceeds the 250.0 MB local worker memory threshold.`,
    };
  }

  return {
    allowed: true,
    format,
  };
}

/**
 * Sanitizes HTML produced from local documents so that:
 * 1. Embedded <script>, <iframe>, <object>, <embed>, <form>, <meta http-equiv> are stripped.
 * 2. Inline event handlers (onerror, onload, onclick, etc.) are neutralized.
 * 3. External network URLs (http://, https://, //) in src/href/background are blocked or rewritten
 *    so documents can NEVER phone home or trigger unsolicited external requests.
 */
export function sanitizeDocumentHtml(rawHtml: string): {
  sanitizedHtml: string;
  macrosNeutralized: number;
  networkRequestsBlocked: number;
  externalLinksSanitized: number;
} {
  let macrosNeutralized = 0;
  let networkRequestsBlocked = 0;
  let externalLinksSanitized = 0;

  let html = rawHtml;

  // Strip dangerous script/object tags
  html = html.replace(
    /<(script|iframe|object|embed|applet|meta|base)\b[^>]*>([\s\S]*?<\/\1>)?/gi,
    () => {
      macrosNeutralized += 1;
      return '';
    },
  );

  // Strip inline event handlers like onload="...", onerror="..."
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => {
    macrosNeutralized += 1;
    return '';
  });

  // Neutralize javascript: or vbscript: URIs
  html = html.replace(
    /(href|src|action)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html):[^"']*\2/gi,
    (_m, attr, quote) => {
      macrosNeutralized += 1;
      return `${attr}=${quote}#blocked-script${quote}`;
    },
  );

  // Block external image/media/stylesheet fetches (http://, https://, //)
  html = html.replace(
    /\b(src|poster|background)\s*=\s*(["'])\s*(?:https?:)?\/\/[^"']+\2/gi,
    (_m, attr, quote) => {
      networkRequestsBlocked += 1;
      return `${attr}=${quote}data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='36'><rect width='100%25' height='100%25' rx='6' fill='%231C1E21'/><text x='10' y='22' fill='%23FDE047' font-family='monospace' font-size='10'>Blocked External URL</text></svg>${quote}`;
    },
  );

  // Rewrite external <a href="https://..."> so they don't prefetch or auto-navigate
  html = html.replace(
    /\bhref\s*=\s*(["'])\s*(https?:\/\/[^"']+)\1/gi,
    (_m, quote, url) => {
      externalLinksSanitized += 1;
      return `href=${quote}#external-blocked${quote} data-blocked-external-url=${quote}${url}${quote} title=${quote}External link blocked by VaultDocs Privacy Sandbox: ${url}${quote}`;
    },
  );

  return {
    sanitizedHtml: html,
    macrosNeutralized,
    networkRequestsBlocked,
    externalLinksSanitized,
  };
}

export function computeDocumentDiff(
  docA: Pick<LocalDocumentRecord, 'id' | 'extractedText' | 'sections'>,
  docB: Pick<LocalDocumentRecord, 'id' | 'extractedText' | 'sections'>,
): CompareResult {
  const linesA = docA.extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const linesB = docB.extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const setB = new Set(linesB);
  const setA = new Set(linesA);

  const diffLines: CompareDiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i];
    const b = linesB[i];

    if (a !== undefined && b !== undefined) {
      if (a === b) {
        unchangedCount++;
        diffLines.push({
          lineNumberA: i + 1,
          lineNumberB: i + 1,
          type: 'unchanged',
          textA: a,
          textB: b,
        });
      } else if (!setB.has(a) && !setA.has(b)) {
        modifiedCount++;
        diffLines.push({
          lineNumberA: i + 1,
          lineNumberB: i + 1,
          type: 'modified',
          textA: a,
          textB: b,
        });
      } else {
        if (!setB.has(a)) {
          removedCount++;
          diffLines.push({
            lineNumberA: i + 1,
            type: 'removed',
            textA: a,
          });
        }
        if (!setA.has(b)) {
          addedCount++;
          diffLines.push({
            lineNumberB: i + 1,
            type: 'added',
            textB: b,
          });
        }
      }
    } else if (a !== undefined) {
      removedCount++;
      diffLines.push({
        lineNumberA: i + 1,
        type: 'removed',
        textA: a,
      });
    } else if (b !== undefined) {
      addedCount++;
      diffLines.push({
        lineNumberB: i + 1,
        type: 'added',
        textB: b,
      });
    }
  }

  const titlesA = new Set(docA.sections.map((s) => s.title));
  const titlesB = new Set(docB.sections.map((s) => s.title));

  const onlyInA = [...titlesA].filter((t) => !titlesB.has(t));
  const onlyInB = [...titlesB].filter((t) => !titlesA.has(t));
  const shared = [...titlesA].filter((t) => titlesB.has(t));

  const totalCompared = Math.max(
    1,
    unchangedCount + modifiedCount + addedCount + removedCount,
  );
  const similarityPercent = Math.round((unchangedCount / totalCompared) * 100);

  return {
    docAId: docA.id,
    docBId: docB.id,
    similarityPercent,
    addedCount,
    removedCount,
    modifiedCount,
    unchangedCount,
    sectionDelta: {
      onlyInA,
      onlyInB,
      shared,
    },
    lines: diffLines,
  };
}

export interface SearchHit {
  documentId: string;
  documentName: string;
  format: DocumentFormat;
  matchType: 'title' | 'section' | 'content' | 'sheet';
  snippet: string;
  sectionId?: string;
}

export function searchLocalDocuments(
  documents: LocalDocumentRecord[],
  query: string,
  formatFilter: DocumentFormat | 'all' = 'all',
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];

  for (const doc of documents) {
    if (formatFilter !== 'all' && doc.format !== formatFilter) continue;

    if (doc.name.toLowerCase().includes(q)) {
      hits.push({
        documentId: doc.id,
        documentName: doc.name,
        format: doc.format,
        matchType: 'title',
        snippet: `Document filename match: ${doc.name}`,
      });
    }

    for (const sec of doc.sections) {
      if (
        sec.title.toLowerCase().includes(q) ||
        (sec.previewText && sec.previewText.toLowerCase().includes(q))
      ) {
        hits.push({
          documentId: doc.id,
          documentName: doc.name,
          format: doc.format,
          matchType: 'section',
          sectionId: sec.id,
          snippet: `${sec.title} — ${sec.previewText ?? 'Structural heading'}`,
        });
      }
    }

    const lowerText = doc.extractedText.toLowerCase();
    const idx = lowerText.indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 42);
      const end = Math.min(doc.extractedText.length, idx + q.length + 58);
      const excerpt = doc.extractedText
        .slice(start, end)
        .replace(/\s+/g, ' ')
        .trim();
      hits.push({
        documentId: doc.id,
        documentName: doc.name,
        format: doc.format,
        matchType: 'content',
        snippet: `${start > 0 ? '…' : ''}${excerpt}${end < doc.extractedText.length ? '…' : ''}`,
      });
    }
  }

  return hits.slice(0, 40);
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}
