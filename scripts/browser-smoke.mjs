import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

const baseUrl = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:4173/';
const output = 'artifacts/browser-smoke';
await mkdir(output, { recursive: true });

const drawing = await readFile('samples/flow-control-loop/drawing.png');
const project = {
  format: 'vision2dcs-project',
  version: 1,
  project: {
    id: 'smoke-synthetic',
    name: 'Offline Chromium QA',
    date: 'Synthetic fixture',
    imageUrl: 'data:image/png;base64,' + drawing.toString('base64'),
    instruments: [{
      id: 'tag-1', tagName: 'PT-101', equipmentType: 'Transmitter',
      signalType: 'AI', description: 'Synthetic pressure measurement',
      engineeringUnits: 'barg', pcs7BlockType: 'MonAnL',
      abb800xaObject: 'AI_Object', confidence: 'high', reviewed: false,
    }],
  },
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  const apiRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  // Operator bearer is needed only for explicitly authorized paid inference.
  // The local/offline engineering workflow still works when the token is absent.
  const processButton = page.getByRole('button', { name: 'Process Diagram' });
  if (await processButton.isEnabled()) throw new Error('Unconfigured AI must be locked.');
  const sessionToken = 'offline-browser-smoke-token-32-characters-minimum';
  await page.getByLabel('Operator-issued AI access token').fill(sessionToken);
  await page.getByRole('button', { name: 'Unlock AI' }).click();
  if (!(await processButton.isEnabled())) throw new Error('Operator token entry did not enable the AI button.');
  if (await page.evaluate(token => Object.values(localStorage).some(value => value.includes(token)), sessionToken)) {
    throw new Error('An operator token leaked into browser localStorage.');
  }
  await page.getByRole('button', { name: 'Clear AI token' }).click();
  if (await processButton.isEnabled()) throw new Error('Clearing access must lock AI again.');

  // First-time visitors can explore a real bundled synthetic P&ID without AI.
  await page.getByRole('button', { name: 'Load sample P&ID' }).click();
  const sampleRows = page.locator('table tbody tr');
  await sampleRows.first().locator('input').first().waitFor({ state: 'visible' });
  if (await sampleRows.count() !== 5) throw new Error('Offline sample must contain five synthetic instrument rows.');
  if (await sampleRows.first().locator('input').first().inputValue() !== 'FT-101') {
    throw new Error('Offline sample did not expose the labelled flow transmitter.');
  }
  if (await page.getByRole('button', { name: 'NEXUS TAG MAP' }).isEnabled()) {
    throw new Error('Synthetic example must still require engineer review.');
  }

  const backupInput = page.locator('input[accept="application/json,.json"]');
  await backupInput.setInputFiles({
    name: 'offline-project.vision2dcs.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });

  const tagInput = page.locator('table tbody tr').first().locator('input').first();
  await tagInput.waitFor({ state: 'visible' });
  if (await tagInput.inputValue() !== 'PT-101') throw new Error('Synthetic tag was not loaded.');

  const tagMap = page.getByRole('button', { name: 'NEXUS TAG MAP' });
  const undo = page.getByRole('button', { name: 'Undo instrument edit' });
  const redo = page.getByRole('button', { name: 'Redo instrument edit' });
  if (await tagMap.isEnabled()) throw new Error('Unreviewed concept export must be blocked.');
  if (await undo.isEnabled() || await redo.isEnabled()) throw new Error('Undo history must start empty.');

  await page.getByRole('button', { name: 'Mark PT-101 reviewed' }).click();
  if (!(await tagMap.isEnabled())) throw new Error('Explicit review should unlock the concept export.');

  await tagInput.fill('PT-102');
  if (!(await undo.isEnabled())) throw new Error('Tag edit should enable undo.');
  if (await tagMap.isEnabled()) throw new Error('Tag edit should revoke prior review.');

  await undo.click();
  if (await tagInput.inputValue() !== 'PT-101') throw new Error('Undo did not restore the original tag.');
  if (await tagMap.isEnabled()) throw new Error('Undo must not resurrect engineering review.');
  if (!(await redo.isEnabled())) throw new Error('Undo should enable redo.');

  await redo.click();
  if (await tagInput.inputValue() !== 'PT-102') throw new Error('Redo did not restore the edited tag.');
  if (await tagMap.isEnabled()) throw new Error('Redo must not restore engineering approval.');

  // An invalid backup must not overwrite the existing project.
  await backupInput.setInputFiles({
    name: 'invalid.vision2dcs.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...project, version: 99 })),
  });
  await page.getByRole('alert').waitFor({ state: 'visible' });
  if (await tagInput.inputValue() !== 'PT-102') throw new Error('Invalid import changed existing project.');

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.locator('header').waitFor({ state: 'visible' });
    await page.screenshot({ path: output + '/nexus-' + width + '.png', animations: 'disabled' });
  }
  if (apiRequests.length) throw new Error('Offline browser smoke unexpectedly called paid AI API routes.');
  console.log('Chromium smoke PASS: bundled offline sample, import, review gate, edit/undo/redo, invalid import and 375/768/1440 viewports.');
} finally {
  await browser.close();
}
