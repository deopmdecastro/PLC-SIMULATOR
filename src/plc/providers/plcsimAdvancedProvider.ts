/**
 * PLCSIM Advanced Provider — usa a API .NET oficial
 * `Siemens.Simatic.Simulation.Runtime` através do helper Windows
 * (`bridge/plcsim-advanced/`), exposto pelo gateway local.
 *
 * Factos verificados (Siemens Industry Online Support, ID 109826197/109772889):
 *  - a API é .NET e só existe em Windows;
 *  - suporta S7-1500 e ET 200SP (PLCSIM Advanced), não S7-300/400;
 *  - a DLL fica em `C:\Program Files (x86)\Common Files\Siemens\PLCSIMADV\API\`.
 *
 * Este provider NÃO corre no servidor de desenvolvimento Linux: se o helper não
 * estiver disponível, devolve um erro explícito em vez de valores inventados.
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
import { coerceValue, groupByArea } from '../address';
import { GatewayClient } from './gatewayClient';

export const PLCSIM_ADVANCED_REQUIREMENTS =
  'Requer Windows + S7-PLCSIM Advanced instalado (API Siemens.Simatic.Simulation.Runtime). Em Linux/macOS use os providers Mock ou S7.';

export class PLCSimAdvancedProvider implements PLCProvider {
  readonly id = 'plcsim-advanced';
  readonly label = 'PLCSIM Advanced (API .NET)';
  readonly description =
    'Liga-se diretamente a uma instância virtual S7-1500 via API .NET do S7-PLCSIM Advanced. Comunicação por Softbus (local) ou TCP/IP com o PLCSIM Virtual Ethernet Adapter.';
  readonly platform = 'windows' as const;
  readonly requiresGateway = true;

  private client: GatewayClient;
  private connected = false;
  private state: PLCConnectionInfo['status'] = 'disconnected';
  private message = '';
  private latencyMs: number | null = null;
  private lastUpdate: string | null = null;
  private mode: PLCConnectionInfo['mode'] = 'UNKNOWN';
  private cycleTimeMs: number | null = null;
  private readCount = 0;
  private writeCount = 0;
  private errorCount = 0;

  constructor(private config: PLCProviderConfig) {
    this.client = new GatewayClient(config.gatewayUrl, config.timeoutMs);
  }

  async connect(): Promise<void> {
    this.state = 'connecting';
    this.client.setProvider(this.config);
    try {
      await this.client.health();
      const result = await this.client.connect({
        provider: this.id,
        ip: this.config.ip,
        rack: this.config.rack,
        slot: this.config.slot,
        instanceName: this.config.instanceName,
        timeoutMs: this.config.timeoutMs,
      });
      this.connected = true;
      this.state = 'connected';
      const meta = (result.info || {}) as Record<string, unknown>;
      this.mode = (meta.mode as PLCConnectionInfo['mode']) || 'RUN';
      this.cycleTimeMs = typeof meta.cycleTimeMs === 'number' ? meta.cycleTimeMs : null;
      this.message = `Instância "${this.config.instanceName}" ligada (${this.config.ip})`;
    } catch (error) {
      this.connected = false;
      this.state = 'error';
      this.errorCount += 1;
      this.message = `${error instanceof Error ? error.message : String(error)} — ${PLCSIM_ADVANCED_REQUIREMENTS}`;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connected) await this.client.disconnect();
    } catch {
      /* ignorar */
    }
    this.connected = false;
    this.state = 'disconnected';
    this.message = '';
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionInfo(): PLCConnectionInfo {
    return {
      status: this.state,
      providerId: this.id,
      providerLabel: this.label,
      plcName: this.config.instanceName || 'PLCSIM Advanced',
      cpu: 'S7-1500 / ET 200SP (virtual)',
      ip: this.config.ip,
      rack: this.config.rack,
      slot: this.config.slot,
      mode: this.mode,
      cycleTimeMs: this.cycleTimeMs,
      latencyMs: this.latencyMs,
      lastUpdate: this.lastUpdate,
      readCount: this.readCount,
      writeCount: this.writeCount,
      errorCount: this.errorCount,
      message: this.message || (this.connected ? '' : PLCSIM_ADVANCED_REQUIREMENTS),
    };
  }

  async discover(): Promise<PLCDiscoveryResult[]> {
    this.client.setProvider(this.config);
    try {
      const { items } = await this.client.discover(this.id);
      return items;
    } catch (error) {
      return [
        {
          id: 'plcsim-advanced:offline',
          label: 'PLCSIM Advanced não encontrado',
          address: this.config.gatewayUrl,
          detail: `${error instanceof Error ? error.message : String(error)} — ${PLCSIM_ADVANCED_REQUIREMENTS}`,
          reachable: false,
        },
      ];
    }
  }

  async read(definitions: PLCVariableDefinition[]): Promise<PLCVariableValue[]> {
    if (!this.connected) throw new Error(`Sem ligação ao PLCSIM Advanced. ${PLCSIM_ADVANCED_REQUIREMENTS}`);
    const stamp = new Date().toISOString();
    const results: PLCVariableValue[] = [];
    const groups = groupByArea(definitions);

    for (const group of Object.values(groups)) {
      try {
        const start = performance.now();
        const { items } = await this.client.read(this.id, group);
        this.latencyMs = Math.round((performance.now() - start) * 10) / 10;
        items.forEach((item, index) => {
          const definition = group[index];
          if (!definition) return;
          const value = coerceValue(definition.dataType, item?.value);
          results.push({
            id: definition.id,
            address: definition.address,
            value,
            quality: item?.error ? 'bad' : value === null ? 'unknown' : 'good',
            updatedAt: stamp,
          });
        });
      } catch (error) {
        this.errorCount += 1;
        this.message = error instanceof Error ? error.message : String(error);
        for (const definition of group) {
          results.push({ id: definition.id, address: definition.address, value: null, quality: 'bad', updatedAt: stamp });
        }
      }
    }

    this.readCount += 1;
    this.lastUpdate = stamp;
    return results;
  }

  async write(definition: PLCVariableDefinition, value: PLCValue): Promise<void> {
    if (!this.connected) throw new Error(`Sem ligação ao PLCSIM Advanced. ${PLCSIM_ADVANCED_REQUIREMENTS}`);
    try {
      await this.client.write(this.id, definition, value);
      this.writeCount += 1;
    } catch (error) {
      this.errorCount += 1;
      throw error;
    }
  }

  async startCpu(): Promise<void> {
    const result = await this.client.cpu(this.id, 'run');
    this.mode = (result.mode as PLCConnectionInfo['mode']) || 'RUN';
  }

  async stopCpu(): Promise<void> {
    const result = await this.client.cpu(this.id, 'stop');
    this.mode = (result.mode as PLCConnectionInfo['mode']) || 'STOP';
  }

  dispose(): void {
    this.connected = false;
  }
}
