import type { Instrument } from '../types';
import { runSentinelAudit } from './otSentinelService';

/**
 * Prevent known-invalid tag identities/classifications from being exported
 * as plausible vendor-style engineering layouts.
 *
 * A clear gate is NOT certification: passing does not verify topology, SIL,
 * vendor IEA/XML schema compatibility, or model-generated estimates.
 */
export function conceptExportBlockers(instruments: Instrument[]): string[] {
  if (!instruments.length) return ['Add at least one reviewed instrument before exporting.'];
  const blockers = runSentinelAudit(instruments)
    .filter(alert => alert.severity === 'error')
    .map(alert => alert.tag + ': ' + alert.message);

  for (const instrument of instruments) {
    if (instrument.reviewed !== true) {
      blockers.push(instrument.tagName + ': Explicit human review is required before concept export.');
    }
    if (instrument.signalType === 'Unknown' || instrument.pcs7BlockType === 'Unknown') {
      blockers.push(instrument.tagName + ': Assign a known signal and PCS 7 block type before concept export.');
    }
  }
  return blockers;
}
