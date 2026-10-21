/**
 * Offline Markdown link integrity check for all maintained project docs.
 * File existence and local headings only; never fetch external URLs, run
 * inference, upload private documents or claim external-link validity.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const areas = ['README.md', 'TECHNICAL_GUIDE.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs', '.github'];
const errors = [];
let checked = 0;

async function collect(entry) {
  const full = path.join(root, entry);
  const info = await stat(full);
  if (info.isDirectory()) {
    const entries = await readdir(full, { withFileTypes: true });
    const out = [];
    for (const item of entries) {
      if (item.name === 'node_modules') continue;
      out.push(...await collect(path.join(entry, item.name)));
    }
    return out;
  }
  return full.endsWith('.md') ? [full] : [];
}

const slug = text =>
  text.replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/&(?:amp|nbsp);/g, ' ')
    .trim().toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, '-');

const paths = (await Promise.all(areas.map(collect))).flat();
for (const filename of paths) {
  const source = await readFile(filename, 'utf8');
  const references = [];
  // Markdown links and embedded images. Enclosed optional angle brackets and
  // title parameters are supported for short standard forms.
  for (const match of source.matchAll(/!?\[[^\]\n]*\]\((<?[^)\s>]+>?)(?:\s+"[^"]*")?\)/g)) {
    references.push(match[1].replace(/^<|>$/g, ''));
  }
  for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    references.push(match[1]);
  }
  for (const raw of references) {
    if (/^(?:https?:|mailto:|data:|app:)/i.test(raw)) continue;
    const [rawTarget, fragment] = raw.split('#', 2);
    let target;
    try { target = decodeURIComponent(rawTarget); }
    catch { errors.push(filename + ': invalid encoded link ' + raw); continue; }
    if (target.startsWith('/')) {
      // Absolute site paths are intentional URLs into the hosted app.
      continue;
    }
    const resolved = path.resolve(path.dirname(filename), target || path.basename(filename));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      errors.push(filename + ': linked path outside repository ' + raw);
      continue;
    }
    let info;
    try { info = await stat(resolved); }
    catch { errors.push(filename + ': missing local target ' + raw); continue; }
    if (fragment && info.isFile() && resolved.endsWith('.md')) {
      const headings = await readFile(resolved, 'utf8');
      const links = new Set();
      const counts = new Map();
      for (const [, heading] of headings.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
        const base = slug(heading);
        const previous = counts.get(base) ?? 0;
        links.add(previous ? base + '-' + previous : base);
        counts.set(base, previous + 1);
      }
      if (!links.has(decodeURIComponent(fragment).toLowerCase())) {
        errors.push(filename + ': missing Markdown heading ' + raw);
      }
    }
    checked++;
  }
}
if (errors.length) {
  for (const message of errors) console.error(message);
  console.error('Documentation link check FAILED (' + errors.length + ' problems).');
  process.exitCode = 1;
} else {
  console.log('Documentation link check PASS: ' + paths.length + ' Markdown files, ' + checked + ' local references.');
}
