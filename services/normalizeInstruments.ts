import { Instrument, SignalType, PCS7BlockType } from "../types";

/** The model answered, but not with something usable. Safe to show to the user. */
export class ModelOutputError extends Error {}

const SIGNAL_TYPES: SignalType[] = ['AI', 'AO', 'DI', 'DO'];
const BLOCK_TYPES: PCS7BlockType[] = ['MonAnL', 'MonDiL', 'MotL', 'VlvL', 'VlvAnL', 'PIDConL'];
const CONFIDENCE_LEVELS: Instrument['confidence'][] = ['high', 'medium', 'low'];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.find(a => a === value);

/**
 * Maps one raw model item onto an Instrument. Values the model got wrong are
 * marked 'Unknown' with low confidence instead of being silently replaced by a
 * plausible default, so the audit and the engineer can see them.
 */
export const normalizeInstrument = (item: Record<string, unknown>, index: number, idPrefix: string): Instrument => {
  const signalType = pick(item.signalType, SIGNAL_TYPES);
  const pcs7BlockType = pick(item.pcs7BlockType, BLOCK_TYPES);
  const confidence = signalType && pcs7BlockType
    ? pick(item.confidence, CONFIDENCE_LEVELS) ?? 'low'
    : 'low';
  const cost = item.estimatedCost;

  return {
    id: `${idPrefix}-${index}`,
    tagName: (asString(item.tagName) ?? `TAG-${index + 100}`).toUpperCase(),
    equipmentType: asString(item.equipmentType) ?? 'Unknown',
    signalType: signalType ?? 'Unknown',
    description: asString(item.description) ?? 'DCS generated tag',
    engineeringUnits: asString(item.engineeringUnits) ?? '',
    pcs7BlockType: pcs7BlockType ?? 'Unknown',
    abb800xaObject: asString(item.abb800xaObject) ?? 'Signal_Object',
    confidence,
    brand: asString(item.brand),
    model: asString(item.model),
    estimatedCost: typeof cost === 'number' && Number.isFinite(cost) ? cost : undefined,
    connectedTo: asString(item.connectedTo),
    safetyWarning: asString(item.safetyWarning),
  };
};

/** Parses the model's JSON text into instruments, rejecting anything that is not an array. */
export const parseInstrumentResponse = (text: string | undefined, idPrefix: string): Instrument[] => {
  if (!text) throw new ModelOutputError("No data returned from AI");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ModelOutputError("AI returned malformed JSON");
  }
  if (!Array.isArray(raw)) throw new ModelOutputError("AI response is not a list of instruments");

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item, index) => normalizeInstrument(item, index, idPrefix));
};
