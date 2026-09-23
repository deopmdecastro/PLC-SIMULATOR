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
  inputs: [false, false, false, false, false, false, false, false],
  outputs: [false, false, false, false, false, false, false, false],
  memoryBits: { M0_0: false, M0_1: false, M0_2: false, M10_0: false },
  mw100: 0,
  cycles: 0,
  autoMode: false,
  startPressed: false,
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
