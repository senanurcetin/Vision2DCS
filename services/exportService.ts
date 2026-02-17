
import { Instrument } from "../types";

export const downloadSiemensCSV = (instruments: Instrument[], filename: string) => {
  // Standard Siemens Import Format (Semicolon separated as requested)
  const header = "Tag Name;Description;Block Type;Signal Type;Engineering Units\n";
  const rows = instruments.map(i => 
    `${i.tagName};${i.description};${i.pcs7BlockType};${i.signalType};${i.engineeringUnits}`
  ).join("\n");

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}_Siemens_PCS7.csv`);
};

export const downloadABBXML = (instruments: Instrument[], filename: string) => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ABB_800xA_Import version="1.0">\n`;
  instruments.forEach(i => {
    xml += `  <Object Name="${i.tagName}" Type="${i.abb800xaObject}">\n`;
    xml += `    <Property Name="Description">${i.description}</Property>\n`;
    xml += `    <Property Name="SignalType">${i.signalType}</Property>\n`;
    xml += `    <Property Name="EngUnits">${i.engineeringUnits}</Property>\n`;
    xml += `    <Property Name="PCS7BlockMapping">${i.pcs7BlockType}</Property>\n`;
    xml += `  </Object>\n`;
  });
  xml += `</ABB_800xA_Import>`;

  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
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
};
