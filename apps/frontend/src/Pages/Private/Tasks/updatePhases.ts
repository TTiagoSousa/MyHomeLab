import type { BoardState } from '../../../Hooks/Board/boardTypes';

export interface Process_Phase {
  key: string;
  name: string | null;
  hintKey: string | null;
  states: BoardState[];
}

const KNOWN_PHASES: [string, string[]][] = [
  ['intake', ['new', 'study']],
  ['study', ['studying', 'studied']],
  ['decision', ['ready', 'waiting', 'later']],
  ['install', ['in_progress', 'verifying']],
  ['end', ['done', 'failed', 'cancelled']],
];

const knownPhase = (states: BoardState[]) =>
  KNOWN_PHASES.find(([, keys]) => states.every((state) => state.key !== null && keys.includes(state.key)))?.[0] ?? null;

export const statePhases = (states: BoardState[]): Process_Phase[] | undefined => {
  if (!states.some((state) => state.phase)) return undefined;
  const phases: Process_Phase[] = [];
  for (const state of states) {
    const last = phases[phases.length - 1];
    if (last && last.name === (state.phase ?? null)) last.states.push(state);
    else phases.push({ key: `${phases.length}-${state.id}`, name: state.phase ?? null, hintKey: null, states: [state] });
  }
  return phases.map((phase) => ({ ...phase, hintKey: knownPhase(phase.states) }));
};
