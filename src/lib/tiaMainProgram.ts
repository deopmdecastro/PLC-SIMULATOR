import type { PLCState } from '@/types/plc';

export interface MainProgramSignals {
  startD: boolean;
  startE: boolean;
  stopNf: boolean;
  frNf: boolean;
  g0: number;
  nextG0: number;
  startRightTransition: boolean;
  startLeftTransition: boolean;
  stopRightTransition: boolean;
  stopLeftTransition: boolean;
  ready: boolean;
  q00Km1: boolean;
  q01Km2: boolean;
}

const BIT_COUNT = 8;

function emptyByte() {
  return Array<boolean>(BIT_COUNT).fill(false);
}

/**
 * MAIN / OB1 scan program.
 *
 * TIA-style network summary:
 *   Network 1: G0 == 1 & STOP_NF & FR_NF & START_D & NOT START_E -> MOVE 5 to G0.
 *   Network 2: G0 == 1 & STOP_NF & FR_NF & START_E & NOT START_D -> MOVE 10 to G0.
 *   Network 3: G0 == 5 & (NOT FR_NF OR NOT STOP_NF) -> MOVE 1 to G0.
 *   Network 4: G0 == 10 & (NOT FR_NF OR NOT STOP_NF) -> MOVE 1 to G0.
 *   Network 5: G0 == 5 -> KM1.
 *   Network 6: G0 == 10 -> KM2.
 */
export function executeMainProgram(prev: PLCState): PLCState {
  const signals = evaluateMainProgram(prev);

  const inputs = emptyByte();
  inputs[7] = signals.startD;
  inputs[6] = signals.startE;
  inputs[5] = signals.stopNf;
  inputs[4] = signals.frNf;

  const outputs = emptyByte();
  outputs[7] = signals.q00Km1;
  outputs[6] = signals.q01Km2;

  return {
    ...prev,
    inputs,
    outputs,
    latch: signals.q00Km1,
    relayK1: signals.q00Km1,
    relayK2: signals.q01Km2,
    cycles: signals.nextG0,
    memoryBits: {
      M0_0: signals.q00Km1,
      M0_1: signals.q01Km2,
      M0_2: signals.ready,
      M10_0: signals.startRightTransition || signals.startLeftTransition || signals.stopRightTransition || signals.stopLeftTransition,
    },
    mw100: signals.nextG0,
    source: 'simulator',
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateMainProgram(prev: PLCState): MainProgramSignals {
  const startD = prev.startPressed;
  const startE = prev.startEPressed;
  const stopNf = prev.stopNfClosed;
  const frNf = prev.frNfClosed;
  const g0 = Number(prev.mw100) || 1;
  const ready = g0 === 1;

  const startRightTransition = prev.run && ready && stopNf && frNf && startD && !startE;
  const startLeftTransition = prev.run && ready && stopNf && frNf && startE && !startD;
  const stopRightTransition = g0 === 5 && (!frNf || !stopNf);
  const stopLeftTransition = g0 === 10 && (!frNf || !stopNf);

  let nextG0 = g0;
  if (startRightTransition) nextG0 = 5;
  else if (startLeftTransition) nextG0 = 10;
  else if (stopRightTransition || stopLeftTransition) nextG0 = 1;

  const q00Km1 = nextG0 === 5;
  const q01Km2 = nextG0 === 10;

  return {
    startD,
    startE,
    stopNf,
    frNf,
    g0,
    nextG0,
    startRightTransition,
    startLeftTransition,
    stopRightTransition,
    stopLeftTransition,
    ready,
    q00Km1,
    q01Km2,
  };
}
