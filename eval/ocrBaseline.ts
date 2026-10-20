import { ISA_NAMING_PATTERN } from '../services/tagParser';

/**
 * Extract *tag-shaped ASCII strings* from actual OCR text, never reference
 * labels or SVG source text. No signal/block/topology predictions are made.
 * This post-processing is intentionally rule-based and reproducible.
 */
export function parseOcrInstrumentTags(text: string): string[] {
  if (typeof text !== 'string' || text.length > 256 * 1024) {
    throw new Error('OCR text must be a string no larger than 256 KiB.');
  }
  const found = new Set<string>();
  const upper = text.toUpperCase();
  // Preserve boundaries: valve labels embedded in an arbitrary part number
  // are not independent instrument observations.
  const expression = /(?:^|[^A-Z0-9])([A-Z]{1,4})[\s-]?([0-9]{2,5})([A-Z]?)(?![A-Z0-9])/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(upper)) !== null) {
    const tag = match[1] + '-' + match[2] + match[3];
    if (!ISA_NAMING_PATTERN.test(tag)) continue;
    found.add(tag);
    if (found.size > 2000) throw new Error('Too many OCR tag candidates.');
  }
  return [...found].sort((a, b) => a.localeCompare(b, 'en'));
}

/** A narrow textual baseline cannot predict classifications or drawn links. */
export const OCR_BASELINE_METHOD = 'Tesseract OCR text + ISA-shaped tag regex; tags only' as const;
