import type { PLCEvent, PLCSimulatorConfig, PLCState } from '@/types/plc';
import { DEFAULT_CONFIG, DEFAULT_STATE } from '@/types/plc';

const API_BASE = '/api';

type BridgeState = {
  run?: boolean;
  sf?: boolean;
  bf?: boolean;
  inputs?: { bits?: boolean[] } | boolean[];
  outputs?: { bits?: boolean[] } | boolean[];
  memory_bits?: Record<string, boolean>;
  mw100?: number;
  cycles?: number;
  auto_mode?: boolean;
  start_pressed?: boolean;
  start_e_pressed?: boolean;
  stop_nf_closed?: boolean;
  fr_nf_closed?: boolean;
  stop_held?: boolean;
  latch?: boolean;
  relay_k1?: boolean;
  relay_k2?: boolean;
  source?: 'simulator' | 'tia-portal';
  updated_at?: string;
};

type BridgeEvent = {
  id: number;
  event_type: string;
  source: string;
  payload?: Record<string, unknown>;
  created_at: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function bits(value: BridgeState['inputs'], fallback: boolean[]) {
  if (Array.isArray(value)) return value;
  return value?.bits ?? fallback;
}

export function bridgeStateToPLCState(row: BridgeState): PLCState {
  const memoryBits = row.memory_bits ?? DEFAULT_STATE.memoryBits;
  const inputBits = bits(row.inputs, DEFAULT_STATE.inputs);
  const outputBits = bits(row.outputs, DEFAULT_STATE.outputs);
  const stopNfClosed = row.stop_nf_closed ?? inputBits[5] ?? DEFAULT_STATE.stopNfClosed;

  return {
    run: row.run ?? DEFAULT_STATE.run,
    sf: row.sf ?? DEFAULT_STATE.sf,
    bf: row.bf ?? DEFAULT_STATE.bf,
    inputs: inputBits,
    outputs: outputBits,
    memoryBits: {
      M0_0: memoryBits.M0_0 ?? false,
      M0_1: memoryBits.M0_1 ?? false,
      M0_2: memoryBits.M0_2 ?? false,
      M10_0: memoryBits.M10_0 ?? false,
    },
    mw100: row.mw100 ?? DEFAULT_STATE.mw100,
    cycles: row.cycles ?? DEFAULT_STATE.cycles,
    autoMode: row.auto_mode ?? DEFAULT_STATE.autoMode,
    startPressed: row.start_pressed ?? inputBits[7] ?? DEFAULT_STATE.startPressed,
    startEPressed: row.start_e_pressed ?? inputBits[6] ?? DEFAULT_STATE.startEPressed,
    stopNfClosed,
    frNfClosed: row.fr_nf_closed ?? inputBits[4] ?? DEFAULT_STATE.frNfClosed,
    stopHeld: row.stop_held ?? !stopNfClosed,
    latch: row.latch ?? DEFAULT_STATE.latch,
    relayK1: row.relay_k1 ?? DEFAULT_STATE.relayK1,
    relayK2: row.relay_k2 ?? DEFAULT_STATE.relayK2,
    source: row.source ?? DEFAULT_STATE.source,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function plcStateToBridgeState(state: PLCState): BridgeState {
  return {
    run: state.run,
    sf: state.sf,
    bf: state.bf,
    inputs: { bits: state.inputs },
    outputs: { bits: state.outputs },
    memory_bits: state.memoryBits,
    mw100: state.mw100,
    cycles: state.cycles,
    auto_mode: state.autoMode,
    start_pressed: state.startPressed,
    start_e_pressed: state.startEPressed,
    stop_nf_closed: state.stopNfClosed,
    fr_nf_closed: state.frNfClosed,
    stop_held: state.stopHeld,
    latch: state.latch,
    relay_k1: state.relayK1,
    relay_k2: state.relayK2,
    source: state.source,
    updated_at: state.updatedAt,
  };
}

export const localBridgeClient = {
  health() {
    return requestJson<{ ok: boolean; endpoint: string; updated_at: string }>('/health');
  },

  async getState() {
    return bridgeStateToPLCState(await requestJson<BridgeState>('/state'));
  },

  async updateState(state: PLCState) {
    return bridgeStateToPLCState(
      await requestJson<BridgeState>('/update', {
        method: 'PUT',
        body: JSON.stringify(plcStateToBridgeState(state)),
      }),
    );
  },

  async getEvents(limit = 50): Promise<PLCEvent[]> {
    const rows = await requestJson<BridgeEvent[]>(`/events?limit=${limit}`);
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      source: row.source,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    }));
  },

  async getConfig(): Promise<PLCSimulatorConfig> {
    const config = await requestJson<Partial<PLCSimulatorConfig>>('/config');
    return {
      ...DEFAULT_CONFIG,
      ...config,
      tagMap: { ...DEFAULT_CONFIG.tagMap, ...(config.tagMap || {}) },
      inputLabels: config.inputLabels || DEFAULT_CONFIG.inputLabels,
      outputLabels: config.outputLabels || DEFAULT_CONFIG.outputLabels,
    };
  },

  async updateConfig(config: PLCSimulatorConfig): Promise<PLCSimulatorConfig> {
    const saved = await requestJson<PLCSimulatorConfig>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      tagMap: { ...DEFAULT_CONFIG.tagMap, ...(saved.tagMap || {}) },
    };
  },
};
