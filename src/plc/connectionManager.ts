/**
 * Connection Manager — proprietário único do ciclo de vida da comunicação.
 *
 * Responsabilidades:
 *   - descoberta automática do PLC;
 *   - ligação com retry + backoff exponencial;
 *   - varrimento (poll) agrupado com debounce de escrita;
 *   - diff de valores → eventos de diagnóstico;
 *   - latência, contadores e recuperação de erros;
 *   - nunca bloquear a UI (todo o I/O é assíncrono e com timeouts).
 */

import type {
  PLCConnectionInfo,
  PLCDiagnosticEvent,
  PLCProvider,
  PLCProviderConfig,
  PLCValue,
  PLCVariableChange,
  PLCVariableDefinition,
  PLCVariableValue,
} from './types';
import { DiagnosticBus, describeError } from './diagnostics';
import { createProvider, getProviderDescriptor } from './providers';

export interface PLCSnapshot {
  info: PLCConnectionInfo;
  values: Record<string, PLCVariableValue>;
  changes: PLCVariableChange[];
  diagnostics: PLCDiagnosticEvent[];
}

export type PLCSnapshotListener = (snapshot: PLCSnapshot) => void;

const MAX_BACKOFF_MS = 8000;

export class PLCConnectionManager {
  private provider: PLCProvider;
  private config: PLCProviderConfig;
  private bus = new DiagnosticBus();
  private definitions: PLCVariableDefinition[] = [];
  private values = new Map<string, PLCVariableValue>();
  private names = new Map<string, string>();
  private listeners = new Set<PLCSnapshotListener>();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;
  private failures = 0;
  private consecutiveErrors = 0;

  constructor(config: PLCProviderConfig) {
    this.config = { ...config };
    this.provider = createProvider(this.config);
    this.bus.push('info', 'manager', `Provider inicializado: ${this.provider.label}`);
  }

  /* ------------------------------ ciclo de vida ------------------------------ */

  subscribe(listener: PLCSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  setVariableDefinitions(definitions: PLCVariableDefinition[]): void {
    this.definitions = definitions;
    this.names = new Map(definitions.map((definition) => [definition.id, definition.name]));
    this.emit();
  }

  getVariableDefinitions(): PLCVariableDefinition[] {
    return this.definitions;
  }

  getConfig(): PLCProviderConfig {
    return { ...this.config };
  }

  getProvider(): PLCProvider {
    return this.provider;
  }

  async applyConfig(next: Partial<PLCProviderConfig>): Promise<void> {
    const providerChanged = next.providerId !== undefined && next.providerId !== this.config.providerId;
    this.config = { ...this.config, ...next };
    this.bus.push('info', 'manager', 'Configuração de comunicação atualizada', JSON.stringify(next));
    if (providerChanged) {
      this.stopPolling();
      this.provider.dispose();
      this.provider = createProvider(this.config);
      this.values.clear();
      this.bus.push('info', 'manager', `Provider alterado para ${this.provider.label}`);
    }
    this.emit();
  }

  getSnapshot(): PLCSnapshot {
    return {
      info: this.provider.getConnectionInfo(),
      values: Object.fromEntries(this.values),
      changes: [],
      diagnostics: this.bus.list(),
    };
  }

  private emit(changes: PLCVariableChange[] = []): void {
    const snapshot: PLCSnapshot = {
      info: this.provider.getConnectionInfo(),
      values: Object.fromEntries(this.values),
      changes,
      diagnostics: this.bus.list(),
    };
    for (const listener of this.listeners) listener(snapshot);
  }

  /* --------------------------------- ligação -------------------------------- */

  async discover() {
    const descriptor = getProviderDescriptor(this.config.providerId);
    this.bus.push('info', 'discovery', `A procurar PLC via ${descriptor.label}...`);
    const items = await this.provider.discover();
    for (const item of items) {
      this.bus.push(
        item.reachable ? 'success' : 'warning',
        'discovery',
        `${item.label} (${item.address})`,
        item.detail,
      );
    }
    if (!items.some((item) => item.reachable)) {
      this.bus.push('warning', 'discovery', 'Nenhuma instância PLCSIM/PLC encontrada');
    }
    this.emit();
    return items;
  }

  async connect(): Promise<void> {
    try {
      await this.provider.connect();
      this.failures = 0;
      this.consecutiveErrors = 0;
      this.bus.push('success', 'connection', `PLC ligado — ${this.provider.getConnectionInfo().plcName}`);
      this.startPolling();
      this.emit();
    } catch (error) {
      this.bus.push('error', 'connection', 'Falha ao ligar ao PLC', describeError(error));
      this.scheduleReconnect();
      this.emit();
      throw error;
    }
  }

  /** Deteção + ligação numa só chamada (fluxo do arranque da aplicação). */
  async autoConnect(): Promise<void> {
    try {
      await this.discover();
    } catch (error) {
      this.bus.push('error', 'discovery', 'A descoberta falhou', describeError(error));
    }
    try {
      await this.connect();
    } catch {
      /* o estado e a reconexão automática já foram tratados em connect() */
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    try {
      await this.provider.disconnect();
    } catch (error) {
      this.bus.push('warning', 'connection', 'Erro ao desligar', describeError(error));
    }
    this.bus.push('info', 'connection', 'PLC desligado pelo utilizador');
    this.emit();
  }

  private scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;
    this.failures += 1;
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(this.failures, 4));
    this.bus.push('warning', 'connection', `Nova tentativa de ligação em ${Math.round(delay / 1000)}s`);
    setTimeout(() => {
      if (this.running || this.failures === 0) return;
      void this.connect().catch(() => undefined);
    }, delay);
  }

  /* --------------------------------- polling -------------------------------- */

  startPolling(): void {
    if (this.running) return;
    this.running = true;
    this.pollTimer = setTimeout(() => void this.tick(), 0);
  }

  stopPolling(): void {
    this.running = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  isPolling(): boolean {
    return this.running;
  }

  /** Um varrimento completo: lê, faz diff, publica. */
  private async tick(): Promise<void> {
    if (!this.running) return;
    if (this.inFlight) return;

    if (!this.provider.isConnected()) {
      this.schedulePoll();
      return;
    }

    if (this.definitions.length === 0) {
      this.schedulePoll();
      return;
    }

    this.inFlight = true;
    const started = performance.now();
    try {
      const readValues = await this.provider.read(this.definitions);
      const changes: PLCVariableChange[] = [];

      for (const value of readValues) {
        const previous = this.values.get(value.id);
        if (!previous || previous.value !== value.value || previous.quality !== value.quality) {
          if (previous && previous.value !== value.value && value.quality === 'good') {
            changes.push({
              id: value.id,
              address: value.address,
              name: this.names.get(value.id) || value.address,
              previous: previous.value,
              current: value.value,
            });
          }
          this.values.set(value.id, value);
        }
      }

      for (const change of changes) {
        this.bus.value(change.address, change.name, change.previous, change.current);
      }

      this.consecutiveErrors = 0;
      this.failures = 0;
      void started;
      this.emit(changes);
    } catch (error) {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors <= 3) {
        this.bus.push('error', 'read', 'Erro de leitura', describeError(error));
      } else if (this.consecutiveErrors === 4) {
        this.bus.push('error', 'read', 'Erros de leitura repetidos — a suspender mensagens idênticas');
      }
      if (this.consecutiveErrors >= 3) {
        this.bus.push('error', 'connection', 'Comunicação perdida — a tentar reconectar');
        this.stopPolling();
        this.provider.disconnect().catch(() => undefined);
        this.scheduleReconnect();
        this.emit();
        return;
      }
      this.emit();
    } finally {
      this.inFlight = false;
    }

    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (!this.running) return;
    const interval = Math.max(50, this.config.scanIntervalMs);
    this.pollTimer = setTimeout(() => void this.tick(), interval);
  }

  /* --------------------------------- escrita -------------------------------- */

  async writeValue(definition: PLCVariableDefinition, value: PLCValue): Promise<void> {
    if (!definition.writable) {
      this.bus.push('warning', 'write', `Endereço ${definition.address} é apenas de leitura`);
      throw new Error(`${definition.address} não é gravável`);
    }
    try {
      await this.provider.write(definition, value);
      // Atualização otimista: a UI reage imediatamente e o poll confirma.
      const optimistic: PLCVariableValue = {
        id: definition.id,
        address: definition.address,
        value,
        quality: 'good',
        updatedAt: new Date().toISOString(),
      };
      this.values.set(definition.id, optimistic);
      this.bus.push('success', 'write', `${definition.name} (${definition.address}) ← ${formatForLog(value)}`);
      this.emit();
    } catch (error) {
      this.bus.push('error', 'write', `Falha ao escrever ${definition.address}`, describeError(error));
      this.emit();
      throw error;
    }
  }

  async writeAddress(address: string, value: PLCValue): Promise<void> {
    const definition = this.definitions.find((item) => item.address.toUpperCase() === address.toUpperCase());
    if (!definition) {
      this.bus.push('error', 'write', `Endereço ${address} não está mapeado`, 'Adicione a variável ao projeto');
      throw new Error(`Endereço ${address} não está mapeado no projeto atual`);
    }
    await this.writeValue(definition, value);
  }

  async setCpuMode(action: 'run' | 'stop'): Promise<void> {
    try {
      if (action === 'run') await this.provider.startCpu();
      else await this.provider.stopCpu();
      this.bus.push('info', 'cpu', `CPU → ${action.toUpperCase()}`);
      this.emit();
    } catch (error) {
      this.bus.push('error', 'cpu', `Falha ao comandar ${action.toUpperCase()}`, describeError(error));
      this.emit();
      throw error;
    }
  }

  logUser(level: PLCDiagnosticEvent['level'], message: string, detail?: string): void {
    this.bus.push(level, 'ui', message, detail);
    this.emit();
  }

  clearDiagnostics(): void {
    this.bus.clear();
    this.emit();
  }

  /** Diagnóstico de comunicação agregado (página de diagnóstico). */
  getDiagnosticsSummary() {
    const info = this.provider.getConnectionInfo();
    return {
      info,
      polling: this.running,
      variables: this.definitions.length,
      mapped: this.values.size,
      stale: [...this.values.values()].filter((value) => value.quality !== 'good').length,
      readRate: info.readCount,
      writeCount: info.writeCount,
      errorCount: info.errorCount,
    };
  }

  dispose(): void {
    this.stopPolling();
    this.provider.dispose();
    this.listeners.clear();
  }
}

function formatForLog(value: PLCValue): string {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}
