import type { Instrument, SentinelAlert } from '../types';
import { canonicalizeTag, isValidIsaTag } from './tagParser';

export interface ValidatedSignalEdge {
  sourceId: string;
  targetId: string;
  sourceTag: string;
  targetTag: string;
}

export interface SignalTopologyResult {
  /** Only independently resolved, explicitly declared directed links. */
  edges: ValidatedSignalEdge[];
  /** Errors block concept exports; warnings are advisory only. */
  issues: SentinelAlert[];
}

/**
 * Resolve *declared* single-target links without inventing any from loop order.
 * Labels remain user/model input until independently reviewed. Invalid targets,
 * alias collisions, duplicate row identities, self-links and directed cycles
 * are surfaced. Ambiguous source/target pairs never become displayed edges.
 *
 * At most 2000 instruments are supported by the persisted-project schema.
 * The cycle walk is iterative and linear to avoid stack exhaustion.
 */
export const analyzeSignalTopology = (instruments: ReadonlyArray<Instrument>): SignalTopologyResult => {
  const byCanonicalTag = new Map<string, Instrument | null>();
  for (const row of instruments) {
    const key = canonicalizeTag(row.tagName);
    if (!key) continue;
    byCanonicalTag.set(key, byCanonicalTag.has(key) ? null : row);
  }
  const edges: ValidatedSignalEdge[] = [];
  const issues: SentinelAlert[] = [];
  const targetBySource = new Map<string, string>();

  // A malformed in-memory list can contain duplicate row IDs even though the
  // browser persistence layer refuses to save them. Do not turn ambiguous
  // IDs into supposedly independently validated HMI wiring evidence.
  const uniqueIds = new Set<string>();
  const duplicatedIds = new Set<string>();
  for (const row of instruments) {
    if (uniqueIds.has(row.id)) duplicatedIds.add(row.id);
    uniqueIds.add(row.id);
  }
  const reportedIds = new Set<string>();
  for (const row of instruments) {
    if (!duplicatedIds.has(row.id) || reportedIds.has(row.id)) continue;
    reportedIds.add(row.id);
    issues.push({
      tag: row.tagName, severity: 'error',
      message: 'Multiple instrument rows share one internal ID. Resolve duplicate identities before interpreting signal links.',
    });
  }
  const byId = new Map(instruments.map(row => [row.id, row]));

  for (const source of instruments) {
    const text = source.connectedTo?.trim();
    if (!text) continue;

    // A resolvable TARGET is not enough. If the source's displayed tag is
    // duplicated, invalid, or backed by a repeated row ID, an HMI line would
    // falsely imply the source was unambiguously identified.
    if (duplicatedIds.has(source.id)) continue; // already reported above
    const sourceKey = canonicalizeTag(source.tagName);
    if (!sourceKey || !isValidIsaTag(source.tagName) || byCanonicalTag.get(sourceKey) !== source) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'Ambiguous or invalid directed signal source. Assign a unique, valid source tag before drawing this link.',
      });
      continue;
    }

    const canonical = text.length <= 64 ? canonicalizeTag(text) : null;
    if (!canonical) {
      issues.push({
        tag: source.tagName,
        severity: 'error',
        message: 'Invalid directed signal target "' + text.slice(0, 64) + '". Select a valid instrument tag.',
      });
      continue;
    }
    const target = byCanonicalTag.get(canonical);
    if (target === undefined) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'Directed signal target ' + canonical + ' does not exist in this project.',
      });
      continue;
    }
    if (target === null) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'Directed signal target ' + canonical + ' is ambiguous because multiple tags have that identity.',
      });
      continue;
    }
    if (!isValidIsaTag(target.tagName)) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'Directed signal target ' + canonical + ' does not meet the demo ISA tag convention.',
      });
      continue;
    }
    if (duplicatedIds.has(target.id)) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'Directed signal target ' + canonical + ' has a duplicate internal row ID and cannot be resolved reliably.',
      });
      continue;
    }
    if (source.id === target.id) {
      issues.push({
        tag: source.tagName, severity: 'error',
        message: 'A directed signal cannot connect an instrument to itself.',
      });
      continue;
    }
    targetBySource.set(source.id, target.id);
    edges.push({
      sourceId: source.id,
      targetId: target.id,
      sourceTag: source.tagName,
      targetTag: target.tagName,
    });
  }

  // Each row has at most one declared outgoing link, so walking each path
  // with a global visited set finds all directed cycles in O(rows + edges).
  const visited = new Set<string>();
  for (const start of targetBySource.keys()) {
    if (visited.has(start)) continue;
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let node: string | undefined = start;
    while (node !== undefined && !visited.has(node) && !pathIndex.has(node)) {
      pathIndex.set(node, path.length);
      path.push(node);
      node = targetBySource.get(node);
    }
    if (node !== undefined && pathIndex.has(node)) {
      const cycle = path.slice(pathIndex.get(node)!);
      const tags = cycle.map(id => byId.get(id)?.tagName ?? id);
      issues.push({
        tag: tags[0], severity: 'error',
        message: 'Directed signal cycle: ' + [...tags, tags[0]].join(' → ') +
          '. Confirm control-flow direction before concept export.',
      });
    }
    path.forEach(id => visited.add(id));
  }
  return { edges, issues };
};
