import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import { inspectSignalBlockMappings } from './signalBlockAdvisory';
const row = (tagName: string, signalType: Instrument['signalType'], pcs7BlockType: Instrument['pcs7BlockType']): Instrument => ({
  id: tagName, tagName, signalType, pcs7BlockType, description: '',
  equipmentType: 'Synthetic', engineeringUnits: '', abb800xaObject: '', confidence: 'low',
});
describe('independent advisory signal-to-block classification', () => {
  it('accepts ordinary analog, digital, motor, valve and controller pairings', () => {
    const valid = [
      row('FT-101','AI','MonAnL'), row('LSH-102','DI','MonDiL'),
      row('P-103','DO','MotL'), row('XV-104','DO','VlvL'),
      row('FCV-105','AO','VlvAnL'), row('FIC-101','AO','PIDConL'),
      row('LIC-201','AI','PIDConL'), row('PT-999','Unknown','Unknown'),
    ];
    expect(inspectSignalBlockMappings(valid)).toEqual([]);
  });
  it('flags suspicious pairings as warnings, never auto-fixes or certifies mappings', () => {
    const bad = [
      row('PT-101','DO','MonAnL'), row('P-102','AI','MotL'),
      row('XV-103','AO','VlvL'), row('LT-104','DI','MonAnL'),
    ];
    const original = structuredClone(bad);
    const alerts = inspectSignalBlockMappings(bad);
    expect(alerts).toHaveLength(4);
    expect(alerts.every(x => x.severity === 'warning' && x.message.includes('unverified'))).toBe(true);
    expect(bad).toEqual(original);
  });
  it('does not invent certainty from unknown classifications', () => {
    expect(inspectSignalBlockMappings([
      row('PT-101','Unknown','MonAnL'), row('PT-102','AI','Unknown'),
    ])).toEqual([]);
  });
});
