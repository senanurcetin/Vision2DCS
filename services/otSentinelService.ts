
import { Instrument, SentinelAlert } from '../types';

/**
 * OTSentinelService: Automated engineering logic auditor.
 * Validates extraction results against industrial engineering standards.
 */
export const runSentinelAudit = (instruments: Instrument[]): SentinelAlert[] => {
  const alerts: SentinelAlert[] = [];
  const loopMap = new Map<string, Instrument[]>();

  // ISA-5.1 Regex: Expects Alpha-Numeric-Alpha sequence (e.g., PT-101A)
  const namingRegex = /^[A-Z]{1,4}-[0-9]{2,5}[A-Z]?$/;

  instruments.forEach(inst => {
    // 1. Tag Naming Validation
    if (!namingRegex.test(inst.tagName)) {
      alerts.push({
        tag: inst.tagName,
        severity: 'error',
        message: 'Non-standard ISA-5.1 naming convention detected. Automation systems may fail to parse this tag.'
      });
    }

    // Loop Aggregation for functional checks
    const match = inst.tagName.match(/[0-9]+/);
    if (match) {
      const loopId = match[0];
      if (!loopMap.has(loopId)) loopMap.set(loopId, []);
      loopMap.get(loopId)?.push(inst);
    }

    // 2. Safety Descriptor Scan
    const safetyKeywords = ['safety', 'emergency', 'relief', 'blowdown', 'sdv', 'esdv', 'interlock'];
    const desc = inst.description.toLowerCase();
    if (safetyKeywords.some(key => desc.includes(key))) {
      alerts.push({
        tag: inst.tagName,
        severity: 'warning',
        message: 'Critical safety function identified. Ensure IEC 61511 compliance and verify SIL rating.'
      });
    }
  });

  // 3. Functional Loop Integrity Check
  // Detects if a measurement exists (AI) but no control element (AO) is present in a closed-loop context.
  loopMap.forEach((items, loopId) => {
    const hasFlowTransmitter = items.some(i => i.tagName.startsWith('F') && i.signalType === 'AI');
    const hasControlValve = items.some(i => i.signalType === 'AO' || i.tagName.includes('V'));

    if (hasFlowTransmitter && !hasControlValve) {
      alerts.push({
        tag: `Loop ${loopId}`,
        severity: 'info',
        message: `Incomplete Flow Control Loop: Transmitter found in loop ${loopId} but no control valve (AO) detected.`
      });
    }
  });

  return alerts;
};
