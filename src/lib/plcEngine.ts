import type { PLCState } from '@/types/plc';
import { DEFAULT_STATE } from '@/types/plc';

/**
 * Executes one PLC scan cycle.
 * Models a simple S7-1200 program:
 *   Network 1: Start (I0.0) seals latch, Stop (I0.1 NF) breaks it -> Q0.0
 *   Network 2: Auto mode (I0.2) -> Q0.3
 *   Q0.0 = RUN & latch (motor running)
 *   Q0.1 = RUN & AUTO & !latch (standby in auto)
 *   Q0.2 = RUN & !latch (stopped indicator)
 *   Q0.3 = RUN & auto (auto mode indicator)
 */
export function scanCycle(prev: PLCState): PLCState {
  if (!prev.run) {
    return {
      ...prev,
      latch: false,
      outputs: [false, false, false, false, false, false, false, false],
      memoryBits: {
        M0_0: false,
        M0_1: prev.autoMode,
        M0_2: prev.stopHeld,
        M10_0: false,
      },
      source: 'simulator',
      updatedAt: new Date().toISOString(),
    };
  }

  const i01closed = !prev.stopHeld;
  const prevLatch = prev.latch;
  const latch = (prev.startPressed || prev.latch) && i01closed;
  const cycles = latch && !prevLatch ? prev.cycles + 1 : prev.cycles;

  const q00 = latch;
  const q01 = prev.autoMode && !latch;
  const q02 = !latch;
  const q03 = prev.autoMode;

  // Input bits (MSB first, bit 7..0):
  // bit7=start, bit6=!stop, bit5=auto, rest false
  const inputs = [
    false, false, false, false, false,
    prev.autoMode, !prev.stopHeld, prev.startPressed,
  ];

  // Output bits (MSB first, bit 7..0):
  // bit7=Q0.0, bit6=Q0.1, bit5=Q0.2, bit4=Q0.3
  const outputs = [
    false, false, false, false,
    q03, q02, q01, q00,
  ];

  return {
    ...prev,
    latch,
    cycles,
    inputs,
    outputs,
    memoryBits: {
      M0_0: q00,
      M0_1: prev.autoMode,
      M0_2: prev.stopHeld,
      M10_0: q00,
    },
    mw100: cycles,
    source: 'simulator',
    updatedAt: new Date().toISOString(),
  };
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
