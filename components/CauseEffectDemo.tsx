import React, { useState } from 'react';
import {
  advanceTraining, canResetTrainingTrip, createTrainingState, trainingCondition,
  TRAINING_DEFINITIONS, type TrainingScenario,
} from '../services/causeEffectDemo';

/**
 * Research/portfolio teaching aid only. Never reads current project tags,
 * sends requests, modifies engineering records or issues any DCS/PLC action.
 */
const CauseEffectDemo: React.FC = () => {
  const [state, setState] = useState(() => createTrainingState('tank-level'));
  const d = TRAINING_DEFINITIONS[state.scenario];
  const condition = trainingCondition(state);
  const observed = state.healthy ? state.value + ' ' + d.unit : 'UNKNOWN — sensor fault';

  const selectScenario = (next: TrainingScenario) => setState(createTrainingState(next));
  const recordValue = (value: number) => setState(previous =>
    advanceTraining(previous, { type: 'sample', value, healthy: previous.healthy }));
  const setHealthy = (healthy: boolean) => setState(previous =>
    advanceTraining(previous, { type: 'sample', value: previous.value, healthy }));
  const apply = (type: 'acknowledge' | 'reset') =>
    setState(previous => advanceTraining(previous, { type }));

  const conditionColor = condition === 'trip' ? 'text-rose-300 border-rose-500/40' :
    condition === 'unknown' ? 'text-amber-200 border-amber-500/40' :
      condition === 'advisory' ? 'text-amber-300 border-amber-500/30' :
        'text-cyan-200 border-cyan-400/30';

  return (
    <section aria-label="Offline cause and effect lab"
      className="h-full space-y-5 overflow-y-auto rounded-xl border border-cyan-400/15 bg-slate-950/60 p-4 text-slate-200 custom-scrollbar sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-lg text-white">Offline cause/effect lab</h3>
          <span className="rounded-full border border-cyan-400/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
            Synthetic · no OT commands
          </span>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
          Illustrative discrete alarm and latch logic with invented teaching thresholds.
          Not derived from the current P&amp;ID, not a process dynamic model, and not
          IEC 61511 / SIL / vendor logic. No actuator command, network request or model call.
        </p>
      </header>

      <div role="group" aria-label="Synthetic training scenario" className="flex flex-wrap gap-2">
        {(Object.keys(TRAINING_DEFINITIONS) as TrainingScenario[]).map(id =>
          <button key={id} type="button" aria-pressed={state.scenario === id}
            onClick={() => selectScenario(id)}
            className={'rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-cyan-300 ' +
              (state.scenario === id ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-100' :
                'border-slate-700 text-slate-400 hover:border-slate-500')}>
            {id === 'tank-level' ? 'Tank level' : 'Reactor feed flow'}
          </button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <label htmlFor="training-observation" className="mb-2 block text-xs font-bold text-slate-300">
            {d.observationTag} · {d.title}
          </label>
          <input id="training-observation" type="range" min={d.minimum} max={d.maximum} step={5}
            value={state.value} onChange={event => recordValue(Number(event.target.value))}
            aria-valuetext={observed} className="w-full accent-cyan-400"/>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">{d.minimum} {d.unit}</span>
            <output htmlFor="training-observation" className="font-mono font-bold text-white">{observed}</output>
            <span className="text-slate-500">{d.maximum} {d.unit}</span>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-200">
            <input type="checkbox" checked={!state.healthy}
              onChange={event => setHealthy(!event.target.checked)}
              className="accent-amber-400"/>
            Inject synthetic sensor fault
          </label>
        </div>
        <div role="status" aria-live="polite"
          className={'rounded-lg border bg-slate-900/70 p-4 ' + conditionColor}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Synthetic observation</p>
          <p className="mt-2 text-lg font-bold uppercase">{condition}</p>
          <p className="mt-2 text-xs">Trip latch: <strong>{state.tripLatched ? 'ACTIVE' : 'clear'}</strong></p>
          <p className="mt-1 text-xs">Acknowledgement: <strong>{state.acknowledged ? 'recorded' : 'not recorded'}</strong></p>
          <p className="mt-2 text-[11px] text-slate-400">
            {state.healthy ? 'Local numeric input only' : 'Sensor fault: displayed value is untrusted.'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-white">Teaching thresholds</h4>
        <p className="text-xs leading-relaxed text-slate-300">
          {d.direction === 'high' ? 'High' : 'Low'} advisory at {d.advisoryThreshold} {d.unit};
          illustrative trip at {d.tripThreshold} {d.unit};
          reset permitted only with a healthy sensor and a latched trip in the clear range
          ({d.direction === 'high' ? 'at or below' : 'at or above'} {d.clearThreshold} {d.unit}).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => apply('acknowledge')}
            className="rounded-md border border-indigo-400/40 px-3 py-2 text-xs text-indigo-100 hover:bg-indigo-400/10">
            Acknowledge local alarm
          </button>
          <button type="button" onClick={() => apply('reset')}
            title={canResetTrainingTrip(state) ? 'A synthetic reset is permitted.' : 'Reset will be refused outside the clear-range guard.'}
            className="rounded-md border border-amber-400/40 px-3 py-2 text-xs text-amber-100 hover:bg-amber-400/10">
            Attempt simulated reset
          </button>
          <button type="button" onClick={() => selectScenario(state.scenario)}
            className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
            Restart exercise
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-white">
          Hypothetical effects · never executed
        </h4>
        <ul className="mt-2 list-inside list-disc space-y-2 text-xs leading-relaxed text-slate-300">
          {d.illustrativeEffects.map(label => <li key={label}>{label}</li>)}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-white">
          Local event trace ({state.events.length} shown)
        </h4>
        <ol aria-label="Synthetic event history" className="max-h-48 space-y-1 overflow-auto text-xs text-slate-300">
          {[...state.events].reverse().map(event =>
            <li key={event.step} className="rounded border border-slate-800 bg-slate-900/60 p-2">
              <span className="mr-2 font-mono text-cyan-300">#{event.step}</span>
              <strong className="mr-2 uppercase">{event.action}</strong>{event.detail}
            </li>)}
          {state.events.length === 0 && <li className="text-slate-500">Change the observation or inject a fault to start.</li>}
        </ol>
      </div>
    </section>
  );
};

export default CauseEffectDemo;
