import { Instrument } from '../types';
import { canonicalizeTag, getLoopKey, isValveTag, parseTag } from './tagParser';

export type LoopRole = 'sensor' | 'controller' | 'actuator';

const ROLE_ORDER: Record<LoopRole, number> = { sensor: 0, controller: 1, actuator: 2 };

/** Position in a control loop: measurement, then control, then final element. */
export const getLoopRole = (inst: Instrument): LoopRole => {
  if (isValveTag(inst.tagName) || inst.signalType === 'AO' || inst.signalType === 'DO'
    || ['VlvL', 'VlvAnL', 'MotL'].includes(inst.pcs7BlockType)) {
    return 'actuator';
  }
  // ISA controller letters: C after the measured variable (FIC, PC, TIC...)
  const letters = parseTag(inst.tagName)?.functionLetters ?? '';
  if (inst.pcs7BlockType === 'PIDConL' || letters.slice(1).includes('C')) return 'controller';
  return 'sensor';
};

export interface LoopGroup {
  loopId: string;
  items: Instrument[];
}

/** Groups instruments by ISA loop, each loop ordered sensor -> controller -> actuator. */
export const groupLoops = (instruments: Instrument[]): LoopGroup[] => {
  const groups = new Map<string, Instrument[]>();
  instruments.forEach(inst => {
    const loopId = getLoopKey(inst.tagName) ?? 'Misc';
    if (!groups.has(loopId)) groups.set(loopId, []);
    groups.get(loopId)!.push(inst);
  });
  return [...groups].map(([loopId, items]) => ({
    loopId,
    // Array.prototype.sort is stable, so equal roles keep the model's order
    items: [...items].sort((a, b) => ROLE_ORDER[getLoopRole(a)] - ROLE_ORDER[getLoopRole(b)]),
  }));
};

export interface Connection {
  source: Instrument;
  target: Instrument;
}

/**
 * Signal lines: each loop chained in role order, plus the model's connectedTo
 * links (which may cross loops). Partial model links never drop the loop chain.
 */
export const buildConnections = (groups: LoopGroup[]): Connection[] => {
  const tagKey = (tagName: string) => canonicalizeTag(tagName) ?? tagName.trim().toUpperCase();
  // Duplicate canonical labels are ambiguous: never silently route a model
  // reference to whichever instrument happened to appear last.
  const byTag = new Map<string, Instrument | null>();
  groups.forEach(g => g.items.forEach(i => {
    const key = tagKey(i.tagName);
    if (byTag.has(key)) {
      byTag.set(key, null);
    } else {
      byTag.set(key, i);
    }
  }));

  const connections: Connection[] = [];
  const seen = new Set<string>();
  const add = (source: Instrument, target: Instrument) => {
    // One line per pair, whichever direction was seen first
    const key = [source.id, target.id].sort().join('|');
    if (source.id === target.id || seen.has(key)) return;
    seen.add(key);
    connections.push({ source, target });
  };

  groups.forEach(({ loopId, items }) => {
    // Misc holds unrelated, unparseable tags, so it gets no implied sequence
    if (loopId === 'Misc') return;
    for (let i = 1; i < items.length; i++) add(items[i - 1], items[i]);
  });
  groups.forEach(({ items }) => items.forEach(source => {
    const target = source.connectedTo ? byTag.get(tagKey(source.connectedTo)) : undefined;
    if (target) add(source, target);
  }));
  return connections;
};
