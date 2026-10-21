/** Capture *actual* Chromium screens from bundled synthetic exercises.
 * No mock tag injection, no paid API, no plant data and no README text mutation.
 * Run through the dedicated, explicitly scoped screenshot workflow.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:4173/';
const output = 'docs/assets';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const apiCalls = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Explore sample project' }).click();
  await page.getByLabel('Signal target for FT-101').waitFor({ state: 'visible' });
  await page.locator('img[alt^="P&ID drawing:"]').waitFor({ state: 'visible' });
  if (await page.locator('table tbody tr').count() !== 5) {
    throw new Error('README screenshots require the actual five-row bundled synthetic exercise.');
  }
  await page.screenshot({ path: output + '/nexus-workspace-desktop.png', animations: 'disabled' });

  await page.getByRole('button', { name: 'HMI Topology' }).click();
  await page.getByText('Declared directed link').waitFor({ state: 'visible' });
  await page.screenshot({ path: output + '/nexus-hmi-topology.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'P&ID View' }).click();

  await page.getByRole('button', { name: 'Training Lab' }).click();
  const training = page.getByRole('region', { name: 'Offline cause and effect lab' });
  const level = training.getByRole('slider', { name: /LT-201/ });
  await level.focus();
  await level.press('End');
  await training.getByText('TRIP', { exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({ path: output + '/nexus-training-lab.png', animations: 'disabled' });

  await page.getByRole('button', { name: 'Scan Stress' }).click();
  await page.getByLabel('Stressed image SHA-256').waitFor({ state: 'visible' });
  await page.screenshot({ path: output + '/nexus-scan-stress.png', animations: 'disabled' });

  await page.getByRole('button', { name: 'Tag Management' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + '/nexus-workspace-mobile.png', animations: 'disabled' });
  if (apiCalls.length) throw new Error('A synthetic screenshot capture contacted a model API.');
  console.log('Captured genuine NEXUS Chromium desktop, HMI, training, scan-stress and mobile views; zero /api calls.');
} finally {
  await browser.close();
}
