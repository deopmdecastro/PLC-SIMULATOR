/**
 * Cliente HTTP do gateway local de PLC (`bridge/plc_gateway.cjs`).
 *
 * Os providers S7 e PLCSIM Advanced partilham este cliente: o browser não fala
 * o protocolo S7 nem carrega DLLs .NET, portanto o gateway corre no PC do
 * utilizador (onde estão o TIA Portal / PLCSIM / NetToPLCsim).
 */

import type { PLCValue, PLCVariableDefinition } from '../types';

export interface GatewayReadRequest {
  address: string;
  dataType: string;
}

export interface GatewayReadItem {
  address: string;
  value?: PLCValue | null;
  quality?: 'good' | 'bad' | 'unknown';
  error?: string;
}

export interface GatewayDiscoveryItem {
  id: string;
  label: string;
  address: string;
  cpu?: string;
  detail?: string;
  reachable: boolean;
}

export interface GatewayConnectRequest {
  provider: string;
  ip: string;
  rack: number;
  slot: number;
  instanceName?: string;
  timeoutMs?: number;
}

export class GatewayError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class GatewayClient {
  constructor(private baseUrl: string, private timeoutMs = 2500) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setProvider(config: { gatewayUrl: string; timeoutMs: number }): void {
    this.baseUrl = config.gatewayUrl;
    this.timeoutMs = config.timeoutMs;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new GatewayError(payload?.error || `${response.status} ${response.statusText}`, response.status);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GatewayError('O gateway local não respondeu (timeout). Está a correr `npm run gateway`?');
      }
      throw new GatewayError(
        `Não foi possível contactar o gateway local em ${this.baseUrl}. Verifique se o serviço está a correr.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  health() {
    return this.request<{ ok: boolean; service: string; providers: string[] }>('/health');
  }

  connect(payload: GatewayConnectRequest) {
    return this.request<{ ok: boolean; info: Record<string, unknown> }>('/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  disconnect() {
    return this.request<{ ok: boolean }>('/disconnect', { method: 'POST', body: '{}' });
  }

  discover(provider: string) {
    return this.request<{ items: GatewayDiscoveryItem[] }>(`/discover?provider=${encodeURIComponent(provider)}`);
  }

  read(provider: string, definitions: PLCVariableDefinition[]) {
    const items: GatewayReadRequest[] = definitions.map((definition) => ({
      address: definition.address,
      dataType: definition.dataType,
    }));
    return this.request<{ items: GatewayReadItem[]; latencyMs?: number }>('/read', {
      method: 'POST',
      body: JSON.stringify({ provider, items }),
    });
  }

  write(provider: string, definition: PLCVariableDefinition, value: PLCValue) {
    return this.request<{ ok: boolean }>('/write', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        address: definition.address,
        dataType: definition.dataType,
        value,
      }),
    });
  }

  cpu(provider: string, action: 'run' | 'stop') {
    return this.request<{ ok: boolean; mode: string }>(`/cpu/${action}`, {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  status(provider: string) {
    return this.request<{
      ok: boolean;
      mode: string;
      message?: string;
      cycleTimeMs?: number | null;
      meta?: Record<string, unknown>;
    }>(`/status?provider=${encodeURIComponent(provider)}`);
  }
}

export const gatewayClient = new GatewayClient('http://127.0.0.1:8766/plc-api');
