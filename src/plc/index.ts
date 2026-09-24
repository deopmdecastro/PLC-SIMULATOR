/**
 * Ponto de entrada público da camada de comunicação PLC.
 * O resto da aplicação importa apenas daqui.
 */

export * from './types';
export * from './address';
export * from './diagnostics';
export { PLCConnectionManager } from './connectionManager';
export type { PLCSnapshot, PLCSnapshotListener } from './connectionManager';
export {
  PLC_PROVIDERS,
  createProvider,
  getProviderDescriptor,
  MockProvider,
  MockPLC,
  STEP_LABELS,
  S7Provider,
  PLCSimAdvancedProvider,
  PLCSIM_ADVANCED_REQUIREMENTS,
  GatewayClient,
  GatewayError,
} from './providers';
export type { PLCProviderDescriptor } from './providers';
