import type { AnalysisProject } from '../types';
import { canonicalizeTag } from './tagParser';
import { conceptExportBlockers } from './conceptExportGate';

export const NEXUS_TAG_MAP_SCHEMA = 'nexus.industrial.tag-map.v1';

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
  if (!project.id.trim() || !project.name.trim()) {
    throw new Error('Tag-map export needs a named project.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt) ||
      Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('Use a valid UTC ISO timestamp for the export.');
  }
  const blockers = conceptExportBlockers(project.instruments);
  if (blockers.length) throw new Error('Tag-map export blocked: ' + blockers[0]);

  const tags = project.instruments.map(item => ({
    tag: canonicalizeTag(item.tagName)!,
    description: item.description,
    signalType: item.signalType as NexusTagMapV1['tags'][number]['signalType'],
    pcs7BlockType: item.pcs7BlockType as NexusTagMapV1['tags'][number]['pcs7BlockType'],
    engineeringUnits: item.engineeringUnits,
  }));
  tags.sort((a, b) => a.tag.localeCompare(b.tag, 'en'));
  return {
    schema: NEXUS_TAG_MAP_SCHEMA,
    version: 1,
    mode: 'read-only',
    evidence: 'local-human-reviewed-concept',
    generatedAt,
    source: { product: 'Vision2DCS', projectId: project.id, projectTitle: project.name },
    tags,
  };
}
