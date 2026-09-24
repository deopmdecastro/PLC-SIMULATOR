/**
 * PLC Communication Layer — tipos base.
 *
 * Toda a UI, o editor 2D e o sistema de projetos falam apenas com estas
 * estruturas, independentemente do protocolo usado por baixo.
 */

export type PLCDataType = 'BOOL' | 'BYTE' | 'WORD' | 'DWORD' | 'INT' | 'DINT' | 'REAL';

export type PLCVariableCategory =
  | 'INPUTS'
  | 'OUTPUTS'
  | 'MEMORY'
  | 'DB'
  | 'TIMERS'
  | 'COUNTERS'
  | 'ANALOG'
  | 'STEPS'
  | 'SYSTEM';

export type PLCValue = boolean | number;

/** Qualidade do valor lido — nunca inventamos dados. */
export type PLCQuality = 'good' | 'bad' | 'unknown' | 'forced';

export interface PLCVariableDefinition {
  id: string;
  address: string;
  name: string;
  comment?: string;
  dataType: PLCDataType;
  category: PLCVariableCategory;
  writable: boolean;
  unit?: string;
  min?: number;
  max?: number;
  /** Para REAIS/INT: fator de escala apresentado na UI. */
  scale?: number;
}

export interface PLCVariableValue {
  id: string;
  address: string;
  value: PLCValue | null;
  quality: PLCQuality;
  updatedAt: string;
}

export type PLCConnectionState =
  | 'disconnected'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'error';

export type PLCCpuMode = 'RUN' | 'STOP' | 'UNKNOWN';

export interface PLCConnectionInfo {
  status: PLCConnectionState;
  providerId: string;
  providerLabel: string;
  plcName: string;
  cpu: string;
  ip: string;
  rack: number;
  slot: number;
  mode: PLCCpuMode;
  cycleTimeMs: number | null;
  latencyMs: number | null;
  lastUpdate: string | null;
  readCount: number;
  writeCount: number;
  errorCount: number;
  message: string;
}

export interface PLCDiscoveryResult {
  id: string;
  label: string;
  address: string;
  cpu?: string;
  detail?: string;
  reachable: boolean;
}

export interface PLCProviderConfig {
  providerId: string;
  /** Endereço do gateway local (para os providers s7 / plcsim-advanced). */
  gatewayUrl: string;
  /** Endereço IP do PLC / instância PLCSIM. */
  ip: string;
  rack: number;
  slot: number;
  /** Nome da instância PLCSIM Advanced. */
  instanceName: string;
  /** Intervalo de varrimento em ms. */
  scanIntervalMs: number;
  /** Timeout de leitura em ms. */
  timeoutMs: number;
  /** Reconexão automática. */
  autoReconnect: boolean;
}

export const DEFAULT_PROVIDER_CONFIG: PLCProviderConfig = {
  providerId: 'mock',
  gatewayUrl: 'http://127.0.0.1:8766/plc-api',
  ip: '192.168.0.1',
  rack: 0,
  slot: 1,
  instanceName: 'plcsim-plc-simulator',
  scanIntervalMs: 250,
  timeoutMs: 2000,
  autoReconnect: true,
};

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

export interface PLCProvider {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly platform: 'any' | 'windows';
  /** Plataforma em que o gateway/helper tem de correr. */
  readonly requiresGateway: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionInfo(): PLCConnectionInfo;
  /** Procura instâncias/CPUs disponíveis (deteção automática). */
  discover(): Promise<PLCDiscoveryResult[]>;
  /** Leitura agrupada — o provider decide como agrupar/otimizar. */
  read(definitions: PLCVariableDefinition[]): Promise<PLCVariableValue[]>;
  write(definition: PLCVariableDefinition, value: PLCValue): Promise<void>;
  startCpu(): Promise<void>;
  stopCpu(): Promise<void>;
  dispose(): void;
}

export type PLCProviderFactory = (config: PLCProviderConfig) => PLCProvider;

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                         */
/* ------------------------------------------------------------------ */

export type PLCDiagnosticLevel = 'info' | 'success' | 'warning' | 'error' | 'value';

export interface PLCDiagnosticEvent {
  id: number;
  at: string;
  level: PLCDiagnosticLevel;
  source: string;
  message: string;
  detail?: string;
}

export interface PLCVariableChange {
  id: string;
  address: string;
  name: string;
  previous: PLCValue | null;
  current: PLCValue | null;
}
