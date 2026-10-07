import { Instrument } from "../types";

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

/** RFC 4180 quoting with a semicolon delimiter: quote fields containing ; " CR or LF. */
export const escapeCsvField = (value: string): string =>
  /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const buildSiemensCsv = (instruments: Instrument[]): string => {
  // Standard Siemens Import Format (Semicolon separated as requested)
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
