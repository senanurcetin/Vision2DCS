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

  // Test both the local developer mode and the static public demo build.
  const publicMode = process.env.VITE_VISION2DCS_PUBLIC_DEMO === 'true';
  if (publicMode) {
    if (await page.getByRole('button', { name: 'Process Diagram' }).count()) {
      throw new Error('A public static demo must not expose a nonfunctional paid AI action.');
    }
    if (await page.getByRole('button', { name: 'Unlock AI' }).count()) {
      throw new Error('A public static demo must not ask visitors for an operator secret.');
    }
    await page.getByText('Offline demo · no AI calls').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Explore sample project' }).click();
  } else {
    // Local operators can unlock AI without persisting their token in the browser.
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
    await page.getByRole('button', { name: 'Load sample P&ID' }).click();
  }
  const sampleRows = page.locator('table tbody tr');
  await sampleRows.first().locator('input').first().waitFor({ state: 'visible' });
  if (await sampleRows.count() !== 5) throw new Error('Offline sample must contain five synthetic instrument rows.');
  if (await sampleRows.first().locator('input').first().inputValue() !== 'FT-101') {
    throw new Error('Offline sample did not expose the labelled flow transmitter.');
  }
  if (await page.getByRole('button', { name: 'NEXUS TAG MAP' }).isEnabled()) {
    throw new Error('Synthetic example must still require engineer review.');
  }
  // The selected synthetic project must remain open after a full reload.
  await page.waitForFunction(() => localStorage.getItem('dcs_selected_project_id')?.startsWith('demo-'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sampleRows.first().locator('input').first().waitFor({ state: 'visible' });
  if (await sampleRows.first().locator('input').first().inputValue() !== 'FT-101') {
    throw new Error('Selected synthetic project disappeared after refresh.');
  }
  await page.getByText('Synthetic sample · five draft tags', { exact: false }).waitFor();
  // Check that the example stays editable and its HMI topology is accessible.
  await page.getByRole('button', { name: 'HMI Topology' }).click();
  await page.getByRole('button', { name: 'P&ID View' }).click();

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

  // Capture actual downloaded bytes so browser Blob URLs and CSV/XML formatting
  // are tested end-to-end, rather than only verifying the buttons' disabled state.
  const tagPromise = page.waitForEvent('download');
  await tagMap.click();
  const tagDownload = await tagPromise;
  if (tagDownload.suggestedFilename() !== 'nexus-tag-map-v1.json') {
    throw new Error('NEXUS contract download has the wrong filename.');
  }
  const mapText = await readFile(await tagDownload.path(), 'utf8');
  const map = JSON.parse(mapText);
  if (Buffer.byteLength(mapText) > 1024 * 1024 ||
      map.schema !== 'nexus.industrial.tag-map.v1' ||
      map.mode !== 'read-only' || map.tags.length !== 1 ||
      map.tags[0].tag !== 'PT-101' || map.tags[0].signalType !== 'AI' ||
      map.source.product !== 'Vision2DCS' ||
      mapText.includes('data:image/') || mapText.includes('GEMINI_API_KEY')) {
    throw new Error('Downloaded tag-map is not a bounded read-only engineering contract.');
  }

  const siemensPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SIEMENS PCS7' }).click();
  const siemensDownload = await siemensPromise;
  const siemens = await readFile(await siemensDownload.path(), 'utf8');
  if (!siemensDownload.suggestedFilename().endsWith('_Siemens_PCS7.csv') ||
      !siemens.includes('Tag Name;Description;Block Type;Signal Type;Engineering Units') ||
      !siemens.includes('PT-101') || !siemens.includes('MonAnL')) {
    throw new Error('Siemens concept CSV has invalid headers or tag mappings.');
  }

  const abbPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ABB 800xA' }).click();
  const abbDownload = await abbPromise;
  const abb = await readFile(await abbDownload.path(), 'utf8');
  if (!abbDownload.suggestedFilename().endsWith('_ABB_800xA.xml') ||
      !abb.includes('<ABB_800xA_Import') ||
      !abb.includes('Name="PT-101"') ||
      !abb.includes('<Property Name="SignalType">AI</Property>')) {
    throw new Error('ABB concept XML does not contain the checked tag data.');
  }

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

  // Browser project history is persisted, but undo stacks stay in memory
  // and no previous human-review flag may be revived by a refresh.
  await page.waitForFunction(() => localStorage.getItem('dcs_selected_project_id')?.startsWith('proj-'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await tagInput.waitFor({ state: 'visible' });
  if (await tagInput.inputValue() !== 'PT-102') {
    throw new Error('Last-selected edited project was not restored after reload.');
  }
  if (await tagMap.isEnabled() || await undo.isEnabled() || await redo.isEnabled()) {
    throw new Error('Refresh restored stale review claims or in-memory editing history.');
  }

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.locator('header').waitFor({ state: 'visible' });
    await page.screenshot({ path: output + '/nexus-' + width + '.png', animations: 'disabled' });
  }
  if (apiRequests.length) throw new Error('Offline browser smoke unexpectedly called paid AI API routes.');
  console.log('Chromium smoke PASS: project continuity, actual NEXUS JSON / Siemens CSV / ABB XML downloads, review gate, edit/undo/redo, invalid import and 375/768/1440 viewports.');
} finally {
  await browser.close();
}
