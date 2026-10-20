import { describe, expect, it } from 'vitest';
import {
  advanceTraining, canResetTrainingTrip, createTrainingState,
  trainingCondition, TRAINING_DEFINITIONS,
} from './causeEffectDemo';

describe('offline educational cause/effect training', () => {
  it('does not call out to any provider, plant or control-system interface', () => {
    expect(TRAINING_DEFINITIONS['tank-level'].observationTag).toBe('LT-201');
    expect(TRAINING_DEFINITIONS['flow-control-loop'].observationTag).toBe('FT-101');
    for (const scenario of Object.keys(TRAINING_DEFINITIONS) as Array<keyof typeof TRAINING_DEFINITIONS>) {
      const start = createTrainingState(scenario);
      expect(start.step).toBe(0);
      expect(start.events).toEqual([]);
      expect(start.tripLatched).toBe(false);
      expect(trainingCondition(start)).toBe('normal');
    }
  });

  it('models tank advisory, trip, acknowledgement, continued latch, safe reset', () => {
    const initial = createTrainingState('tank-level');
    const advisory = advanceTraining(initial, { type: 'sample', value: 80, healthy: true });
    expect(trainingCondition(advisory)).toBe('advisory');
    expect(advisory.tripLatched).toBe(false);

    const trip = advanceTraining(advisory, { type: 'sample', value: 90, healthy: true });
    expect(trainingCondition(trip)).toBe('trip');
    expect(trip.tripLatched).toBe(true);
    expect(trip.acknowledged).toBe(false);

    const ack = advanceTraining(trip, { type: 'acknowledge' });
    expect(ack.acknowledged).toBe(true);
    expect(ack.tripLatched).toBe(true);

    const belowTrip = advanceTraining(ack, { type: 'sample', value: 75, healthy: true });
    expect(trainingCondition(belowTrip)).toBe('normal');
    expect(canResetTrainingTrip(belowTrip)).toBe(false);
    const denied = advanceTraining(belowTrip, { type: 'reset' });
    expect(denied.tripLatched).toBe(true);
    expect(denied.events.at(-1)?.action).toBe('reset-denied');

    const clear = advanceTraining(denied, { type: 'sample', value: 70, healthy: true });
    expect(canResetTrainingTrip(clear)).toBe(true);
    const reset = advanceTraining(clear, { type: 'reset' });
    expect(reset.tripLatched).toBe(false);
    expect(reset.acknowledged).toBe(false);
    expect(reset.events.at(-1)?.action).toBe('reset');
    expect(initial).toEqual(createTrainingState('tank-level'));
  });

  it('models inverse low-flow thresholds, hard trip and reset hysteresis', () => {
    const initial = createTrainingState('flow-control-loop');
    const warning = advanceTraining(initial, { type: 'sample', value: 25, healthy: true });
    expect(trainingCondition(warning)).toBe('advisory');
    const trip = advanceTraining(warning, { type: 'sample', value: 10, healthy: true });
    expect(trainingCondition(trip)).toBe('trip');
    expect(trip.tripLatched).toBe(true);
    const recovery = advanceTraining(trip, { type: 'sample', value: 39, healthy: true });
    expect(canResetTrainingTrip(recovery)).toBe(false);
    expect(canResetTrainingTrip(advanceTraining(recovery, { type: 'sample', value: 40, healthy: true })))
      .toBe(true);
  });

  it('keeps sensor faults unknown, preserves any latch and prevents reset', () => {
    const before = advanceTraining(createTrainingState('tank-level'), { type: 'sample', value: 93, healthy: true });
    const failed = advanceTraining(before, { type: 'sample', value: 20, healthy: false });
    expect(trainingCondition(failed)).toBe('unknown');
    expect(failed.tripLatched).toBe(true);
    expect(canResetTrainingTrip(failed)).toBe(false);
    expect(advanceTraining(failed, { type: 'reset' }).tripLatched).toBe(true);
    expect(advanceTraining(failed, { type: 'acknowledge' }).tripLatched).toBe(true);
    expect(failed.events.at(-1)?.action).toBe('fault');
  });

  it('rejects malformed inputs before changing simulation state', () => {
    const state = createTrainingState('tank-level');
    for (const value of [NaN, Infinity, -1, 101]) {
      expect(() => advanceTraining(state, { type: 'sample', value, healthy: true }))
        .toThrow(/Invalid synthetic observation/);
    }
    expect(() => advanceTraining(state, { type: 'sample', value: 20, healthy: 1 as never }))
      .toThrow(/Invalid synthetic observation/);
    expect(() => createTrainingState('unknown' as never)).toThrow(/Unknown synthetic/);
    expect(state).toEqual(createTrainingState('tank-level'));
  });

  it('bounds event history and step count deterministically', () => {
    let state = createTrainingState('flow-control-loop');
    for (let i = 0; i < 100; i++) state = advanceTraining(state, { type: 'sample', value: 50, healthy: true });
    expect(state.step).toBe(100);
    expect(state.events).toHaveLength(20);
    expect(state.events[0].step).toBe(81);
    expect(state.events[19].step).toBe(100);
    expect(() => advanceTraining({ ...state, step: 100_000 }, { type: 'reset' }))
      .toThrow(/step cap/);
  });
});
