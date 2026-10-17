import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = 'docs/assets';
await mkdir(output, { recursive: true });
const drawing = await readFile('samples/flow-control-loop/drawing.png');
const imageUrl = 'data:image/png;base64,' + drawing.toString('base64');
const tags = [
  { id: 'demo-ft', tagName: 'FT-101', equipmentType: 'Flow Transmitter', signalType: 'AI', description: 'Synthetic flow loop', engineeringUnits: 'm3/h', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object', confidence: 'high', reviewed: false },
  { id: 'demo-fcv', tagName: 'FCV-102', equipmentType: 'Flow Control Valve', signalType: 'AO', description: 'Synthetic valve output', engineeringUnits: '%', pcs7BlockType: 'VlvAnL', abb800xaObject: 'AO_Object', confidence: 'medium', reviewed: false },
  { id: 'demo-pt', tagName: 'PT-103', equipmentType: 'Pressure Transmitter', signalType: 'AI', description: 'Synthetic pressure monitoring', engineeringUnits: 'bar', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object', confidence: 'medium', reviewed: false },
];
const projectBackup = JSON.stringify({
  format: 'vision2dcs-project',
  version: 1,
  project: { id: 'readme-synthetic', name: 'Synthetic Flow Loop', date: 'Offline demonstration', imageUrl, instruments: tags }
});
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[accept="application/json,.json"]').setInputFiles({
    name: 'synthetic-loop.vision2dcs.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup)
  });
  await page.getByText('FT-101').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('img[alt^="P&ID drawing:"]').waitFor({ state: 'visible' });
  await page.screenshot({ path: output + '/nexus-workspace-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + '/nexus-workspace-mobile.png', animations: 'disabled' });
  await page.close();
} finally { await browser.close(); }

let readme = await readFile('README.md', 'utf8');
const old = '![Vision2DCS interface](https://github.com/user-attachments/assets/2259d7d5-cac7-409c-b453-ede8c39f6398)';
const replacement = [
  '![NEXUS Vision2DCS engineering workspace (Chromium, synthetic offline fixture)](docs/assets/nexus-workspace-desktop.png)',
  '',
  '<sub>Captured from this repository in Chromium, 1440 × 960. The pictured P&ID and tag list are **synthetic offline demonstration fixtures**; no Gemini call or vendor import approval is implied.</sub>',
  '',
  '<details><summary>Mobile preview · 390 × 844</summary>',
  '',
  '<img src="docs/assets/nexus-workspace-mobile.png" alt="NEXUS Vision2DCS mobile engineering interface with synthetic flow-loop project" width="390">',
  '',
  '</details>',
].join('\n');
if (readme.includes(old)) readme = readme.replace(old, replacement);
else if (!readme.includes('docs/assets/nexus-workspace-desktop.png')) throw new Error('README screenshot anchor changed: refusing ungrounded update');
await writeFile('README.md', readme);
console.log('Captured genuine Chromium workspace: 1440 × 960 and 390 × 844; README updated.');