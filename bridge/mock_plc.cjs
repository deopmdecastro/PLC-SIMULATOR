#!/usr/bin/env node
/**
 * Mock PLC — réplica em Node do programa OB1 demo executado pelo provider
 * `mock` do frontend (src/plc/providers/mockProvider.ts).
 *
 * Usado por:
 *   - bridge/plc_gateway.cjs        (provider `mock` do gateway local)
 *   - bridge/test_mock.cjs          (teste automático da sequência)
 *
 * Programa: sequência de 7 etapas com motor D/E, cilindro, válvula, tapete,
 * sensores, temporizadores IEC (T1/T2/T3), contadores (C1/C2) e dois DBs.
 */

'use strict';

const MOCK_TIMER_PRESETS = { T1: 3000, T2: 5000, T3: 2000 };
const MOCK_COUNTER_PRESETS = { C1: 100, C2: 1000 };

const STEP_LABELS = {
  0: 'INITIALIZATION',
  1: 'WAIT START',
  2: 'CYLINDER EXTENSION',
  3: 'WAIT SENSOR',
  4: 'MOTOR ON',
  5: 'CYLINDER RETRACTION',
  6: 'END CYCLE',
};

function normalizeAddress(address) {
  return String(address || '').trim().toUpperCase().replace(/\s+/g, '');
}

const SEED = {
  'I0.0': false,
  'I0.1': true,
  'I0.2': false,
  'I0.3': false,
  'I0.4': true,
  'I0.5': false,
  'I0.6': false,
  'I0.7': false,
  IW64: 0,
  IW66: 0,
  'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false,
  'Q0.4': false, 'Q0.5': false, 'Q0.6': false, 'Q0.7': false,
  QW80: 0,
  'M0.0': false, 'M0.1': false, 'M0.2': false, 'M0.3': false, 'M10.0': false,
  MW100: 0, MW102: 0, MD50: 0,
  'DB1.DBX0.0': false, 'DB1.DBW2': 1200, 'DB1.DBD4': 0, 'DB1.DBW6': 800, 'DB1.DBX8.0': false,
  'DB2.DBW0': 0, 'DB2.DBW2': 0, 'DB2.DBD4': 0,
  T1: false, 'T1.ET': 0, 'T1.PT': MOCK_TIMER_PRESETS.T1,
  T2: false, 'T2.ET': 0, 'T2.PT': MOCK_TIMER_PRESETS.T2,
  T3: false, 'T3.ET': 0, 'T3.PT': MOCK_TIMER_PRESETS.T3,
  C1: false, 'C1.PV': 0, 'C1.PRESET': MOCK_COUNTER_PRESETS.C1,
  C2: false, 'C2.PV': 0, 'C2.PRESET': MOCK_COUNTER_PRESETS.C2,
};

class MockPLC {
  constructor() {
    this.reset();
  }

  reset() {
    this.values = new Map(Object.entries(SEED));
    this.run = true;
    this.cycleTimeMs = 2.1;
    this.lastScan = Date.now();
    this.stepElapsed = 0;
    this.initElapsed = 0;
    this.motorElapsed = 0;
    this.retractElapsed = 0;
    this.cylinderPos = 0;
    this.conveyorOffset = 0;
    this.lastStep = -1;
    this.prevPartSignal = false;
  }

  getB(address) {
    return Boolean(this.values.get(normalizeAddress(address)));
  }

  getN(address) {
    const value = Number(this.values.get(normalizeAddress(address)));
    return Number.isFinite(value) ? value : 0;
  }

  getStep() {
    return Math.round(this.getN('MW100'));
  }

  set(address, value, changed) {
    const key = normalizeAddress(address);
    if (this.values.get(key) !== value) {
      this.values.set(key, value);
      if (changed) changed.push(key);
    }
  }

  timer(id, running, dtMs, changed) {
    const preset = MOCK_TIMER_PRESETS[id];
    let et = this.getN(`${id}.ET`);
    et = running ? Math.min(preset, et + dtMs) : 0;
    this.set(`${id}.ET`, Math.round(et), changed);
    this.set(`${id}.PT`, preset, changed);
    this.set(id, running && et >= preset, changed);
    return { et, done: running && et >= preset, preset };
  }

  scan() {
    const now = Date.now();
    const dtMs = Math.max(0, Math.min(500, now - this.lastScan));
    this.lastScan = now;
    const changed = [];

    if (!this.run) {
      for (const address of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7']) {
        this.set(address, false, changed);
      }
      this.set('M0.2', false, changed);
      return { changed, step: this.getStep() };
    }

    const start = this.getB('I0.0');
    const stopNf = this.getB('I0.1');
    const sensor1 = this.getB('I0.2');
    const sensor2 = this.getB('I0.3');
    const eStopNf = this.getB('I0.4');
    const autoSel = this.getB('I0.5');
    const reset = this.getB('I0.6');
    const analogIn = Math.max(0, Math.min(27648, Math.round(this.getN('IW64'))));

    let fault = this.getB('M0.1');
    if (!stopNf || !eStopNf) fault = true;
    if (reset && stopNf && eStopNf) fault = false;
    this.set('M0.1', fault, changed);
    const safe = !fault;
    this.set('M0.0', autoSel, changed);

    const motor1 = this.getB('Q0.0');
    const valve = this.getB('Q0.2');
    const cylinderTarget = valve && safe ? 100 : 0;
    const travel = dtMs / 12;
    if (this.cylinderPos < cylinderTarget) this.cylinderPos = Math.min(cylinderTarget, this.cylinderPos + travel);
    else if (this.cylinderPos > cylinderTarget) this.cylinderPos = Math.max(cylinderTarget, this.cylinderPos - travel);
    this.cylinderPos = Math.round(this.cylinderPos * 10) / 10;
    const extended = this.cylinderPos >= 99.5;
    this.set('DB1.DBD4', this.cylinderPos, changed);
    this.set('DB1.DBX8.0', extended, changed);
    this.set('M0.3', extended, changed);

    if (motor1 && safe) this.conveyorOffset = (this.conveyorOffset + dtMs / 20) % 360;
    this.set('MD50', Math.round(this.conveyorOffset * 100) / 100, changed);
    this.set('DB1.DBW2', Math.round(600 + (analogIn / 27648) * 2400), changed);
    this.set('QW80', safe && motor1 ? Math.round((analogIn / 27648) * 27648) : 0, changed);

    let step = this.getStep();
    this.stepElapsed += dtMs;
    const goTo = (next) => {
      step = next;
      this.stepElapsed = 0;
    };

    switch (step) {
      case 0:
        this.initElapsed += dtMs;
        if (this.initElapsed >= 1000) { this.initElapsed = 0; goTo(1); }
        break;
      case 1:
        if (safe && (start || autoSel)) goTo(2);
        break;
      case 2:
        if (!safe) { goTo(1); break; }
        if (extended) goTo(3);
        break;
      case 3:
        if (!safe) { goTo(1); break; }
        if (sensor1 || sensor2) goTo(4);
        break;
      case 4:
        this.motorElapsed += dtMs;
        if (!safe) { goTo(1); break; }
        if (this.motorElapsed >= MOCK_TIMER_PRESETS.T1) goTo(5);
        break;
      case 5:
        this.retractElapsed += dtMs;
        if (this.cylinderPos <= 0.5 || this.retractElapsed >= 1500) { this.retractElapsed = 0; goTo(6); }
        break;
      case 6:
        if (this.stepElapsed >= 400) { this.motorElapsed = 0; goTo(1); }
        break;
      default:
        goTo(1);
        break;
    }

    if (step !== this.getStep()) this.set('MW100', step, changed);
    this.set('MW102', step, changed);

    const inStep = (n) => step === n && safe;
    this.set('Q0.0', inStep(4), changed);
    this.set('Q0.1', inStep(4) && sensor2, changed);
    // Válvula de avanço: abre para estender (etapa 2) e MANTÉM-se aberta durante
    // a espera pelo sensor (etapa 3) e a marcha do motor (etapa 4), para o
    // cilindro ficar retido. Na etapa 5 fecha-se e o cilindro recolhe por mola.
    this.set('Q0.2', (step === 2 || step === 3 || step === 4) && safe, changed);
    this.set('Q0.3', step === 1 || step === 6, changed);
    this.set('Q0.4', fault, changed);
    this.set('Q0.5', inStep(4), changed);
    this.set('Q0.6', !safe, changed);
    this.set('Q0.7', inStep(2) || inStep(3) || inStep(5), changed);

    if (step === 5 && this.cylinderPos > 0.5) this.set('Q0.1', false, changed);

    this.set('M0.2', step >= 2 && step <= 5 && safe, changed);
    this.set('M10.0', Math.abs(this.cylinderPos - cylinderTarget) < 0.5 && step >= 2 && step <= 5, changed);

    const t1 = this.timer('T1', step === 4 && safe, dtMs, changed);
    this.timer('T2', step === 4 && safe, dtMs, changed);
    this.timer('T3', fault, dtMs, changed);
    if (t1.done && step === 4) goTo(5);

    // Contadores: C1 conta peças no FLANCO de subida, C2 conta ciclos concluídos.
    if (reset) {
      this.set('C1.PV', 0, changed);
      this.set('C2.PV', 0, changed);
      this.prevPartSignal = false;
    }
    const partSignal = sensor2 && this.getB('Q0.5');
    if (partSignal && !this.prevPartSignal) {
      this.set('C1.PV', Math.round(this.getN('C1.PV')) + 1, changed);
    }
    this.prevPartSignal = partSignal;
    if (step === 6 && this.lastStep !== 6) {
      this.set('C2.PV', Math.round(this.getN('C2.PV')) + 1, changed);
    }
    this.lastStep = step;
    this.set('C1', this.getN('C1.PV') >= MOCK_COUNTER_PRESETS.C1, changed);
    this.set('C1.PRESET', MOCK_COUNTER_PRESETS.C1, changed);
    this.set('C2', this.getN('C2.PV') >= MOCK_COUNTER_PRESETS.C2, changed);
    this.set('C2.PRESET', MOCK_COUNTER_PRESETS.C2, changed);

    this.set('DB2.DBW0', Math.round(this.getN('C1.PV')), changed);
    this.set('DB2.DBW2', Math.round(this.getN('C2.PV')), changed);
    this.set('DB2.DBD4', this.cylinderPos, changed);

    return { changed, step };
  }
}

module.exports = { MockPLC, MOCK_TIMER_PRESETS, MOCK_COUNTER_PRESETS, STEP_LABELS, normalizeAddress };
