/**
 * S7 Provider — comunicação com a CPU pelo protocolo S7 (ISO-on-TCP / RFC1006)
 * através do gateway local (snap7 / nodes7).
 *
 * Limites reais (documentados, não inventados):
 *  - S7-1200/1500 exigem **PUT/GET ativado** na CPU;
 *  - endereçamento absoluto de DBs exige **acesso otimizado desativado** no bloco;
 *  - temporizadores/contadores IEC vivem em DBs de instância.
 * Ver docs/TIA_SETUP.md.
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

export class S7Provider implements PLCProvider {
  readonly id = 's7';
  readonly label = 'S7 (protocolo S7 / PUT-GET)';
  readonly description =
    'Fala S7comm (ISO-on-TCP) com a CPU ou com o NetToPLCsim. Requer PUT/GET ativado e DBs sem acesso otimizado para endereçamento absoluto.';
  readonly platform = 'any' as const;
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
        timeoutMs: this.config.timeoutMs,
      });
      this.connected = true;
      this.state = 'connected';
      const meta = (result.info || {}) as Record<string, unknown>;
      this.mode = (meta.mode as PLCConnectionInfo['mode']) || 'RUN';
      this.cycleTimeMs = typeof meta.cycleTimeMs === 'number' ? meta.cycleTimeMs : null;
      this.message = `Ligado a ${this.config.ip} (rack ${this.config.rack} / slot ${this.config.slot})`;
    } catch (error) {
      this.connected = false;
      this.state = 'error';
      this.errorCount += 1;
      this.message = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connected) await this.client.disconnect();
    } catch {
      /* ignorar — a ligação está a ser desfeita de qualquer forma */
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
      plcName: `CPU ${this.config.ip}`,
      cpu: 'S7-1200/1500/300/400',
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
      message: this.message || (this.connected ? '' : 'Sem ligação. Verifique o gateway local e o TIA Portal.'),
    };
  }

  async discover(): Promise<PLCDiscoveryResult[]> {
    this.client.setProvider(this.config);
    try {
      const { items } = await this.client.discover(this.id);
      return items;
    } catch (error) {
      // Sem gateway não há descoberta — devolvemos falha explícita, sem inventar.
      return [
        {
          id: 's7:offline',
          label: 'Gateway S7 indisponível',
          address: this.config.gatewayUrl,
          detail: error instanceof Error ? error.message : String(error),
          reachable: false,
        },
      ];
    }
  }

  async read(definitions: PLCVariableDefinition[]): Promise<PLCVariableValue[]> {
    if (!this.connected) throw new Error('Sem ligação S7');
    const stamp = new Date().toISOString();
    const results: PLCVariableValue[] = [];

    // Leitura agrupada por área → menos pedidos ao PLC.
    const groups = groupByArea(definitions);
    for (const group of Object.values(groups)) {
      try {
        const start = performance.now();
        const { items } = await this.client.read(this.id, group);
        this.latencyMs = Math.round((performance.now() - start) * 10) / 10;
        items.forEach((item, index) => {
          const definition = group[index];
          if (!definition) return;
          if (item?.error) {
            results.push({ id: definition.id, address: definition.address, value: null, quality: 'bad', updatedAt: stamp });
            return;
          }
          const value = coerceValue(definition.dataType, item?.value);
          results.push({
            id: definition.id,
            address: definition.address,
            value,
            quality: item?.quality === 'good' && value !== null ? 'good' : 'unknown',
            updatedAt: stamp,
          });
        });
      } catch (error) {
        this.errorCount += 1;
        for (const definition of group) {
          results.push({
            id: definition.id,
            address: definition.address,
            value: null,
            quality: 'bad',
            updatedAt: stamp,
          });
        }
        this.message = error instanceof Error ? error.message : String(error);
      }
    }

    this.readCount += 1;
    this.lastUpdate = stamp;
    return results;
  }

  async write(definition: PLCVariableDefinition, value: PLCValue): Promise<void> {
    if (!this.connected) throw new Error('Sem ligação S7');
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
