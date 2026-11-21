# Privacy & Security Architecture (`PRIVACY.md`)

## Non-Negotiable Local-First Guarantees

1. **Zero Document Uploads**: VaultDocs contains **no document-upload API endpoints**. Imported file bytes and extracted text never leave the user's device.
2. **100% Client-Side Parsing & Indexing**: All PDF (`pdfjs-dist`), DOCX (`docx-preview` + `jszip`), PPTX (`jszip` + XML parser), XLSX/CSV (`xlsx` + `exceljs`), TXT, and Image rendering executes strictly inside the browser and dedicated Web Workers (`src/workers/documentIndex.worker.ts`).
3. **Macro & Script Neutralization**: `sanitizeDocumentHtml()` in `src/utils/documentRules.ts` strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<meta>`, inline `on*` event handlers, and `javascript:`/`vbscript:` URIs before any document content touches the DOM.
4. **External Resource & Tracking Beacon Blocking**: Any unsolicited external `http://` or `https://` image, stylesheet, or media URL embedded inside a document is rewritten to a local inert SVG placeholder so documents can never phone home or leak IP/open telemetry.
5. **Local Persistence & Eviction Recovery**: Documents and workspace metadata are stored locally in IndexedDB and the Origin Private File System (OPFS). Users can export and restore their complete workspace state as a portable JSON bundle at any time.
6. **30 MB Guest Local Processing Guardrail**: Guest users can use all workspace features without creating an account, subject to a transparent 30.0 MB per-file client-side worker memory limit.
