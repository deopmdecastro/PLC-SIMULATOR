/**
 * Registry de providers — a única zona do código que conhece implementações
 * concretas. Adicionar um protocolo novo é adicionar uma entrada aqui.
 */

import type { PLCProvider, PLCProviderConfig, PLCProviderFactory } from '../types';
import { MockProvider } from './mockProvider';
import { S7Provider } from './s7Provider';
import { PLCSimAdvancedProvider } from './plcsimAdvancedProvider';

export interface PLCProviderDescriptor {
  id: string;
  label: string;
  description: string;
  platform: 'any' | 'windows';
  requiresGateway: boolean;
  factory: PLCProviderFactory;
}

export const PLC_PROVIDERS: PLCProviderDescriptor[] = [
  {
    id: 'mock',
    label: 'Mock PLC (offline/demo)',
    description:
      'PLC simulado em software. Executa o programa OB1 demo — sem TIA Portal. Todas as funcionalidades da interface funcionam.',
    platform: 'any',
    requiresGateway: false,
    factory: (config: PLCProviderConfig) => new MockProvider(config),
  },
  {
    id: 's7',
    label: 'S7 (protocolo S7 / PUT-GET)',
    description:
      'S7comm via ISO-on-TCP com CPU real, PLCSIM clássico + NetToPLCsim ou PLCSIM Advanced em TCP/IP. Requer PUT/GET ativado.',
    platform: 'any',
    requiresGateway: true,
    factory: (config: PLCProviderConfig) => new S7Provider(config),
  },
  {
    id: 'plcsim-advanced',
    label: 'PLCSIM Advanced (API .NET)',
    description:
      'API .NET oficial do S7-PLCSIM Advanced. Windows apenas, S7-1500/ET 200SP. Melhor latência e acesso a estado da instância.',
    platform: 'windows',
    requiresGateway: true,
    factory: (config: PLCProviderConfig) => new PLCSimAdvancedProvider(config),
  },
];

export function getProviderDescriptor(id: string): PLCProviderDescriptor {
  return PLC_PROVIDERS.find((provider) => provider.id === id) ?? PLC_PROVIDERS[0];
}

export function createProvider(config: PLCProviderConfig): PLCProvider {
  return getProviderDescriptor(config.providerId).factory(config);
}

export { MockProvider, MockPLC, STEP_LABELS } from './mockProvider';
export { S7Provider } from './s7Provider';
export { PLCSimAdvancedProvider, PLCSIM_ADVANCED_REQUIREMENTS } from './plcsimAdvancedProvider';
export { GatewayClient, GatewayError } from './gatewayClient';
