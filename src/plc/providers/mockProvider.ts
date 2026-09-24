/**
 * Mock Provider — PLC simulado 100% offline.
 *
 * Executa em TypeScript um programa OB1 demo (sequência de 7 etapas com motor
 * D/E, cilindro, válvula, conveyor, sensores, timers, contadores e um DB).
 * Permite exercitar toda a interface, o editor 2D e o mapeamento sem TIA Portal.
 *
 * Nenhum valor é inventado para endereços que o mock não conhece: esses
 * devolvem `null` com qualidade `unknown`.
 */

import type {
  PLCConnectionInfo,
  PLCDiscoveryResult,
  PLCProvider,
  PLCProviderConfig,
  PLCValue,
  PLCVariableDefinition,
  PLCVariableValue,
} from '../types';
import { coerceValue, normalizeAddress } from '../address';

export const MOCK_TIMER_PRESETS: Record<string, number> = { T1: 3000, T2: 5000, T3: 2000 };
export const MOCK_COUNTER_PRESETS: Record<string, number> = { C1: 100, C2: 1000 };

export const STEP_LABELS: Record<number, string> = {
  0: 'INITIALIZATION',
  1: 'WAIT START',
  2: 'CYLINDER EXTENSION',
  3: 'WAIT SENSOR',
  4: 'MOTOR ON',
  5: 'CYLINDER RETRACTION',
  6: 'END CYCLE',
};

export const MOCK_OUTPUT_ADDRESSES = [
  'Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7',
];

export interface MockScanResult {
  changed: string[];
  step: number;
}

export class MockPLC {
  values = new Map<string, PLCValue>();
  run = true;
  cycleTimeMs = 2.1;

  private lastScan = Date.now();
  private stepElapsed = 0;
  private initElapsed = 0;
  private motorElapsed = 0;
  private retractElapsed = 0;
  private cylinderPos = 0;
  private conveyorOffset = 0;
  private lastStep = -1;
  private prevPartSignal = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    const seeded: Record<string, PLCValue> = {
      // Entradas digitais
      'I0.0': false, // START
      'I0.1': true,  // STOP_NF  (normalmente fechado = TRUE)
      'I0.2': false, // SENSOR_1
      'I0.3': false, // SENSOR_2
      'I0.4': true,  // E_STOP_NF
      'I0.5': false, // AUTO/MANUAL selector
      'I0.6': false, // RESET
      'I0.7': false, // SPARE
      // Entradas analógicas
      'IW64': 0,
      'IW66': 0,
      // Saídas digitais
      'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false,
      'Q0.4': false, 'Q0.5': false, 'Q0.6': false, 'Q0.7': false,
      // Saídas analógicas
      'QW80': 0,
      // Memórias
      'M0.0': false, 'M0.1': false, 'M0.2': false, 'M0.3': false, 'M10.0': false,
      'MW100': 0, 'MW102': 0, 'MD50': 0,
      // DB1 — parâmetros de processo
      'DB1.DBX0.0': false, 'DB1.DBW2': 1200, 'DB1.DBD4': 0, 'DB1.DBW6': 800, 'DB1.DBX8.0': false,
      // DB2 — estatísticas
      'DB2.DBW0': 0, 'DB2.DBW2': 0, 'DB2.DBD4': 0,
      // Temporizadores (T1=run motor, T2=conveyor, T3=buzzer)
      T1: false, 'T1.ET': 0, 'T1.PT': MOCK_TIMER_PRESETS.T1,
      T2: false, 'T2.ET': 0, 'T2.PT': MOCK_TIMER_PRESETS.T2,
      T3: false, 'T3.ET': 0, 'T3.PT': MOCK_TIMER_PRESETS.T3,
      // Contadores (C1=peças, C2=ciclos)
      C1: false, 'C1.PV': 0, 'C1.PRESET': MOCK_COUNTER_PRESETS.C1,
      C2: false, 'C2.PV': 0, 'C2.PRESET': MOCK_COUNTER_PRESETS.C2,
    };
    this.values = new Map(Object.entries(seeded));
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

  private getB(address: string): boolean {
    return Boolean(this.values.get(normalizeAddress(address)));
  }

  private getN(address: string): number {
    const raw = this.values.get(normalizeAddress(address));
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  getStep(): number {
    return Math.round(this.getN('MW100'));
  }

  /** Guarda o valor devolvido na primeira alteração (evita ruído no log). */
  private setKV(map: Map<string, PLCValue>, changed: string[], address: string, value: PLCValue): void {
    const key = normalizeAddress(address);
    if (map.get(key) !== value) {
      map.set(key, value);
      changed.push(key);
    }
  }

  private write(address: string, value: PLCValue, changed: string[]): void {
    this.setKV(this.values, changed, address, value);
  }

  /**
   * Regista o tempo de execução de um temporizador IEC e devolve o estado.
   * `PT` é o preset, `ET` o tempo decorrido.
   */
  private timer(id: string, running: boolean, dtMs: number, changed: string[]) {
    const preset = MOCK_TIMER_PRESETS[id];
    let et = this.getN(`${id}.ET`);
    et = running ? Math.min(preset, et + dtMs) : 0;
    const done = running && et >= preset;
    this.write(`${id}.ET`, Math.round(et), changed);
    this.write(`${id}.PT`, preset, changed);
    this.write(id, done, changed);
    return { et, done, preset };
  }

  private counter(id: string, increment: boolean, reset: boolean, changed: string[]) {
    const preset = MOCK_COUNTER_PRESETS[id];
    let pv = Math.round(this.getN(`${id}.PV`));
    if (reset) pv = 0;
    else if (increment) pv += 1;
    const done = pv >= preset;
    this.write(`${id}.PV`, pv, changed);
    this.write(`${id}.PRESET`, preset, changed);
    this.write(id, done, changed);
    return { pv, done, preset };
  }

  scan(): MockScanResult {
    const now = Date.now();
    const dtMs = Math.max(0, Math.min(500, now - this.lastScan));
    this.lastScan = now;
    const changed: string[] = [];

    if (!this.run) {
      // CPU em STOP: saídas caem e os temporizadores congelam.
      for (const address of MOCK_OUTPUT_ADDRESSES) this.write(address, false, changed);
      this.write('M0.2', false, changed);
      return { changed, step: this.getStep() };
    }

    /* ---------------- Leitura do processo de entrada ---------------- */
    const start = this.getB('I0.0');
    const stopNf = this.getB('I0.1');
    const sensor1 = this.getB('I0.2');
    const sensor2 = this.getB('I0.3');
    const eStopNf = this.getB('I0.4');
    const autoSel = this.getB('I0.5');
    const reset = this.getB('I0.6');
    const analogIn = Math.max(0, Math.min(27648, Math.round(this.getN('IW64'))));

    /* ---------------- Gestão de segurança ---------------- */
    let fault = this.getB('M0.1');
    if (!stopNf || !eStopNf) fault = true;
    if (reset && stopNf && eStopNf) fault = false;
    this.write('M0.1', fault, changed);
    const safe = !fault;

    this.write('M0.0', autoSel, changed);

    /* ---------------- Banco de dados de processo ---------------- */
    const motor1 = this.getB('Q0.0');
    const valve = this.getB('Q0.2');
    const cylinderTarget = valve && safe ? 100 : 0;
    const travel = dtMs / 12; // ≈1.2 s de curso completo
    if (this.cylinderPos < cylinderTarget) {
      this.cylinderPos = Math.min(cylinderTarget, this.cylinderPos + travel);
    } else if (this.cylinderPos > cylinderTarget) {
      this.cylinderPos = Math.max(cylinderTarget, this.cylinderPos - travel);
    }
    this.cylinderPos = Math.round(this.cylinderPos * 10) / 10;
    const extended = this.cylinderPos >= 99.5;
    this.write('DB1.DBD4', this.cylinderPos, changed);
    this.write('DB1.DBX8.0', extended, changed);
    this.write('M0.3', extended, changed);

    if (motor1 && safe) {
      this.conveyorOffset = (this.conveyorOffset + dtMs / 20) % 360;
    }
    this.write('MD50', Math.round(this.conveyorOffset * 100) / 100, changed);
    this.write('DB1.DBW2', Math.round(600 + (analogIn / 27648) * 2400), changed);
    this.write('QW80', safe && motor1 ? Math.round((analogIn / 27648) * 27648) : 0, changed);

    /* ---------------- Sequência de 7 etapas (MW100 / G0) ---------------- */
    let step = this.getStep();
    this.stepElapsed += dtMs;

    const goTo = (next: number) => {
      step = next;
      this.stepElapsed = 0;
    };

    switch (step) {
      case 0:
        this.initElapsed += dtMs;
        if (this.initElapsed >= 1000) {
          this.initElapsed = 0;
          goTo(1);
        }
        break;
      case 1: {
        if (safe && (start || autoSel)) goTo(2);
        break;
      }
      case 2: {
        if (!safe) { goTo(1); break; }
        if (extended) goTo(3);
        break;
      }
      case 3: {
        if (!safe) { goTo(1); break; }
        if (sensor1 || sensor2) goTo(4);
        break;
      }
      case 4: {
        this.motorElapsed += dtMs;
        if (!safe) { goTo(1); break; }
        if (this.motorElapsed >= MOCK_TIMER_PRESETS.T1) goTo(5);
        break;
      }
      case 5: {
        this.retractElapsed += dtMs;
        if (this.cylinderPos <= 0.5 || this.retractElapsed >= 1500) { this.retractElapsed = 0; goTo(6); }
        break;
      }
      case 6:
        if (this.stepElapsed >= 400) {
          this.motorElapsed = 0;
          goTo(1);
        }
        break;
      default:
        goTo(1);
        break;
    }

    if (step !== this.getStep()) this.write('MW100', step, changed);
    this.write('MW102', step, changed);

    /* ---------------- Saídas digitais ---------------- */
    const inStep = (n: number) => step === n && safe;
    this.write('Q0.0', inStep(4), changed);              // MOTOR_1
    this.write('Q0.1', inStep(4) && sensor2, changed);   // MOTOR_2 (reverso)
    // Válvula de avanço: abre para estender (etapa 2) e MANTÉM-se aberta durante
    // a espera pelo sensor (etapa 3) e a marcha do motor (etapa 4), para o
    // cilindro ficar retido. Na etapa 5 fecha-se e o cilindro recolhe por mola.
    this.write('Q0.2', (step === 2 || step === 3 || step === 4) && safe, changed);
    this.write('Q0.3', step === 1 || step === 6, changed); // GREEN_LAMP (pronto)
    this.write('Q0.4', fault, changed);                  // BUZZER (avaria)
    this.write('Q0.5', inStep(4), changed);              // CONVEYOR
    this.write('Q0.6', !safe, changed);                  // RED_LAMP (paragem)
    this.write('Q0.7', inStep(2) || inStep(3) || inStep(5), changed); // FAN

    /* ---------------- Recolha do cilindro na etapa 5 ---------------- */
    if (step === 5 && this.cylinderPos > 0.5) this.write('Q0.1', false, changed);

    /* ---------------- Estado do ciclo / memórias ---------------- */
    const cycleActive = step >= 2 && step <= 5 && safe;
    this.write('M0.2', cycleActive, changed);
    const atTarget = Math.abs(this.cylinderPos - cylinderTarget) < 0.5;
    this.write('M10.0', atTarget && cycleActive, changed);

    /* ---------------- Temporizadores ---------------- */
    const t1 = this.timer('T1', step === 4 && safe, dtMs, changed);
    const t2 = this.timer('T2', step === 4 && safe, dtMs, changed);
    const t3 = this.timer('T3', fault, dtMs, changed);
    if (t1.done && step === 4) goTo(5);
    void t2;
    void t3;

    /* ---------------- Contadores ---------------- */
    // C1 conta peças: só no FLANCO de subida do sinal, com o tapete em marcha
    // (sem isto contaria um valor por cada varrimento). C2 conta ciclos concluídos.
    const partSignal = sensor2 && this.getB('Q0.5');
    const partDetected = partSignal && !this.prevPartSignal;
    this.prevPartSignal = partSignal;
    const cycleCompleted = step === 6 && this.lastStep !== 6;
    this.lastStep = step;
    this.counter('C1', partDetected, reset, changed);
    this.counter('C2', cycleCompleted, reset, changed);

    /* ---------------- DB2 — estatísticas ---------------- */
    this.write('DB2.DBW0', Math.round(this.getN('C1.PV')), changed);
    this.write('DB2.DBW2', Math.round(this.getN('C2.PV')), changed);
    this.write('DB2.DBD4', this.cylinderPos, changed);

    return { changed, step };
  }

}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export class MockProvider implements PLCProvider {
  readonly id = 'mock';
  readonly label = 'Mock PLC (offline/demo)';
  readonly description =
    'PLC simulado em software — executa o programa OB1 demo sem TIA Portal. Ideal para desenvolvimento e testes da interface.';
  readonly platform = 'any' as const;
  readonly requiresGateway = false;

  private plc = new MockPLC();
  private connected = false;
  private latencyMs: number | null = null;
  private lastUpdate: string | null = null;
  private readCount = 0;
  private writeCount = 0;
  private errorCount = 0;

  constructor(private config: PLCProviderConfig) {}

  async connect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    this.connected = true;
    this.lastUpdate = new Date().toISOString();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.plc.run = true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionInfo(): PLCConnectionInfo {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      providerId: this.id,
      providerLabel: this.label,
      plcName: 'MOCK-PLC-DEMO',
      cpu: 'S7-1500 (simulado)',
      ip: 'local',
      rack: 0,
      slot: 1,
      mode: this.connected ? (this.plc.run ? 'RUN' : 'STOP') : 'UNKNOWN',
      cycleTimeMs: this.plc.cycleTimeMs,
      latencyMs: this.latencyMs,
      lastUpdate: this.lastUpdate,
      readCount: this.readCount,
      writeCount: this.writeCount,
      errorCount: this.errorCount,
      message: this.connected ? 'Mock PLC em execução (programa OB1 demo)' : 'Mock PLC desligado',
    };
  }

  async discover(): Promise<PLCDiscoveryResult[]> {
    return [
      {
        id: 'mock:demo',
        label: 'MOCK-PLC-DEMO',
        address: 'local',
        cpu: 'S7-1500 (simulado)',
        detail: 'Programa OB1 demo com sequência de 7 etapas',
        reachable: true,
      },
    ];
  }

  async read(definitions: PLCVariableDefinition[]): Promise<PLCVariableValue[]> {
    if (!this.connected) throw new Error('Mock PLC não está ligado');
    const start = performance.now();
    this.plc.scan();
    const stamp = new Date().toISOString();
    this.readCount += 1;
    this.latencyMs = Math.round((performance.now() - start) * 100) / 100;
    this.lastUpdate = stamp;

    return definitions.map((definition) => {
      const key = normalizeAddress(definition.address);
      if (!this.plc.values.has(key)) {
        return { id: definition.id, address: definition.address, value: null, quality: 'unknown', updatedAt: stamp };
      }
      const raw = this.plc.values.get(key);
      return {
        id: definition.id,
        address: definition.address,
        value: coerceValue(definition.dataType, raw),
        quality: 'good' as const,
        updatedAt: stamp,
      };
    });
  }

  async write(definition: PLCVariableDefinition, value: PLCValue): Promise<void> {
    if (!this.connected) throw new Error('Mock PLC não está ligado');
    const key = normalizeAddress(definition.address);
    if (!this.plc.values.has(key)) {
      this.errorCount += 1;
      throw new Error(`Endereço ${definition.address} não existe no PLC mock`);
    }
    this.plc.values.set(key, coerceValue(definition.dataType, value) ?? 0);
    this.writeCount += 1;
  }

  async startCpu(): Promise<void> {
    this.plc.run = true;
  }

  async stopCpu(): Promise<void> {
    this.plc.run = false;
  }

  /** Estado interno exposto para o teste unitário do simulador. */
  getMockState(): MockPLC {
    return this.plc;
  }

  getStep(): number {
    return this.plc.getStep();
  }

  resetProcess(): void {
    this.plc.reset();
  }

  dispose(): void {
    this.connected = false;
  }
}
