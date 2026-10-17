import type { AnalysisProject } from '../types';
import { canonicalizeTag } from './tagParser';
import { conceptExportBlockers } from './conceptExportGate';

export const NEXUS_TAG_MAP_SCHEMA = 'nexus.industrial.tag-map.v1';

// Must match the independently validating Ops-Copilot v1 consumer contract.
// No automatic cross-app transfer is performed by this exporter.
const MAX_TAG_MAP_BYTES = 1024 * 1024;
const MAX_TAGS = 2000;
const PROJECT_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const UNSAFE_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;


export interface NexusTagMapV1 {
  schema: typeof NEXUS_TAG_MAP_SCHEMA;
  version: 1;
  mode: 'read-only';
  evidence: 'local-human-reviewed-concept';
  generatedAt: string;
  source: { product: 'Vision2DCS'; projectId: string; projectTitle: string };
  tags: Array<{
    tag: string;
    description: string;
    signalType: 'AI' | 'AO' | 'DI' | 'DO';
    pcs7BlockType: 'MonAnL' | 'MonDiL' | 'MotL' | 'VlvL' | 'VlvAnL' | 'PIDConL';
    engineeringUnits: string;
  }>;
}

/**
 * Portable, manually exported engineering concept. It includes neither a
 * drawing nor credentials, network connection details or vendor write commands.
 * The receiver must revalidate fields and treat the file as untrusted data.
 */
export function buildReviewedTagMap(project: AnalysisProject, generatedAt: string): NexusTagMapV1 {
  if (!PROJECT_ID.test(project.id) || !project.name.trim() ||
      project.name.length > 500 || UNSAFE_TEXT.test(project.name)) {
    throw new Error('Tag-map export needs a valid project ID and a safe title of at most 500 characters.');
  }
  if (project.instruments.length > MAX_TAGS) {
    throw new Error('NEXUS Tag Map v1 supports at most 2000 reviewed tags.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt) ||
      Number.isNaN(Date.parse(generatedAt)) ||
      new Date(generatedAt).toISOString() !== generatedAt) {
    throw new Error('Use a valid UTC ISO timestamp for the export.');
  }
  const blockers = conceptExportBlockers(project.instruments);
  if (blockers.length) throw new Error('Tag-map export blocked: ' + blockers[0]);

  for (const item of project.instruments) {
    if (item.description.length > 1000 || UNSAFE_TEXT.test(item.description) ||
        item.engineeringUnits.length > 100 || UNSAFE_TEXT.test(item.engineeringUnits)) {
      throw new Error('Tag-map export contains an unsupported description or engineering unit.');
    }
  }

  const tags = project.instruments.map(item => ({
    tag: canonicalizeTag(item.tagName)!,
    description: item.description,
    signalType: item.signalType as NexusTagMapV1['tags'][number]['signalType'],
    pcs7BlockType: item.pcs7BlockType as NexusTagMapV1['tags'][number]['pcs7BlockType'],
    engineeringUnits: item.engineeringUnits,
  }));
  tags.sort((a, b) => a.tag.localeCompare(b.tag, 'en'));
  const result: NexusTagMapV1 = {
    schema: NEXUS_TAG_MAP_SCHEMA,
    version: 1,
    mode: 'read-only',
    evidence: 'local-human-reviewed-concept',
    generatedAt,
    source: { product: 'Vision2DCS', projectId: project.id, projectTitle: project.name },
    tags,
  };
  // Enforce the consumer's exact UTF-8 byte limit before presenting a download.
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_TAG_MAP_BYTES) {
    throw new Error('NEXUS Tag Map v1 exceeds the 1 MiB receiver limit.');
  }
  return result;
}
