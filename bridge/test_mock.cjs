#!/usr/bin/env node
/**
 * Teste automático do Mock PLC.
 *
 * Exercita o programa OB1 demo e verifica que a sequência de 7 etapas responde
 * corretamente às entradas — o mesmo comportamento que a interface mostra.
 *
 * Executar:  npm run test:mock
 */

'use strict';

const { MockPLC, STEP_LABELS } = require('./mock_plc.cjs');

const plc = new MockPLC();

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function set(address, value) {
  plc.values.set(address, value);
}

/** Avança o tempo do simulador em passos de `totalMs`. */
function advance(totalMs, stepMs = 25) {
  const ticks = Math.max(1, Math.round(totalMs / stepMs));
  for (let index = 0; index < ticks; index += 1) {
    const original = plc.lastScan;
    plc.lastScan = original - stepMs;
    plc.scan();
  }
}

console.log('\n=== PLC-SIMULATOR · teste do Mock PLC ===\n');

console.log('1) Estado inicial');
check('CPU em RUN', plc.run === true);
for (const address of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7']) {
  check(`${address} desligada no arranque`, plc.getB(address) === false);
}

console.log('\n2) Inicialização → WAIT START (etapa 1)');
advance(1200);
check(`etapa = 1 (${STEP_LABELS[plc.getStep()]})`, plc.getStep() === 1, `etapa atual ${plc.getStep()}`);
check('GREEN_LAMP (Q0.3) acesa em WAIT START', plc.getB('Q0.3') === true);

console.log('\n3) Ciclo sem START não avança');
advance(500);
check('etapa continua em 1', plc.getStep() === 1, `etapa ${plc.getStep()}`);

console.log('\n4) START → extensão do cilindro (etapa 2)');
set('I0.0', true);
advance(100);
check(`etapa = 2 (${STEP_LABELS[plc.getStep()]})`, plc.getStep() === 2, `etapa ${plc.getStep()}`);
check('VALVE_1 (Q0.2) aberta', plc.getB('Q0.2') === true);
advance(1500);
check('cilindro estendido (DB1.DBD4 ≥ 99.5)', plc.getN('DB1.DBD4') >= 99.5, `posição ${plc.getN('DB1.DBD4')}`);
check('fim de curso (DB1.DBX8.0) TRUE', plc.getB('DB1.DBX8.0') === true);
check('M0.3 CYL_EXTENDED TRUE', plc.getB('M0.3') === true);

console.log('\n5) SENSOR_1 → MOTOR ON (etapa 4)');
set('I0.0', false);
set('I0.2', true);
set('I0.3', true);
advance(100);
check(`etapa = 4 (${STEP_LABELS[plc.getStep()]})`, plc.getStep() === 4, `etapa ${plc.getStep()}`);
check('MOTOR_1 (Q0.0) ligado', plc.getB('Q0.0') === true);
check('CONVEYOR (Q0.5) ligado', plc.getB('Q0.5') === true);
check('T1 a contar (ET > 0)', plc.getN('T1.ET') > 0, `ET ${plc.getN('T1.ET')}ms`);
check('contador de peças C1 registou a peça', plc.getN('C1.PV') >= 1, `C1.PV = ${plc.getN('C1.PV')}`);

console.log('\n6) Temporizador T1 → recolha do cilindro (etapa 5)');
advance(3400);
check(`etapa = 5 ou 6 (${STEP_LABELS[plc.getStep()]})`, plc.getStep() >= 5, `etapa ${plc.getStep()}`);
// Semântica TON: ao sair da etapa 4 o temporizador é reiniciado (ET = 0, Q = FALSE).
check('T1 reiniciado ao sair da etapa 4 (semântica TON)', plc.getN('T1.ET') === 0, `ET ${plc.getN('T1.ET')}ms`);
check('T1 Q = FALSE fora da etapa 4', plc.getB('T1') === false);
check('VALVE_1 fechada na recolha', plc.getB('Q0.2') === false);
check('MOTOR_1 desligado na recolha', plc.getB('Q0.0') === false);
advance(300);
check('cilindro a recolher (posição < 100)', plc.getN('DB1.DBD4') < 100, `posição ${plc.getN('DB1.DBD4')}`);

console.log('\n7) Fim do ciclo e contagem');
advance(2600);
check('contador de ciclos C2 incrementou', plc.getN('C2.PV') >= 1, `C2.PV = ${plc.getN('C2.PV')}`);
check('contagem espelhada em DB2.DBW2', plc.getN('DB2.DBW2') >= 1, `DB2.DBW2 = ${plc.getN('DB2.DBW2')}`);
check('etapa regressou a 1 ou 6', [1, 6].includes(plc.getStep()), `etapa ${plc.getStep()}`);

console.log('\n8) Paragem de emergência (E-STOP NF aberto)');
set('I0.4', false);
advance(200);
check('M0.1 FAULT TRUE', plc.getB('M0.1') === true);
check('RED_LAMP (Q0.6) ligada', plc.getB('Q0.6') === true);
check('BUZZER (Q0.4) ligado', plc.getB('Q0.4') === true);
check('TODAS as saídas de motor desligadas', plc.getB('Q0.0') === false && plc.getB('Q0.5') === false);

console.log('\n9) Reset da avaria');
set('I0.4', true);
set('I0.6', true);
advance(200);
check('M0.1 FAULT limpo', plc.getB('M0.1') === false);
set('I0.6', false);
advance(1500);
check('retomou WAIT START', plc.getStep() === 1, `etapa ${plc.getStep()}`);

console.log('\n10) CPU em STOP');
plc.run = false;
advance(200);
check(
  'todas as saídas caem em STOP',
  ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7'].every((address) => plc.getB(address) === false),
);
check('M0.2 CYCLE_ACTIVE FALSE', plc.getB('M0.2') === false);
plc.run = true;

console.log('\n11) Endereço inexistente não tem valor (não é inventado)');
check('I9.9 não existe no PLC mock', !plc.values.has('I9.9'));
check('DB1.DBD4 existe e é numérico', typeof plc.getN('DB1.DBD4') === 'number');
check('todos os endereços mapeados devolvem valor definido', ['I0.0', 'Q0.0', 'M0.1', 'MW100', 'DB1.DBD4'].every((address) => plc.values.has(address)));

console.log(`\n=== Resultado: ${passed} verificações passaram, ${failed} falharam ===\n`);
process.exit(failed === 0 ? 0 : 1);
