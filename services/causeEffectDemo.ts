/**
 * Purely illustrative DCS cause/effect teaching model, NOT a process model,
 * interlock specification, verified logic solver, or actuator controller.
 * Only hand-authored synthetic fixtures are represented. No I/O or APIs.
 */
export type TrainingScenario = 'tank-level' | 'flow-control-loop';
export type TrainingCondition = 'normal' | 'advisory' | 'trip' | 'unknown';

export interface TrainingDefinition {
  id: TrainingScenario;
  title: string;
  observationTag: string;
  unit: string;
  minimum: number;
  maximum: number;
  initial: number;
  advisoryThreshold: number;
  tripThreshold: number;
  clearThreshold: number;
  direction: 'high' | 'low';
  illustrativeEffects: readonly string[];
}

export const TRAINING_DEFINITIONS: Record<TrainingScenario, TrainingDefinition> = {
  'tank-level': {
    id: 'tank-level',
    title: 'Synthetic buffer tank level',
    observationTag: 'LT-201',
    unit: '%',
    minimum: 0, maximum: 100, initial: 55,
    advisoryThreshold: 80, tripThreshold: 90, clearThreshold: 70,
    direction: 'high',
    illustrativeEffects: [
      'LSH-202: illustrative high-level alarm comparison only',
      'XV-203: hypothetical isolation request (never transmitted)',
      'P-204: hypothetical pump permissive review (never transmitted)',
    ],
  },
  'flow-control-loop': {
    id: 'flow-control-loop',
    title: 'Synthetic reactor feed flow',
    observationTag: 'FT-101',
    unit: 'm³/h',
    minimum: 0, maximum: 120, initial: 65,
    advisoryThreshold: 25, tripThreshold: 10, clearThreshold: 40,
    direction: 'low',
    illustrativeEffects: [
      'FIC-101: illustrative low-flow condition (no setpoint writes)',
      'FCV-101: hypothetical valve response review (never transmitted)',
      'PT-102 / TT-103: supporting indicators only, not protective votes',
    ],
  },
};

export interface TrainingEvent {
  step: number;
  action: 'sample' | 'trip' | 'fault' | 'acknowledge' | 'reset' | 'reset-denied';
  detail: string;
}

export interface TrainingState {
  scenario: TrainingScenario;
  value: number;
  healthy: boolean;
  tripLatched: boolean;
  acknowledged: boolean;
  step: number;
  events: TrainingEvent[];
}

export type TrainingAction =
  | { type: 'sample'; value: number; healthy: boolean }
  | { type: 'acknowledge' }
  | { type: 'reset' };

const qualifies = (value: number, threshold: number, direction: 'low' | 'high'): boolean =>
  direction === 'high' ? value >= threshold : value <= threshold;

const isClear = (value: number, d: TrainingDefinition): boolean =>
  d.direction === 'high' ? value <= d.clearThreshold : value >= d.clearThreshold;

export const createTrainingState = (scenario: TrainingScenario): TrainingState => {
  if (!Object.prototype.hasOwnProperty.call(TRAINING_DEFINITIONS, scenario)) {
    throw new Error('Unknown synthetic training scenario.');
  }
  return {
    scenario, value: TRAINING_DEFINITIONS[scenario].initial,
    healthy: true, tripLatched: false, acknowledged: false,
    step: 0, events: [],
  };
};

export const trainingCondition = (state: TrainingState): TrainingCondition => {
  const d = TRAINING_DEFINITIONS[state.scenario];
  if (!d) throw new Error('Unknown synthetic training scenario.');
  // A faulty observation is unknown, never silently "healthy" or normal.
  if (!state.healthy) return 'unknown';
  if (qualifies(state.value, d.tripThreshold, d.direction)) return 'trip';
  if (qualifies(state.value, d.advisoryThreshold, d.direction)) return 'advisory';
  return 'normal';
};

export const canResetTrainingTrip = (state: TrainingState): boolean => {
  const d = TRAINING_DEFINITIONS[state.scenario];
  return state.tripLatched && state.healthy && isClear(state.value, d);
};

/**
 * Stepwise immutable reducer. Sensor fault takes precedence over displayed
 * measurements. A trip latch persists until healthy, clear-range, explicit
 * reset; acknowledging an alarm cannot clear the trip.
 */
export const advanceTraining = (state: TrainingState, action: TrainingAction): TrainingState => {
  const d = TRAINING_DEFINITIONS[state.scenario];
  if (!d) throw new Error('Unknown synthetic training scenario.');
  const step = state.step + 1;
  if (!Number.isSafeInteger(step) || step > 100_000) throw new Error('Simulation step cap reached.');
  let next: TrainingState = { ...state, step, events: [...state.events] };
  let event: Omit<TrainingEvent, 'step'>;

  if (action.type === 'sample') {
    if (!Number.isFinite(action.value) || action.value < d.minimum || action.value > d.maximum ||
        typeof action.healthy !== 'boolean') {
      throw new Error('Invalid synthetic observation or sensor-health input.');
    }
    next.value = action.value;
    next.healthy = action.healthy;
    const condition = trainingCondition(next);
    if (condition === 'unknown') {
      event = { action: 'fault', detail: d.observationTag + ' sensor fault; reading is not trusted.' };
    } else if (condition === 'trip' && !state.tripLatched) {
      next.tripLatched = true;
      next.acknowledged = false;
      event = { action: 'trip', detail: d.observationTag + ' entered synthetic trip region.' };
    } else {
      event = { action: 'sample', detail: d.observationTag + ' = ' + action.value + ' ' + d.unit +
        '; condition ' + condition + '.' };
    }
  } else if (action.type === 'acknowledge') {
    if (next.tripLatched || trainingCondition(next) !== 'normal') {
      next.acknowledged = true;
      event = { action: 'acknowledge', detail: 'Local acknowledgement recorded. Trip latch unchanged.' };
    } else {
      event = { action: 'acknowledge', detail: 'No active alarm; acknowledgement had no effect.' };
    }
  } else if (action.type === 'reset') {
    if (canResetTrainingTrip(next)) {
      next.tripLatched = false;
      next.acknowledged = false;
      event = { action: 'reset', detail: 'Synthetic latch reset in clear range; no plant action.' };
    } else {
      event = { action: 'reset-denied', detail: 'Reset refused: healthy sensor, clear range and active latch are required.' };
    }
  } else {
    throw new Error('Unsupported training action.');
  }

  next.events.push({ step, ...event });
  if (next.events.length > 20) next.events = next.events.slice(-20);
  return next;
};
