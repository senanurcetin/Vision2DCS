/**
 * ISA-5.1 tag parsing shared by the audit engine and the topology view.
 *
 * A tag such as "FCV-101A" splits into function letters ("FCV"), loop number
 * ("101") and suffix ("A"). The loop is identified by the first (measured
 * variable) letter plus the number, so FT-101 and FCV-101 share loop "F-101"
 * while TT-101 belongs to a different loop "T-101".
 */
export interface ParsedTag {
  functionLetters: string;
  loopNumber: string;
  suffix: string;
}

const TAG_PATTERN = /^([A-Z]{1,5})[-\s]?([0-9]{1,6})([A-Z]*)$/;

// Strict naming convention enforced by the audit: e.g. PT-101, FCV-1001A.
export const ISA_NAMING_PATTERN = /^[A-Z]{1,4}-[0-9]{2,5}[A-Z]?$/;

export const parseTag = (tagName: string): ParsedTag | null => {
  const match = tagName.trim().toUpperCase().match(TAG_PATTERN);
  if (!match) return null;
  const [, functionLetters, loopNumber, suffix] = match;
  return { functionLetters, loopNumber, suffix };
};

/** Loop identity ("F-101"), or null when the tag cannot be parsed. */
export const getLoopKey = (tagName: string): string | null => {
  const parsed = parseTag(tagName);
  return parsed ? `${parsed.functionLetters[0]}-${parsed.loopNumber}` : null;
};

/** Final control element: function letters ending in V (FV, FCV, XV, PCV...). */
export const isValveTag = (tagName: string): boolean => {
  const parsed = parseTag(tagName);
  return !!parsed && parsed.functionLetters.length >= 2 && parsed.functionLetters.endsWith('V');
};
