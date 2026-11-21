import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSyntheticPdfBinary,
  generateSyntheticDocxBinary,
  generateSyntheticPptxBinary,
  generateSyntheticXlsxBinary,
  generateSyntheticCsvBinary,
  generateCorruptedDocxBinary,
} from './syntheticFixtures';
import { parseLocalDocumentBuffer } from './documentEngines';

test('PDF binary fixture generates valid multi-page %PDF-1.4 and parses via PDF adapter', async () => {
  const buffer = generateSyntheticPdfBinary();
  assert.ok(buffer.byteLength > 200);
  const doc = await parseLocalDocumentBuffer({
    id: 'test-pdf',
    name: 'Zero-Trust-Architecture.pdf',
    buffer,
  });
  assert.equal(doc.status, 'ready');
  assert.equal(doc.format, 'pdf');
  assert.equal(doc.pageCount, 2);
  assert.ok(doc.sections.length >= 2);
  assert.match(doc.extractedText, /VaultDocs Zero-Trust Local Architecture/);
});

test('DOCX binary fixture generates real OOXML ZIP with tables and headings and parses cleanly', async () => {
  const buffer = await generateSyntheticDocxBinary();
  const doc = await parseLocalDocumentBuffer({
    id: 'test-docx',
    name: 'Governance-Audit.docx',
    buffer,
  });
  assert.equal(doc.status, 'ready');
  assert.equal(doc.format, 'docx');
  assert.ok(doc.sections.some((s) => s.kind === 'table'));
  assert.match(doc.extractedText, /Enterprise Security/);
});

test('PPTX binary fixture generates 4-slide OOXML presentation and extracts slides & notes', async () => {
  const buffer = await generateSyntheticPptxBinary();
  const doc = await parseLocalDocumentBuffer({
    id: 'test-pptx',
    name: 'Board-Deck-Q4.pptx',
    buffer,
  });
  assert.equal(doc.status, 'ready');
  assert.equal(doc.format, 'pptx');
  assert.equal(doc.slides?.length, 4);
  assert.equal(doc.pageCount, 4);
});

test('XLSX and CSV binary fixtures parse multiple sheets, formulas, and merged cells', async () => {
  const xlsxBuffer = generateSyntheticXlsxBinary();
  const xlsxDoc = await parseLocalDocumentBuffer({
    id: 'test-xlsx',
    name: 'FY2026-Forecast.xlsx',
    buffer: xlsxBuffer,
  });
  assert.equal(xlsxDoc.status, 'ready');
  assert.equal(xlsxDoc.sheets?.length, 2);
  assert.ok((xlsxDoc.sheets?.[0]?.formulas.length ?? 0) >= 3);
  assert.ok((xlsxDoc.sheets?.[0]?.merges.length ?? 0) >= 1);

  const csvBuffer = generateSyntheticCsvBinary();
  const csvDoc = await parseLocalDocumentBuffer({
    id: 'test-csv',
    name: 'Security-Controls.csv',
    buffer: csvBuffer,
  });
  assert.equal(csvDoc.status, 'ready');
  assert.equal(csvDoc.format, 'csv');
  assert.ok((csvDoc.sheets?.[0]?.rows.length ?? 0) >= 5);
});

test('Corrupted DOCX binary is caught gracefully without crashing', async () => {
  const corruptedBuffer = generateCorruptedDocxBinary();
  const doc = await parseLocalDocumentBuffer({
    id: 'test-corrupt',
    name: 'Broken-Contract.docx',
    buffer: corruptedBuffer,
  });
  assert.equal(doc.status, 'corrupted');
  assert.match(doc.errorMessage ?? '', /Corrupted DOCX container/);
});
