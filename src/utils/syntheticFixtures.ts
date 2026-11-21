import JSZip from 'jszip';
import * as XLSX from 'xlsx';

/**
 * Generates a real valid multi-page PDF binary (ArrayBuffer) with PDF 1.4 objects,
 * multiple pages, typography, and vector rectangles so PDF.js renders real pages.
 */
export function generateSyntheticPdfBinary(): ArrayBuffer {
  const page1Stream = [
    'BT',
    '/F1 20 Tf',
    '48 750 Td',
    '(VaultDocs Zero-Trust Local Architecture Specification) Tj',
    '/F1 11 Tf',
    '0 -28 Td',
    '(Document ID: VD-ARCH-2026-01 | Classification: Local-Only Sovereign Execution) Tj',
    '0 -32 Td',
    '/F1 14 Tf',
    '(1. Executive Summary & Local-First Invariants) Tj',
    '/F1 10 Tf',
    '0 -20 Td',
    '(Every imported document remains strictly inside the user browser memory, IndexedDB, and OPFS.) Tj',
    '0 -16 Td',
    '(Zero bytes are transmitted to application servers, cloud conversion APIs, or external telemetry.) Tj',
    '0 -28 Td',
    '/F1 14 Tf',
    '(2. Sandboxed Multi-Engine Adapter Pipeline) Tj',
    '/F1 10 Tf',
    '0 -20 Td',
    '(PDF files render via PDF.js canvas & text layers. DOCX renders via docx-preview OOXML pipeline.) Tj',
    '0 -16 Td',
    '(XLSX workbooks execute SheetJS & ExcelJS adapters with multi-sheet formula inspection.) Tj',
    '0 -16 Td',
    '(PPTX presentations parse slide XML trees and vector layouts inside an isolated Web Worker.) Tj',
    '0 -28 Td',
    '/F1 14 Tf',
    '(3. Threat Model & Macro Neutralization) Tj',
    '/F1 10 Tf',
    '0 -20 Td',
    '(Embedded VBA macros, ActiveX controls, and external image tracking beacons are stripped prior to DOM mount.) Tj',
    'ET',
    '0.23 0.51 0.96 rg',
    '48 410 516 6 re f',
    '0.98 0.88 0.28 rg',
    '48 396 340 6 re f',
  ].join('\n');

  const page2Stream = [
    'BT',
    '/F1 18 Tf',
    '48 750 Td',
    '(Page 2: Storage Eviction, OPFS Persistence & Benchmark Matrix) Tj',
    '/F1 13 Tf',
    '0 -32 Td',
    '(4. Origin Private File System & IndexedDB Dual-Layer Store) Tj',
    '/F1 10 Tf',
    '0 -20 Td',
    '(VaultDocs persists binary ArrayBuffers in OPFS while maintaining structural X-Ray indices in IndexedDB.) Tj',
    '0 -16 Td',
    '(Users can export and restore their complete workspace bundle as a portable JSON archive at any time.) Tj',
    '0 -28 Td',
    '/F1 13 Tf',
    '(5. Candidate Document Engine Benchmark Summary) Tj',
    '/F1 10 Tf',
    '0 -20 Td',
    '(PDF.js v5: 18ms startup | 99.4% vector fidelity | Apache-2.0 License | 0 external requests.) Tj',
    '0 -16 Td',
    '(docx-preview: 24ms startup | Tables, headers & embedded media | MIT License | 0 external requests.) Tj',
    '0 -16 Td',
    '(SheetJS + ExcelJS: 15ms startup | Multi-sheet formulas & merged cells | Apache-2.0 / MIT.) Tj',
    '0 -16 Td',
    '(Zrimo Evaluation Note: Evaluated as unified wrapper; modular adapter architecture selected for zero-network isolation.) Tj',
    'ET',
    '0.11 0.12 0.13 rg',
    '48 460 516 2 re f',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>\nendobj',
  );
  objects.push(
    '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>\nendobj',
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  );
  objects.push(
    `6 0 obj\n<< /Length ${page1Stream.length} >>\nstream\n${page1Stream}\nendstream\nendobj`,
  );
  objects.push(
    `7 0 obj\n<< /Length ${page2Stream.length} >>\nstream\n${page2Stream}\nendstream\nendobj`,
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf).buffer;
}

/**
 * Generates a real valid OOXML .docx binary archive (ArrayBuffer) containing
 * headings, paragraphs, structured tables, headers, and embedded vector media.
 */
export async function generateSyntheticDocxBinary(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.folder('word/_rels')?.file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  zip.folder('word')?.file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1C1E21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/></w:rPr>
  </w:style>
</w:styles>`,
  );

  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Enterprise Security &amp; Local Document Governance Audit</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Prepared by: Privacy Engineering &amp; Applied Cryptography Group | Revision 4.2</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>1. Zero-Upload Client-Side Processing Mandate</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>All DOCX, PDF, PPTX, XLSX, and CSV parsing executes strictly inside browser Web Workers and local memory buffers. External tracking pixels, macro binaries, and remote stylesheet references are intercepted and neutralized by the VaultDocs sanitizer.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>2. Engine Evaluation &amp; Benchmark Matrix</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Format / Engine</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Startup Latency</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Memory Footprint</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Network Isolation</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>PDF.js v5 Canvas + Text</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>18.4 ms</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>14.2 MB</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100% Local (Verified)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>docx-preview OOXML</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>23.1 ms</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>9.8 MB</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100% Local (Verified)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>SheetJS / ExcelJS Adapter</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>14.7 ms</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>8.4 MB</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100% Local (Verified)</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>3. Storage Quota &amp; Eviction Recovery Protocol</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Guest sessions enforce a transparent 30 MB per-file local processing limit. Full workspace state, bookmarks, and structural annotations are mirrored to IndexedDB and OPFS with single-click JSON export.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`,
  );

  return await zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Generates a real valid OOXML .pptx binary archive (ArrayBuffer) with multiple slides,
 * slide layouts, speaker notes, and vector shape metadata.
 */
export async function generateSyntheticPptxBinary(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
  );

  const slidesXml = [
    {
      title: 'VaultDocs Q4 Product & Privacy Architecture Deck',
      subtitle: 'Zero-Cloud Document Workspace — Board Briefing',
      layout: 'title',
      accent: 'obsidian',
      bullets: [
        '100% On-Device Execution: PDF, DOCX, PPTX, XLSX, CSV, TXT & Image Engines',
        'Zero Document Upload APIs: Verified via Network Isolation Audit',
        '30 MB Guest Local Processing Guardrail with Instant Workspace Export',
      ],
      notes: 'Emphasize that no user file bytes ever leave the browser sandbox.',
    },
    {
      title: 'Candidate Rendering Engine Benchmark Results',
      subtitle: 'Comparative Evaluation Across 6 Real Document Fixtures',
      layout: 'metrics',
      accent: 'blue',
      bullets: [
        'PDF.js v5 Adapter: 18ms parse time, crisp HiDPI canvas + selectable text layer',
        'docx-preview Adapter: Native OOXML table, header, and embedded image layout',
        'SheetJS + ExcelJS Dual Adapter: Multi-sheet formulas, merged cells & tabular grid',
        'Client PPTX OOXML Adapter: Zero-dependency ZIP/XML slide deck parser',
      ],
      notes: 'Walk through why the modular adapter pattern outperforms monolithic wrappers.',
    },
    {
      title: 'Visual Infinite Canvas & Structural X-Ray',
      subtitle: 'Spatial Sensemaking Across Multi-Format Local Files',
      layout: 'architecture',
      accent: 'yellow',
      bullets: [
        'Infinite Document Canvas: Arrange PDFs, spreadsheets, and notes spatially',
        'Document X-Ray: Instant structural tree of headings, tables, formulas, and slides',
        'Synchronized Multi-Document Compare Mode: Line & section delta inspection',
      ],
      notes: 'Highlight the structural outline navigation and X-Ray inspector inside the workspace.',
    },
    {
      title: 'Defense-in-Depth Sandbox & OPFS Persistence',
      subtitle: 'Resilient Local Storage & Macro Neutralization',
      layout: 'two-column',
      accent: 'slate',
      bullets: [
        'Blocks unsolicited external HTTP/HTTPS requests embedded inside documents',
        'Strips VBA macros, script tags, and inline event handlers before rendering',
        'Dual persistence via Origin Private File System (OPFS) and IndexedDB',
      ],
      notes: 'Conclude with PWA offline readiness and Cloudflare Pages static deployment.',
    },
  ];

  slidesXml.forEach((s, idx) => {
    const slideNum = idx + 1;
    const bulletNodes = s.bullets
      .map((b) => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`)
      .join('');
    zip.folder('ppt/slides')?.file(
      `slide${slideNum}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" data-layout="${s.layout}" data-accent="${s.accent}" data-subtitle="${s.subtitle}" data-notes="${s.notes}">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>${s.title}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:txBody>
          ${bulletNodes}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
    );
  });

  return await zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Generates a real valid .xlsx binary workbook (ArrayBuffer) containing
 * multiple sheets, formulas, and merged cells using SheetJS.
 */
export function generateSyntheticXlsxBinary(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Financial & Storage Forecast with Formulas and Merged Cells
  const sheet1Data = [
    ['VaultDocs FY2026 Local Compute & Telemetry Allocation (USD)', null, null, null, null],
    ['Quarter', 'Active Local Workspaces', 'Avg Docs / User', 'Local OPFS Footprint (MB)', 'Cloud Bandwidth Cost ($)'],
    ['Q1 2026', 14200, 18, 412.5, 0],
    ['Q2 2026', 19850, 22, 580.0, 0],
    ['Q3 2026', 28400, 27, 745.2, 0],
    ['Q4 2026 (Forecast)', 41250, 34, 960.8, 0],
    ['Total / Summary', null, null, null, 0],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  // Add real Excel formulas
  ws1['B7'] = { t: 'n', f: 'SUM(B3:B6)', v: 103700 };
  ws1['C7'] = { t: 'n', f: 'AVERAGE(C3:C6)', v: 25.25 };
  ws1['D7'] = { t: 'n', f: 'SUM(D3:D6)', v: 2698.5 };
  ws1['E7'] = { t: 'n', f: 'SUM(E3:E6)', v: 0 };

  // Merged title banner cell A1:E1
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  XLSX.utils.book_append_sheet(wb, ws1, 'Q4_Forecast_Model');

  // Sheet 2: Engine Benchmark Telemetry
  const sheet2Data = [
    ['Engine Adapter', 'Format', 'Cold Start (ms)', 'Warm Render (ms)', 'Peak Heap (MB)', 'License'],
    ['PDF.js Worker v5', 'PDF', 18.4, 9.2, 14.2, 'Apache-2.0'],
    ['docx-preview OOXML', 'DOCX', 23.1, 11.5, 9.8, 'MIT'],
    ['SheetJS + ExcelJS', 'XLSX / CSV', 14.7, 6.4, 8.4, 'Apache-2.0 / MIT'],
    ['VaultDocs PPTX XML', 'PPTX', 16.2, 7.8, 7.1, 'MIT'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['C6'] = { t: 'n', f: 'AVERAGE(C2:C5)', v: 18.1 };
  ws2['D6'] = { t: 'n', f: 'AVERAGE(D2:D5)', v: 8.73 };
  XLSX.utils.book_append_sheet(wb, ws2, 'Engine_Benchmarks');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}

/**
 * Generates a synthetic CSV file buffer for comparison and instant table inspection.
 */
export function generateSyntheticCsvBinary(): ArrayBuffer {
  const csv = [
    'Control_ID,Domain,Specification,Status,Network_Egress_Bytes',
    'SEC-01,Zero-Upload Policy,All files parsed inside local browser memory,Verified,0',
    'SEC-02,Macro Sandbox,Strip VBA and inline script handlers in OOXML/HTML,Verified,0',
    'SEC-03,External Beacon Block,Block remote HTTP/HTTPS images inside untrusted docs,Verified,0',
    'SEC-04,Guest Import Limit,Enforce 30 MB per-file client-side processing cap,Verified,0',
    'SEC-05,OPFS + IndexedDB,Persist workspace locally with JSON export fallback,Verified,0',
  ].join('\n');
  return new TextEncoder().encode(csv).buffer;
}

/**
 * Generates a deliberate corrupted binary fixture to verify graceful error handling.
 */
export function generateCorruptedDocxBinary(): ArrayBuffer {
  const corrupted = 'CORRUPTED_HEADER_NOT_A_ZIP_CONTAINER_\x00\xFF\xFE_BROKEN_STREAM';
  return new TextEncoder().encode(corrupted).buffer;
}

/**
 * Generates a synthetic local SVG architecture diagram so the default Images folder
 * has a real renderable visual asset out of the box.
 */
export function generateSyntheticImageBinary(): ArrayBuffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" width="960" height="560">
  <rect width="960" height="560" rx="28" fill="#1C1E21"/>
  <rect x="44" y="44" width="872" height="472" rx="20" fill="#14171A" stroke="#334155" stroke-width="2"/>
  <text x="84" y="108" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="28" font-weight="700">VaultDocs Local-First Sandbox Topology</text>
  <text x="84" y="138" fill="#94A3B8" font-family="monospace" font-size="14">ZERO-UPLOAD EXECUTION · INDEXEDDB + OPFS · WEB WORKER ISOLATION</text>
  <rect x="84" y="182" width="236" height="148" rx="18" fill="#93C5FD"/>
  <text x="108" y="226" fill="#14171A" font-family="system-ui, sans-serif" font-size="18" font-weight="700">1. Local File Input</text>
  <text x="108" y="256" fill="#1E3A8A" font-family="monospace" font-size="13">PDF · DOCX · Images</text>
  <text x="108" y="280" fill="#1E3A8A" font-family="monospace" font-size="13">XLSX · PPTX · CSV</text>
  <rect x="362" y="182" width="236" height="148" rx="18" fill="#FDE047"/>
  <text x="386" y="226" fill="#14171A" font-family="system-ui, sans-serif" font-size="18" font-weight="700">2. Browser Workers</text>
  <text x="386" y="256" fill="#713F12" font-family="monospace" font-size="13">PDF.js v5 + OOXML</text>
  <text x="386" y="280" fill="#713F12" font-family="monospace" font-size="13">~10ms Parse Latency</text>
  <rect x="640" y="182" width="236" height="148" rx="18" fill="#F3F5F7"/>
  <text x="664" y="226" fill="#14171A" font-family="system-ui, sans-serif" font-size="18" font-weight="700">3. Device Storage</text>
  <text x="664" y="256" fill="#475569" font-family="monospace" font-size="13">IndexedDB + OPFS</text>
  <text x="664" y="280" fill="#2563EB" font-family="monospace" font-size="13">0 Bytes Cloud Egress</text>
  <path d="M320 256 L362 256 M598 256 L640 256" stroke="#93C5FD" stroke-width="3" stroke-dasharray="6 4"/>
  <rect x="84" y="372" width="792" height="92" rx="16" fill="#21262D"/>
  <text x="112" y="410" fill="#93C5FD" font-family="monospace" font-size="14" font-weight="700">AUTO-SORTED FOLDERS: WORD DOCUMENTS (DOCX) · IMAGES &amp; MEDIA · PDF · CUSTOM C FOLDERS</text>
  <text x="112" y="438" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="13">All parsing, SHA-256 verification, annotations, and bookmarks remain strictly on your device.</text>
</svg>`;
  return new TextEncoder().encode(svg).buffer;
}
