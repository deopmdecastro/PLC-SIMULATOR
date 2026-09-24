/**
 * Definições do projeto de simulação por omissão.
 *
 * O conjunto de variáveis espelha exatamente o programa OB1 demo executado pelo
 * Mock PLC (bridge/mock_plc.cjs e src/plc/providers/mockProvider.ts), de modo
 * que o utilizador veja dados reais desde o primeiro arranque.
 */

import type { PLCProviderConfig, PLCVariableDefinition } from '@/plc';
import { DEFAULT_PROVIDER_CONFIG } from '@/plc';
import type { SimulationComponent, SimulationProject, StepDefinition } from '@/simulation/scene';

function definition(
  address: string,
  name: string,
  dataType: PLCVariableDefinition['dataType'],
  category: PLCVariableDefinition['category'],
  writable: boolean,
  extra: Partial<PLCVariableDefinition> = {},
): PLCVariableDefinition {
  return {
    id: address.replace(/[^A-Za-z0-9]/g, '_'),
    address,
    name,
    dataType,
    category,
    writable,
    ...extra,
  };
}

/** Tabela de variáveis do projeto demo (equivalente ao OB1 demo). */
export const DEFAULT_VARIABLES: PLCVariableDefinition[] = [
  /* ------------------------------- INPUTS ------------------------------- */
  definition('I0.0', 'START', 'BOOL', 'INPUTS', true, { comment: 'Botão de arranque do ciclo' }),
  definition('I0.1', 'STOP_NF', 'BOOL', 'INPUTS', true, { comment: 'Paragem, contacto NF (TRUE = OK)' }),
  definition('I0.2', 'SENSOR_1', 'BOOL', 'INPUTS', true, { comment: 'Sensor de peça na entrada' }),
  definition('I0.3', 'SENSOR_2', 'BOOL', 'INPUTS', true, { comment: 'Sensor de fim de tapete' }),
  definition('I0.4', 'E_STOP_NF', 'BOOL', 'INPUTS', true, { comment: 'Cogumelo de emergência NF' }),
  definition('I0.5', 'AUTO_SEL', 'BOOL', 'INPUTS', true, { comment: 'Seletor AUTO/MANUAL' }),
  definition('I0.6', 'RESET', 'BOOL', 'INPUTS', true, { comment: 'Reset de avaria' }),
  definition('I0.7', 'SPARE_IN', 'BOOL', 'INPUTS', true, { comment: 'Entrada livre' }),

  /* ------------------------------- ANALOG ------------------------------- */
  definition('IW64', 'POT_1', 'INT', 'ANALOG', true, { min: 0, max: 27648, comment: 'Potenciômetro 0…27648' }),
  definition('IW66', 'TEMP_SENSOR', 'INT', 'ANALOG', true, { min: 0, max: 27648, comment: 'Sensor analógico' }),

  /* ------------------------------- OUTPUTS ------------------------------ */
  definition('Q0.0', 'MOTOR_1', 'BOOL', 'OUTPUTS', false, { comment: 'Motor do tapete' }),
  definition('Q0.1', 'MOTOR_2', 'BOOL', 'OUTPUTS', false, { comment: 'Motor reverso' }),
  definition('Q0.2', 'VALVE_1', 'BOOL', 'OUTPUTS', false, { comment: 'Eletroválvula de avanço do cilindro' }),
  definition('Q0.3', 'GREEN_LAMP', 'BOOL', 'OUTPUTS', false, { comment: 'Sinalização verde (pronto)' }),
  definition('Q0.4', 'BUZZER', 'BOOL', 'OUTPUTS', false, { comment: 'Aviso acústico' }),
  definition('Q0.5', 'CONVEYOR', 'BOOL', 'OUTPUTS', false, { comment: 'Comando do transportador' }),
  definition('Q0.6', 'RED_LAMP', 'BOOL', 'OUTPUTS', false, { comment: 'Sinalização vermelha (avaria/paragem)' }),
  definition('Q0.7', 'FAN', 'BOOL', 'OUTPUTS', false, { comment: 'Ventilação' }),
  definition('QW80', 'AO_SPEED', 'INT', 'ANALOG', false, { min: 0, max: 27648, comment: 'Saída analógica de velocidade' }),

  /* ------------------------------- MEMORY ------------------------------- */
  definition('M0.0', 'AUTO_MODE', 'BOOL', 'MEMORY', false, { comment: 'Modo automático ativo' }),
  definition('M0.1', 'FAULT', 'BOOL', 'MEMORY', false, { comment: 'Avaria genérica' }),
  definition('M0.2', 'CYCLE_ACTIVE', 'BOOL', 'MEMORY', false, { comment: 'Ciclo em curso' }),
  definition('M0.3', 'CYL_EXTENDED', 'BOOL', 'MEMORY', false, { comment: 'Cilindro estendido' }),
  definition('M10.0', 'AT_TARGET', 'BOOL', 'MEMORY', false, { comment: 'Posição atingida' }),
  definition('MW102', 'STEP_MIRROR', 'INT', 'MEMORY', false, { comment: 'Cópia do número de etapa' }),
  definition('MD50', 'CONVEYOR_POS', 'DINT', 'MEMORY', false, { min: 0, max: 360, comment: 'Posição do tapete (0…360)' }),

  /* ---------------------------------- DB -------------------------------- */
  definition('DB1.DBX0.0', 'AUTO_ENABLE', 'BOOL', 'DB', false, { comment: 'DB1 · autorização de automático' }),
  definition('DB1.DBW2', 'SPEED_SETPOINT', 'INT', 'DB', false, { unit: 'rpm', comment: 'DB1 · consigna de velocidade' }),
  definition('DB1.DBD4', 'CYLINDER_POS', 'REAL', 'DB', false, { min: 0, max: 100, unit: '%', comment: 'DB1 · posição do cilindro' }),
  definition('DB1.DBW6', 'TEMP_SETPOINT', 'INT', 'DB', false, { comment: 'DB1 · consigna de temperatura' }),
  definition('DB1.DBX8.0', 'CYL_END', 'BOOL', 'DB', false, { comment: 'DB1 · fim de curso do cilindro' }),
  definition('DB1.DBD12', 'TANK_LEVEL', 'REAL', 'DB', false, { min: 0, max: 100, unit: '%', comment: 'DB1 · nível do depósito' }),
  definition('DB2.DBW0', 'PARTS_COUNT', 'INT', 'DB', false, { comment: 'DB2 · peças contadas' }),
  definition('DB2.DBW2', 'CYCLE_COUNT', 'INT', 'DB', false, { comment: 'DB2 · ciclos concluídos' }),
  definition('DB2.DBD4', 'POS_MIRROR', 'REAL', 'DB', false, { min: 0, max: 100, unit: '%', comment: 'DB2 · posição espelhada' }),

  /* ------------------------------- TIMERS ------------------------------- */
  definition('T1', 'T_MOTOR_DONE', 'BOOL', 'TIMERS', false, { comment: 'Q do temporizador do motor' }),
  definition('T1.ET', 'T_MOTOR_ELAPSED', 'DINT', 'TIMERS', false, { unit: 'ms' }),
  definition('T1.PT', 'T_MOTOR_PRESET', 'DINT', 'TIMERS', false, { unit: 'ms' }),
  definition('T2', 'T_CONVEYOR_DONE', 'BOOL', 'TIMERS', false),
  definition('T2.ET', 'T_CONVEYOR_ELAPSED', 'DINT', 'TIMERS', false, { unit: 'ms' }),
  definition('T2.PT', 'T_CONVEYOR_PRESET', 'DINT', 'TIMERS', false, { unit: 'ms' }),
  definition('T3', 'T_BUZZER_DONE', 'BOOL', 'TIMERS', false),
  definition('T3.ET', 'T_BUZZER_ELAPSED', 'DINT', 'TIMERS', false, { unit: 'ms' }),
  definition('T3.PT', 'T_BUZZER_PRESET', 'DINT', 'TIMERS', false, { unit: 'ms' }),

  /* ------------------------------ COUNTERS ------------------------------ */
  definition('C1', 'C_PARTS_DONE', 'BOOL', 'COUNTERS', false),
  definition('C1.PV', 'C_PARTS_VALUE', 'INT', 'COUNTERS', false, { unit: 'peças' }),
  definition('C1.PRESET', 'C_PARTS_PRESET', 'INT', 'COUNTERS', false, { unit: 'peças' }),
  definition('C2', 'C_CYCLES_DONE', 'BOOL', 'COUNTERS', false),
  definition('C2.PV', 'C_CYCLES_VALUE', 'INT', 'COUNTERS', false, { unit: 'ciclos' }),
  definition('C2.PRESET', 'C_CYCLES_PRESET', 'INT', 'COUNTERS', false, { unit: 'ciclos' }),

  /* -------------------------------- STEPS ------------------------------- */
  definition('MW100', 'STEP_INDEX', 'INT', 'STEPS', false, { min: 0, max: 6, comment: 'Etapa ativa do GRAFCET' }),
];

export const DEFAULT_STEPS: StepDefinition[] = [
  { step: 0, label: 'INITIALIZATION', description: 'Arranque e verificação de segurança' },
  { step: 1, label: 'WAIT START', description: 'Aguarda START ou modo automático' },
  { step: 2, label: 'CYLINDER EXTENSION', description: 'Válvula abre, cilindro avança' },
  { step: 3, label: 'WAIT SENSOR', description: 'Aguarda sensor de peça' },
  { step: 4, label: 'MOTOR ON', description: 'Motor do tapete ligado (T1)' },
  { step: 5, label: 'CYLINDER RETRACTION', description: 'Cilindro recolhe' },
  { step: 6, label: 'END CYCLE', description: 'Contagem e reposição' },
];

const c = (
  id: string,
  type: string,
  name: string,
  x: number,
  y: number,
  address: string,
  extra: Partial<SimulationComponent> = {},
): SimulationComponent => ({ id, type, name, x, y, address, ...extra });

/** Cena demo — reproduz um posto de montagem com tapete, cilindro e sinalização. */
export const DEFAULT_COMPONENTS: SimulationComponent[] = [
  c('cmp-start', 'push_button', 'START', 30, 30, 'I0.0', { mode: 'momentary', normal: 'open', animation: 'illuminate' }),
  c('cmp-estop', 'emergency_stop', 'E-STOP', 140, 30, 'I0.4', { mode: 'toggle', normal: 'closed', animation: 'signal' }),
  c('cmp-auto', 'selector_switch', 'AUTO', 250, 30, 'I0.5', { mode: 'toggle', animation: 'illuminate' }),
  c('cmp-reset', 'push_button', 'RESET', 30, 140, 'I0.6', { mode: 'momentary', animation: 'illuminate' }),
  c('cmp-pot', 'potentiometer', 'SPEED POT', 140, 140, 'IW64', { animation: 'dial' }),

  c('cmp-sensor1', 'photoelectric_sensor', 'SENSOR_1', 30, 268, 'I0.2', { animation: 'signal' }),
  c('cmp-conveyor', 'conveyor', 'CONVEYOR 1', 150, 250, 'Q0.5', { analogAddress: 'MD50', animation: 'move' }),
  c('cmp-sensor2', 'limit_switch', 'SENSOR_2', 445, 268, 'I0.3', { animation: 'signal' }),
  c('cmp-motor', 'motor', 'MOTOR_1', 150, 370, 'Q0.0', { animation: 'rotation' }),
  c('cmp-motor2', 'motor', 'MOTOR_2', 285, 370, 'Q0.1', { animation: 'reverse_rotation' }),
  c('cmp-fan', 'fan', 'FAN', 420, 370, 'Q0.7', { animation: 'spin' }),

  c('cmp-valve', 'valve', 'VALVE_1', 560, 30, 'Q0.2', { animation: 'open' }),
  c('cmp-cylinder', 'cylinder', 'CYLINDER 1', 560, 150, 'Q0.2', { analogAddress: 'DB1.DBD4', animation: 'extend' }),
  c('cmp-lamp-green', 'lamp', 'GREEN', 720, 30, 'Q0.3', { animation: 'glow' }),
  c('cmp-lamp-red', 'signal_light', 'RED', 720, 140, 'Q0.6', { animation: 'blink' }),
  c('cmp-buzzer', 'buzzer', 'BUZZER', 720, 280, 'Q0.4', { animation: 'sound' }),
];

export const DEFAULT_PLC_CONFIG: PLCProviderConfig = { ...DEFAULT_PROVIDER_CONFIG };

export function createDefaultProject(name = 'My Factory'): SimulationProject {
  const now = new Date().toISOString();
  return {
    id: `project-${Date.now()}`,
    name,
    description: 'Posto de montagem demo — tapete, cilindro, motor e sinalização',
    createdAt: now,
    updatedAt: now,
    plc: { ...DEFAULT_PLC_CONFIG },
    variables: DEFAULT_VARIABLES.map((variable) => ({ ...variable })),
    components: DEFAULT_COMPONENTS.map((component) => ({ ...component })),
    steps: DEFAULT_STEPS.map((step) => ({ ...step })),
    stepsVariableAddress: 'MW100',
    settings: {
      showGrid: true,
      autostart: false,
      confirmWrites: false,
      highlightChanges: true,
    },
  };
}

/** Exemplo de mapeamento exportável (ponto 21 do caderno de encargos). */
export function projectToMappingJson(project: SimulationProject) {
  return {
    project: project.name,
    exportedAt: new Date().toISOString(),
    plc: project.plc,
    mappings: project.components.map((component) => ({
      component: component.id,
      name: component.name,
      type: component.type,
      plc_address: component.address,
      analog_address: component.analogAddress,
      mode: component.mode,
      animation: component.animation,
    })),
    stepsVariable: project.stepsVariableAddress,
  };
}
