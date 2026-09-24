/**
 * Motor de simulação — tipos de cena e resolução de estado por componente.
 *
 * O componente 2D não guarda estado próprio: o seu aspeto é sempre derivado do
 * valor atual da variável PLC a que está associado (ou de uma variável de
 * posição, no caso dos cilindros e do conveyor).
 */

import type { PLCQuality, PLCValue, PLCVariableDefinition, PLCVariableValue } from '@/plc';
import { normalizeAddress } from '@/plc';

export interface SimulationComponent {
  id: string;
  /** Tipo do catálogo (motor, valve, push_button, ...). */
  type: string;
  name: string;
  x: number;
  y: number;
  /** Endereço PLC associado (ex.: Q0.0). Vazio = não mapeado. */
  address: string;
  /** Endereço de valor contínuo (posição 0-100, velocidade, nível). */
  analogAddress?: string;
  description?: string;
  /** Botões: momentâneo (push) ou comutador (toggle). */
  mode?: 'momentary' | 'toggle';
  /** Contactos: normalmente aberto / fechado. */
  normal?: 'open' | 'closed';
  /** Animação escolhida (ver catalog.animations). */
  animation?: string;
  /** Comprimento/tamanho relativo do elemento na cena. */
  length?: number;
  /** Dimensões de desenho (derivadas do catálogo). */
  size?: { w: number; h: number };
  /** Só para depuração: força o desenho de um estado. */
  scale?: number;
}

export interface StepDefinition {
  step: number;
  label: string;
  description?: string;
}

export interface SimulationSettings {
  showGrid: boolean;
  autostart: boolean;
  confirmWrites: boolean;
  highlightChanges: boolean;
}

export interface SimulationProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Configuração do provider usada por este projeto. */
  plc: import('@/plc').PLCProviderConfig;
  variables: PLCVariableDefinition[];
  components: SimulationComponent[];
  steps: StepDefinition[];
  /** Variável que contém o número da etapa ativa. */
  stepsVariableAddress: string;
  settings: SimulationSettings;
}

export interface ComponentRuntimeState {
  value: PLCValue | null;
  analogValue: PLCValue | null;
  quality: PLCQuality;
  /** Endereço lido (para mostrar na cena). */
  address: string;
  /** Estado lógico usado pelas animações. */
  active: boolean;
  /** Nome da animação efetivamente aplicada. */
  animation: string | null;
  /** Texto de estado curto (ON/OFF, OPEN/CLOSED, 45 %). */
  label: string;
  mapped: boolean;
}

export function findVariableByAddress(
  variables: PLCVariableDefinition[],
  address: string | undefined,
): PLCVariableDefinition | undefined {
  if (!address) return undefined;
  const key = normalizeAddress(address);
  return variables.find((variable) => normalizeAddress(variable.address) === key);
}

export function valueForAddress(
  values: Record<string, PLCVariableValue>,
  variables: PLCVariableDefinition[],
  address: string | undefined,
): PLCVariableValue | undefined {
  const variable = findVariableByAddress(variables, address);
  if (!variable) return undefined;
  return values[variable.id];
}

const BOOL_ANIMATIONS = new Set([
  'rotation', 'reverse_rotation', 'move', 'extend', 'open', 'close', 'glow',
  'signal', 'blink', 'heat', 'flow', 'spin', 'illuminate', 'sound',
]);

/**
 * Deriva o estado visual de um componente a partir dos valores lidos do PLC.
 * Sem valor disponível → `mapped: false` e nenhuma animação (não inventamos dados).
 */
export function resolveComponentState(
  component: SimulationComponent,
  values: Record<string, PLCVariableValue>,
  variables: PLCVariableDefinition[],
): ComponentRuntimeState {
  const definition = findVariableByAddress(variables, component.address);
  const sample = definition ? values[definition.id] : undefined;
  const analogSample = component.analogAddress
    ? valueForAddress(values, variables, component.analogAddress)
    : undefined;

  const value = sample?.value ?? null;
  const quality = sample?.quality ?? 'unknown';
  const active = typeof value === 'boolean' ? value : typeof value === 'number' ? value !== 0 : false;
  const animation = active ? component.animation ?? null : component.animation ? `idle:${component.animation}` : null;

  let label = '—';
  if (value === null) label = 'desconhecido';
  else if (typeof value === 'boolean') label = value ? 'ON' : 'OFF';
  else if (component.type === 'cylinder' || component.type === 'tank') label = `${Math.round(Number(value))} %`;
  else label = String(Math.round(Number(value) * 10) / 10);

  return {
    value,
    analogValue: analogSample?.value ?? null,
    quality,
    address: component.address,
    active,
    animation: quality === 'good' ? animation : null,
    label,
    mapped: Boolean(definition) && quality === 'good',
  };
}

/** Posição 0-100 de um cilindro/tanque (usa o endereço analógico quando existe). */
export function resolveAnalogPercent(
  component: SimulationComponent,
  values: Record<string, PLCVariableValue>,
  variables: PLCVariableDefinition[],
  fallback = 0,
): number {
  if (!component.analogAddress) return fallback;
  const sample = valueForAddress(values, variables, component.analogAddress);
  if (!sample || typeof sample.value !== 'number' || sample.quality !== 'good') return fallback;
  return Math.max(0, Math.min(100, sample.value));
}

export function isAnimationActive(state: ComponentRuntimeState, animation: string): boolean {
  return state.animation === animation;
}

export function componentSupportsAnimation(type: string, animation: string): boolean {
  return BOOL_ANIMATIONS.has(animation);
}

export function clampPosition(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
