import type { Instrument, SentinelAlert } from '../types';
import { canonicalizeTag } from './tagParser';

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
 * alias collisions, self-links and directed cycles are never silently omitted.
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
  const byId = new Map(instruments.map(row => [row.id, row]));

  for (const source of instruments) {
    const text = source.connectedTo?.trim();
    if (!text) continue;
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
