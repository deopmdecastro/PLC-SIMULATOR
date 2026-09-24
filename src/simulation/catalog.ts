/**
 * Biblioteca de componentes do editor de simulação 2D.
 *
 * Cada entrada descreve: em que grupo aparece na paleta, se é uma entrada
 * (escrevemos para o PLC) ou uma saída (o PLC comanda), o tipo de dados, o
 * endereço sugerido e as animações disponíveis.
 */

import type { PLCDataType } from '@/plc';

export type ComponentCategory = 'INPUTS' | 'OUTPUTS' | 'PROCESS';
export type ComponentDirection = 'input' | 'output';

export interface ComponentPropertySchema {
  key: 'address' | 'analogAddress' | 'mode' | 'normal' | 'animation' | 'length';
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  hint?: string;
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  direction: ComponentDirection;
  icon: string;
  defaultDataType: PLCDataType;
  defaultWritable: boolean;
  defaultAddress: string;
  defaultAnalogAddress?: string;
  size: { w: number; h: number };
  animations: string[];
  defaultAnimation: string;
  properties: ComponentPropertySchema[];
  description: string;
}

const IO_PROPS: ComponentPropertySchema[] = [
  { key: 'address', label: 'Endereço PLC', type: 'text', hint: 'ex.: I0.0 · Q0.0 · M0.0 · DB1.DBX0.0' },
  { key: 'animation', label: 'Animação', type: 'select' },
];

const BUTTON_PROPS: ComponentPropertySchema[] = [
  ...IO_PROPS,
  { key: 'mode', label: 'Modo', type: 'select', options: ['momentary', 'toggle'] },
  { key: 'normal', label: 'Contacto', type: 'select', options: ['open', 'closed'] },
];

export const COMPONENT_CATALOG: ComponentDefinition[] = [
  /* ------------------------------- INPUTS ------------------------------- */
  {
    type: 'push_button',
    label: 'Push Button',
    category: 'INPUTS',
    direction: 'input',
    icon: 'CircleDot',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.0',
    size: { w: 92, h: 92 },
    animations: ['pulse', 'illuminate', 'none'],
    defaultAnimation: 'illuminate',
    properties: BUTTON_PROPS,
    description: 'Botão de impulso: escreve TRUE enquanto está pressionado.',
  },
  {
    type: 'selector_switch',
    label: 'Selector',
    category: 'INPUTS',
    direction: 'input',
    icon: 'ToggleLeft',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.5',
    size: { w: 100, h: 92 },
    animations: ['illuminate', 'none'],
    defaultAnimation: 'illuminate',
    properties: BUTTON_PROPS,
    description: 'Comutador de 2 posições (mantém o estado).',
  },
  {
    type: 'switch',
    label: 'Switch',
    category: 'INPUTS',
    direction: 'input',
    icon: 'ToggleRight',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.6',
    size: { w: 96, h: 92 },
    animations: ['illuminate', 'none'],
    defaultAnimation: 'illuminate',
    properties: BUTTON_PROPS,
    description: 'Interruptor simples ON/OFF.',
  },
  {
    type: 'emergency_stop',
    label: 'Emergency Stop',
    category: 'INPUTS',
    direction: 'input',
    icon: 'OctagonAlert',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.4',
    size: { w: 96, h: 96 },
    animations: ['signal', 'none'],
    defaultAnimation: 'signal',
    properties: BUTTON_PROPS,
    description: 'Cogumelo de emergência — normalmente fechado (TRUE = circuito OK).',
  },
  {
    type: 'sensor',
    label: 'Sensor',
    category: 'INPUTS',
    direction: 'input',
    icon: 'Radar',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.2',
    size: { w: 84, h: 84 },
    animations: ['signal', 'none'],
    defaultAnimation: 'signal',
    properties: IO_PROPS,
    description: 'Sensor genérico (deteção de peça / presença).',
  },
  {
    type: 'proximity_sensor',
    label: 'Proximity Sensor',
    category: 'INPUTS',
    direction: 'input',
    icon: 'Waypoints',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.2',
    size: { w: 84, h: 84 },
    animations: ['signal', 'none'],
    defaultAnimation: 'signal',
    properties: IO_PROPS,
    description: 'Sensor de proximidade indutivo.',
  },
  {
    type: 'limit_switch',
    label: 'Limit Switch',
    category: 'INPUTS',
    direction: 'input',
    icon: 'AlignEndHorizontal',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.3',
    size: { w: 84, h: 84 },
    animations: ['signal', 'none'],
    defaultAnimation: 'signal',
    properties: IO_PROPS,
    description: 'Fim de curso mecânico.',
  },
  {
    type: 'photoelectric_sensor',
    label: 'Photoelectric',
    category: 'INPUTS',
    direction: 'input',
    icon: 'ScanEye',
    defaultDataType: 'BOOL',
    defaultWritable: true,
    defaultAddress: 'I0.3',
    size: { w: 84, h: 84 },
    animations: ['signal', 'none'],
    defaultAnimation: 'signal',
    properties: IO_PROPS,
    description: 'Barreira fotoelétrica.',
  },
  {
    type: 'potentiometer',
    label: 'Potentiometer',
    category: 'INPUTS',
    direction: 'input',
    icon: 'SlidersHorizontal',
    defaultDataType: 'INT',
    defaultWritable: true,
    defaultAddress: 'IW64',
    size: { w: 110, h: 110 },
    animations: ['dial', 'none'],
    defaultAnimation: 'dial',
    properties: [
      { key: 'address', label: 'Endereço PLC', type: 'text', hint: 'ex.: IW64 (0…27648)' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Potenciômetro analógico — escreve 0…27648 na entrada analógica.',
  },
  {
    type: 'analog_sensor',
    label: 'Analog Sensor',
    category: 'INPUTS',
    direction: 'input',
    icon: 'Thermometer',
    defaultDataType: 'INT',
    defaultWritable: true,
    defaultAddress: 'IW66',
    size: { w: 110, h: 96 },
    animations: ['dial', 'none'],
    defaultAnimation: 'dial',
    properties: [
      { key: 'address', label: 'Endereço PLC', type: 'text', hint: 'ex.: IW66 (0…27648)' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Sensor analógico (temperatura, pressão, caudal).',
  },

  /* ------------------------------- OUTPUTS ------------------------------ */
  {
    type: 'motor',
    label: 'Motor',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'Fan',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.0',
    size: { w: 110, h: 110 },
    animations: ['rotation', 'reverse_rotation', 'none'],
    defaultAnimation: 'rotation',
    properties: IO_PROPS,
    description: 'Motor assíncrono — roda quando a saída está a 1.',
  },
  {
    type: 'contactor',
    label: 'Contactor',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'SquareStack',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.0',
    size: { w: 104, h: 92 },
    animations: ['illuminate', 'none'],
    defaultAnimation: 'illuminate',
    properties: IO_PROPS,
    description: 'Contator KM — bobina energizada.',
  },
  {
    type: 'relay',
    label: 'Relay',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'CircuitBoard',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.1',
    size: { w: 104, h: 92 },
    animations: ['illuminate', 'none'],
    defaultAnimation: 'illuminate',
    properties: IO_PROPS,
    description: 'Relé auxiliar.',
  },
  {
    type: 'lamp',
    label: 'Lamp',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'Lightbulb',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.3',
    size: { w: 88, h: 88 },
    animations: ['glow', 'blink', 'none'],
    defaultAnimation: 'glow',
    properties: IO_PROPS,
    description: 'Lâmpada de sinalização.',
  },
  {
    type: 'signal_light',
    label: 'Signal Light',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'TrafficCone',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.6',
    size: { w: 84, h: 120 },
    animations: ['glow', 'blink', 'none'],
    defaultAnimation: 'blink',
    properties: IO_PROPS,
    description: 'Coluna luminosa (verde/vermelho).',
  },
  {
    type: 'buzzer',
    label: 'Buzzer',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'BellRing',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.4',
    size: { w: 96, h: 88 },
    animations: ['sound', 'blink', 'none'],
    defaultAnimation: 'sound',
    properties: IO_PROPS,
    description: 'Sinalizador acústico.',
  },
  {
    type: 'siren',
    label: 'Siren',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'Volume2',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.4',
    size: { w: 96, h: 96 },
    animations: ['sound', 'blink', 'none'],
    defaultAnimation: 'sound',
    properties: IO_PROPS,
    description: 'Sirene de alarme.',
  },
  {
    type: 'valve',
    label: 'Valve',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'GitMerge',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.2',
    size: { w: 110, h: 96 },
    animations: ['open', 'close', 'none'],
    defaultAnimation: 'open',
    properties: IO_PROPS,
    description: 'Eletroválvula — abre com a saída a 1.',
  },
  {
    type: 'fan',
    label: 'Fan',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'Wind',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.7',
    size: { w: 104, h: 104 },
    animations: ['spin', 'rotation', 'none'],
    defaultAnimation: 'spin',
    properties: IO_PROPS,
    description: 'Ventilador de arrefecimento.',
  },
  {
    type: 'heater',
    label: 'Heater',
    category: 'OUTPUTS',
    direction: 'output',
    icon: 'Flame',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.7',
    size: { w: 100, h: 100 },
    animations: ['heat', 'glow', 'none'],
    defaultAnimation: 'heat',
    properties: IO_PROPS,
    description: 'Resistência de aquecimento.',
  },

  /* ------------------------------- PROCESS ------------------------------ */
  {
    type: 'conveyor',
    label: 'Conveyor',
    category: 'PROCESS',
    direction: 'output',
    icon: 'ArrowRightLeft',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.5',
    defaultAnalogAddress: 'MD50',
    size: { w: 260, h: 96 },
    animations: ['move', 'reverse_rotation', 'none'],
    defaultAnimation: 'move',
    properties: [
      { key: 'address', label: 'Endereço de comando', type: 'text', hint: 'ex.: Q0.5' },
      { key: 'analogAddress', label: 'Endereço de posição', type: 'text', hint: 'ex.: MD50 (0…100)' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Tapete transportador — as peças deslocam-se quando a saída está a 1.',
  },
  {
    type: 'cylinder',
    label: 'Cylinder',
    category: 'PROCESS',
    direction: 'output',
    icon: 'RectangleHorizontal',
    defaultDataType: 'BOOL',
    defaultWritable: false,
    defaultAddress: 'Q0.2',
    defaultAnalogAddress: 'DB1.DBD4',
    size: { w: 220, h: 96 },
    animations: ['extend', 'close', 'none'],
    defaultAnimation: 'extend',
    properties: [
      { key: 'address', label: 'Endereço da válvula', type: 'text', hint: 'ex.: Q0.2' },
      { key: 'analogAddress', label: 'Endereço de posição', type: 'text', hint: 'ex.: DB1.DBD4 (0…100)' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Cilindro pneumático — avança com a válvula e mostra a posição real.',
  },
  {
    type: 'tank',
    label: 'Tank',
    category: 'PROCESS',
    direction: 'output',
    icon: 'Database',
    defaultDataType: 'REAL',
    defaultWritable: false,
    defaultAddress: 'DB1.DBD12',
    defaultAnalogAddress: 'DB1.DBD4',
    size: { w: 130, h: 180 },
    animations: ['flow', 'none'],
    defaultAnimation: 'flow',
    properties: [
      { key: 'address', label: 'Endereço de nível', type: 'text', hint: 'ex.: DB1.DBD12 (0…100)' },
      { key: 'analogAddress', label: 'Endereço alternativo', type: 'text' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Tanque — barra de nível proporcional ao valor lido.',
  },
  {
    type: 'silo',
    label: 'Silo',
    category: 'PROCESS',
    direction: 'output',
    icon: 'Warehouse',
    defaultDataType: 'REAL',
    defaultWritable: false,
    defaultAddress: 'DB1.DBD12',
    defaultAnalogAddress: 'DB1.DBD4',
    size: { w: 130, h: 180 },
    animations: ['flow', 'none'],
    defaultAnimation: 'flow',
    properties: [
      { key: 'address', label: 'Endereço de nível', type: 'text', hint: 'ex.: DB1.DBD12 (0…100)' },
      { key: 'analogAddress', label: 'Endereço alternativo', type: 'text' },
      { key: 'animation', label: 'Animação', type: 'select' },
    ],
    description: 'Silo de armazenamento de granel.',
  },
];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  INPUTS: 'Entradas (escrevem no PLC)',
  OUTPUTS: 'Saídas (comandadas pelo PLC)',
  PROCESS: 'Processo (mecânica)',
};

export function findComponentDefinition(type: string): ComponentDefinition | undefined {
  return COMPONENT_CATALOG.find((definition) => definition.type === type);
}

export function componentsByCategory(category: ComponentCategory): ComponentDefinition[] {
  return COMPONENT_CATALOG.filter((definition) => definition.category === category);
}

export function animationOptions(type: string): string[] {
  return findComponentDefinition(type)?.animations ?? ['none'];
}

export function describeAnimations(): Record<string, string> {
  return {
    rotation: 'Rotação no sentido horário',
    reverse_rotation: 'Rotação no sentido anti-horário',
    move: 'Deslocamento linear (conveyor)',
    extend: 'Extensão linear (cilindro)',
    close: 'Recolha / fecho',
    open: 'Abertura',
    glow: 'Iluminação',
    blink: 'Intermitência',
    signal: 'Sinal ativo (LED)',
    sound: 'Indicação acústica (visual)',
    heat: 'Aquecimento (gradiente térmico)',
    flow: 'Fluxo / nível variável',
    spin: 'Rotação de ventoinha',
    dial: 'Ponteiro analógico',
    pulse: 'Impulso',
    illuminate: 'Indicador aceso',
    none: 'Sem animação',
  };
}
