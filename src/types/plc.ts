export interface PLCState {
  run: boolean;
  sf: boolean;
  bf: boolean;
  inputs: boolean[];
  outputs: boolean[];
  memoryBits: {
    M0_0: boolean;
    M0_1: boolean;
    M0_2: boolean;
    M10_0: boolean;
  };
  mw100: number;
  cycles: number;
  autoMode: boolean;
  startPressed: boolean;
  startEPressed: boolean;
  stopNfClosed: boolean;
  frNfClosed: boolean;
  stopHeld: boolean;
  latch: boolean;
  relayK1: boolean;
  relayK2: boolean;
  source: 'simulator' | 'tia-portal';
  updatedAt: string;
}

export const DEFAULT_STATE: PLCState = {
  run: true,
  sf: false,
  bf: false,
  inputs: [false, false, false, false, true, true, false, false],
  outputs: [false, false, false, false, false, false, false, false],
  memoryBits: { M0_0: false, M0_1: false, M0_2: false, M10_0: false },
  mw100: 1,
  cycles: 1,
  autoMode: false,
  startPressed: false,
  startEPressed: false,
  stopNfClosed: true,
  frNfClosed: true,
  stopHeld: false,
  latch: false,
  relayK1: false,
  relayK2: false,
  source: 'simulator',
  updatedAt: new Date().toISOString(),
};

export interface PLCEvent {
  id: number;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TIAConnectionConfig {
  endpoint: string;
  pollingInterval: number;
  enabled: boolean;
}

export interface SimulatorTagConfig {
  address: string;
  label: string;
}

export interface SimulatorConfig {
  profileName: string;
  bridgeEndpoint: string;
  scanIntervalMs: number;
  inputTags: SimulatorTagConfig[];
  outputTags: SimulatorTagConfig[];
  inputLabels: string[];
  outputLabels: string[];
  tagMap: {
    start: string;
    stopNormallyClosed: string;
    startLeft: string;
    thermalNormallyClosed: string;
    autoMode: string;
    motor: string;
    motorLeft: string;
    cycleCounter: string;
  };
}

export type PLCSimulatorConfig = SimulatorConfig;

const DEFAULT_INPUT_TAGS: SimulatorTagConfig[] = [
  { address: 'I0.0', label: 'START_D' },
  { address: 'I0.1', label: 'START_E' },
  { address: 'I0.2', label: 'STOP_NF' },
  { address: 'I0.3', label: 'FR_NF' },
  { address: 'I0.4', label: 'Spare Input 4' },
  { address: 'I0.5', label: 'Spare Input 5' },
  { address: 'I0.6', label: 'Spare Input 6' },
  { address: 'I0.7', label: 'Spare Input 7' },
];

const DEFAULT_OUTPUT_TAGS: SimulatorTagConfig[] = [
  { address: 'Q0.0', label: 'KM1' },
  { address: 'Q0.1', label: 'KM2' },
  { address: 'Q0.2', label: 'Spare Output 2' },
  { address: 'Q0.3', label: 'Spare Output 3' },
  { address: 'Q0.4', label: 'Spare Output 4' },
  { address: 'Q0.5', label: 'Spare Output 5' },
  { address: 'Q0.6', label: 'Spare Output 6' },
  { address: 'Q0.7', label: 'Spare Output 7' },
];

const tagToLabel = (tag: SimulatorTagConfig) => `${tag.address} ${tag.label}`.trim();

export const DEFAULT_CONFIG: PLCSimulatorConfig = {
  profileName: 'Ex6 - Motor D/E com KM1/KM2',
  bridgeEndpoint: 'http://127.0.0.1:8765',
  scanIntervalMs: 500,
  inputTags: DEFAULT_INPUT_TAGS,
  outputTags: DEFAULT_OUTPUT_TAGS,
  inputLabels: DEFAULT_INPUT_TAGS.map(tagToLabel),
  outputLabels: DEFAULT_OUTPUT_TAGS.map(tagToLabel),
  tagMap: {
    start: 'I0.0',
    startLeft: 'I0.1',
    stopNormallyClosed: 'I0.2',
    thermalNormallyClosed: 'I0.3',
    autoMode: '',
    motor: 'Q0.0',
    motorLeft: 'Q0.1',
    cycleCounter: 'MW100',
  },
};

export const DEFAULT_SIMULATOR_CONFIG = DEFAULT_CONFIG;
