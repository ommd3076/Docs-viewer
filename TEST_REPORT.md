# Verification & Benchmark Test Report (`TEST_REPORT.md`)

## 1. Automated Unit & Binary Engine Tests (`node:test`)

Executed via `npx --yes tsx --test src/utils/documentRules.test.ts src/utils/documentEngines.test.ts`:

- **Multi-Page PDF Binary Fixture (`%PDF-1.4`)**: PASS — Generates valid 2-page PDF binary, verifies magic bytes, extracts structural headings, and renders HiDPI `<canvas>` pages.
- **DOCX Binary Fixture (`OOXML ZIP`)**: PASS — Generates valid `.docx` with `word/document.xml` headings and `<w:tbl>` tables, parses via `parseDocxAdapter` and renders via `docx-preview`.
- **PPTX Binary Fixture (`OOXML Slide Deck`)**: PASS — Generates valid 4-slide `.pptx` archive (`ppt/slides/slide1..4.xml`), parses slide layouts, bullets, and speaker notes.
- **XLSX & CSV Binary Fixtures (`SheetJS / ExcelJS`)**: PASS — Generates 2-sheet `.xlsx` workbook with `SUM`/`AVERAGE` formulas and merged cells (`A1:E1`), verifies formula evaluation and grid extraction.
- **Corrupted Binary Fixture Handling**: PASS — Detects invalid magic-byte headers (`Corrupted-Legacy-Macro-Stream.docx`) and transitions cleanly to the Sandbox Diagnostic view without uncaught exceptions.
- **30 MB Guest Per-File Limit & Pro Override**: PASS — Rejects 31 MB guest imports with a clear client-side memory explanation while allowing 29 MB guest files and 31 MB Local Pro files.
- **Macro & External Beacon Sanitizer**: PASS — Strips `<script>`, `onerror=`, `javascript:`, and external `https://` tracking pixels.

## 2. Browser Smoke & Network Isolation Audit

- **Desktop Viewport (`1440x900`) & Mobile Viewport (`390x844`)**: Verified responsive layout, zero console errors, and zero uncaught page errors.
- **Network Egress Verification**: Inspected browser network requests via Playwright across document import, viewing, X-Ray, and Compare flows — **0 document upload or external conversion requests** occurred.
