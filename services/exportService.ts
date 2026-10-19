import { Instrument } from "../types";
import { estimatedUnitCost, summarizeEstimatedBom } from "./bomCost";

// Characters XML 1.0 does not allow at all (C0 controls other than tab, LF, CR).
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export const escapeXml = (value: string): string =>
  value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * A value beginning with a spreadsheet formula operator can execute when a
 * generated CSV is opened in Excel/LibreOffice. Neutralize it *before* RFC
 * quoting; quoted CSV cells alone are not sufficient protection.
 *
 * This changes suspicious source values by prefixing an apostrophe, so these
 * conceptual exports must still be checked before any vendor-specific import.
 */
const SPREADSHEET_FORMULA = /^[\s\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]*[=+\-@]/u;

export const escapeCsvField = (value: string): string => {
  const safe = SPREADSHEET_FORMULA.test(value) ? "'" + value : value;
  return /[;\t"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const buildSiemensCsv = (instruments: Instrument[]): string => {
  // Conceptual Siemens-style CSV only; not verified against vendor IEA import schemas.
  const header = ['Tag Name', 'Description', 'Block Type', 'Signal Type', 'Engineering Units'];
  const rows = instruments.map(i =>
    [i.tagName, i.description, i.pcs7BlockType, i.signalType, i.engineeringUnits].map(escapeCsvField)
  );
  return [header, ...rows].map(r => r.join(';')).join('\r\n') + '\r\n';
};

export const buildAbbXml = (instruments: Instrument[]): string => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ABB_800xA_Import version="1.0">\n`;
  instruments.forEach(i => {
    xml += `  <Object Name="${escapeXml(i.tagName)}" Type="${escapeXml(i.abb800xaObject)}">\n`;
    xml += `    <Property Name="Description">${escapeXml(i.description)}</Property>\n`;
    xml += `    <Property Name="SignalType">${escapeXml(i.signalType)}</Property>\n`;
    xml += `    <Property Name="EngUnits">${escapeXml(i.engineeringUnits)}</Property>\n`;
    xml += `    <Property Name="PCS7BlockMapping">${escapeXml(i.pcs7BlockType)}</Property>\n`;
    xml += `  </Object>\n`;
  });
  xml += `</ABB_800xA_Import>`;
  return xml;
};

export const downloadSiemensCSV = (instruments: Instrument[], filename: string) => {
  // UTF-8 BOM so Excel opens units such as "°C" and non-ASCII descriptions correctly
  const blob = new Blob(['﻿' + buildSiemensCsv(instruments)], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}_Siemens_PCS7.csv`);
};

export const downloadABBXML = (instruments: Instrument[], filename: string) => {
  const blob = new Blob([buildAbbXml(instruments)], { type: 'text/xml;charset=utf-8;' });
  downloadFile(blob, `${filename}_ABB_800xA.xml`);
};


/** Conceptual estimated BOM; all text reuses the existing formula-safe CSV encoding. */
export const buildBomCsv = (instruments: Instrument[]): string => {
  const { total } = summarizeEstimatedBom(instruments);
  const rows = instruments.map(i => {
    const cost = estimatedUnitCost(i.estimatedCost);
    return [i.tagName, i.description, i.brand ?? '', i.model ?? '', cost?.toString() ?? ''];
  });
  return [
    ['Tag Name', 'Description', 'Brand', 'Model', 'Estimated Cost (USD)'],
    ...rows,
    ['Total', '', '', '', total.toString()],
  ].map(row => row.map(escapeCsvField).join(';')).join('\r\n') + '\r\n';
};

export const downloadBomCSV = (instruments: Instrument[], filename: string) =>
  downloadText('\uFEFF' + buildBomCsv(instruments), filename + '_BOM.csv', 'text/csv');

export const downloadText = (content: string, filename: string, mimeType: string) => {
  downloadFile(new Blob([content], { type: mimeType + ';charset=utf-8;' }), filename);
};

const downloadFile = (blob: Blob, filename: string) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
