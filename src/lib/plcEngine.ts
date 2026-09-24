import type { PLCState } from '@/types/plc';
import { DEFAULT_STATE } from '@/types/plc';
import { executeMainProgram } from '@/lib/tiaMainProgram';

/**
 * Executes one PLC scan cycle.
 * Delegates the scan to the MAIN / OB1 program model.
 */
export function scanCycle(prev: PLCState): PLCState {
  return executeMainProgram(prev);
}

/** Merges a remote state (from TIA Portal / Supabase) into the local state.
 *  Remote overrides inputs, auto, start, stop, run — the scan logic re-derives outputs. */
export function mergeRemoteState(local: PLCState, remote: Partial<PLCState>): PLCState {
  return {
    ...local,
    ...remote,
    source: 'tia-portal',
    updatedAt: new Date().toISOString(),
  };
}

export { DEFAULT_STATE };
