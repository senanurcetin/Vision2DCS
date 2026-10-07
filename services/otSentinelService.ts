import { Instrument, SentinelAlert } from '../types';
import { ISA_NAMING_PATTERN, getLoopKey, isValveTag } from './tagParser';

const SAFETY_KEYWORDS = ['safety', 'emergency', 'relief', 'blowdown', 'sdv', 'esdv', 'interlock'];

/**
 * OTSentinelService: Automated engineering logic auditor.
 * Validates extraction results against industrial engineering standards.
 */
export const runSentinelAudit = (instruments: Instrument[]): SentinelAlert[] => {
  const alerts: SentinelAlert[] = [];
  const loopMap = new Map<string, Instrument[]>();

  instruments.forEach(inst => {
    // 1. Syntactic: ISA-5.1 tag naming
    if (!ISA_NAMING_PATTERN.test(inst.tagName)) {
      alerts.push({
        tag: inst.tagName,
        severity: 'error',
        message: 'Non-standard ISA-5.1 naming convention detected. Automation systems may fail to parse this tag.'
      });
    }

    // 2. Classification: values the model could not map need engineer review
    if (inst.signalType === 'Unknown' || inst.pcs7BlockType === 'Unknown') {
      alerts.push({
        tag: inst.tagName,
        severity: 'warning',
        message: 'Signal or block type could not be classified from the drawing. Assign it manually before export.'
      });
    }

    // 3. Functional: analog signals need engineering units for scaling
    if ((inst.signalType === 'AI' || inst.signalType === 'AO') && !inst.engineeringUnits.trim()) {
      alerts.push({
        tag: inst.tagName,
        severity: 'warning',
        message: 'Analog signal has no engineering units. Range and unit are required for DCS scaling.'
      });
    }

    // 4. Functional: safety-related descriptors
    const desc = inst.description.toLowerCase();
    if (SAFETY_KEYWORDS.some(key => desc.includes(key))) {
      alerts.push({
        tag: inst.tagName,
        severity: 'warning',
        message: 'Critical safety function identified. Ensure IEC 61511 compliance and verify SIL rating.'
      });
    }

    const loopKey = getLoopKey(inst.tagName);
    if (loopKey) {
      if (!loopMap.has(loopKey)) loopMap.set(loopKey, []);
      loopMap.get(loopKey)?.push(inst);
    }
  });

  // 5. Topology: a flow measurement without a final control element in the same loop
  loopMap.forEach((items, loopId) => {
    // Loop keys start with the measured-variable letter, so "F-..." is a flow loop
    const hasFlowTransmitter = loopId.startsWith('F-') && items.some(i => i.signalType === 'AI');
    const hasControlValve = items.some(i => i.signalType === 'AO' || isValveTag(i.tagName));

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
