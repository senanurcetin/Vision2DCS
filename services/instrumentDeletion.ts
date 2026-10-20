import type { Instrument } from '../types';
import { canonicalizeTag } from './tagParser';

/**
 * A deletion is local and reversible by Undo only until the tab is reloaded.
 * Count incoming declarations before asking for explicit destructive consent.
 * Do not silently rewrite or remove another instrument's connectedTo value.
 */
export function instrumentDeletionWarning(
  rows: ReadonlyArray<Instrument>, id: string,
): string | null {
  const victim = rows.find(row => row.id === id);
  if (!victim) return null;
  const identity = canonicalizeTag(victim.tagName) ?? victim.tagName.trim().toUpperCase();
  const referencing = rows.filter(row => {
    if (row.id === id || !row.connectedTo?.trim()) return false;
    const key = canonicalizeTag(row.connectedTo) ?? row.connectedTo.trim().toUpperCase();
    return key === identity;
  });
  const count = referencing.length;
  return 'Delete instrument "' + victim.tagName + '" from this project?\n' +
    (count
      ? count + ' other declared signal connection(s) reference this tag. ' +
        'They will remain in the project but become unresolved until repaired.\n'
      : '') +
    'Undo is available in this tab only. Export a project backup before permanent deletion.';
}
