import { canonicalizeTag, isValidIsaTag } from './tagParser';
import type { NexusTagMapV1 } from './nexusTagMap';
import { NEXUS_TAG_MAP_SCHEMA } from './nexusTagMap';

/**
 * An independent read-only parser for an exported NEXUS tag-map artifact.
 * It verifies data shape, not signer identity or engineering certification.
 * Do not wire parsed entries to control writes or live plant assets.
 */
export const MAX_NEXUS_TAG_MAP_BYTES = 1024 * 1024;
const MAX_TAGS = 2000;
const PROJECT_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const UNSAFE_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const ALLOWED_SIGNALS = new Set(['AI', 'AO', 'DI', 'DO']);
const ALLOWED_BLOCKS = new Set(['MonAnL', 'MonDiL', 'MotL', 'VlvL', 'VlvAnL', 'PIDConL']);

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (object: Record<string, unknown>, keys: string[]): boolean => {
  const names = Object.keys(object);
  return names.length === keys.length && keys.every(key => Object.hasOwn(object, key));
};
const safeText = (value: unknown, maxLength: number, requireText = false): value is string =>
  typeof value === 'string' && value.length <= maxLength &&
  (!requireText || value.trim().length > 0) && !UNSAFE_TEXT.test(value);
const utcTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

export const validateNexusTagMapV1 = (value: unknown): NexusTagMapV1 => {
  if (!record(value) || !exactKeys(value, ['schema', 'version', 'mode', 'evidence', 'generatedAt', 'source', 'tags']) ||
      value.schema !== NEXUS_TAG_MAP_SCHEMA || value.version !== 1 ||
      value.mode !== 'read-only' || value.evidence !== 'local-human-reviewed-concept' ||
      !utcTimestamp(value.generatedAt)) {
    throw new Error('Unsupported or malformed read-only NEXUS Tag Map v1 envelope.');
  }
  if (!record(value.source) || !exactKeys(value.source, ['product', 'projectId', 'projectTitle']) ||
      value.source.product !== 'Vision2DCS' ||
      typeof value.source.projectId !== 'string' || !PROJECT_ID.test(value.source.projectId) ||
      !safeText(value.source.projectTitle, 500, true)) {
    throw new Error('Invalid NEXUS Tag Map origin or source metadata.');
  }
  if (!Array.isArray(value.tags) || value.tags.length === 0 || value.tags.length > MAX_TAGS) {
    throw new Error('NEXUS Tag Map must contain between 1 and 2000 reviewed tags.');
  }

  const seen = new Set<string>();
  const fields = ['tag', 'description', 'signalType', 'pcs7BlockType', 'engineeringUnits'];
  for (const item of value.tags) {
    if (!record(item) || !exactKeys(item, fields) ||
        typeof item.tag !== 'string' || !isValidIsaTag(item.tag) ||
        canonicalizeTag(item.tag) !== item.tag ||
        !safeText(item.description, 1000) || !safeText(item.engineeringUnits, 100) ||
        !ALLOWED_SIGNALS.has(item.signalType as string) ||
        !ALLOWED_BLOCKS.has(item.pcs7BlockType as string)) {
      throw new Error('NEXUS Tag Map contains an invalid or unsupported reviewed tag row.');
    }
    if (seen.has(item.tag)) throw new Error('NEXUS Tag Map contains duplicate canonical instrument tags.');
    seen.add(item.tag);
  }

  // A parsed object supplied by a caller is also bounded before returning.
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_NEXUS_TAG_MAP_BYTES) {
    throw new Error('NEXUS Tag Map exceeds the 1 MiB limit.');
  }
  return value as unknown as NexusTagMapV1;
};

export const parseNexusTagMapV1 = (json: string): NexusTagMapV1 => {
  if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > MAX_NEXUS_TAG_MAP_BYTES) {
    throw new Error('NEXUS Tag Map exceeds the 1 MiB limit.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('NEXUS Tag Map is not valid JSON.');
  }
  return validateNexusTagMapV1(parsed);
};


/**
 * Serialize the exact manual download bytes, including pretty whitespace and
 * the final newline. A compact JSON that fits 1 MiB can exceed 1 MiB after
 * formatting; never offer a contract that the receiver will reject.
 */
export const serializeNexusTagMapV1 = (value: NexusTagMapV1): string => {
  validateNexusTagMapV1(value);
  const text = JSON.stringify(value, null, 2) + '\n';
  if (new TextEncoder().encode(text).byteLength > MAX_NEXUS_TAG_MAP_BYTES) {
    throw new Error('Formatted NEXUS Tag Map v1 exceeds the 1 MiB receiver limit.');
  }
  return text;
};
