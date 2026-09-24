/**
 * TIMERS · COUNTERS · SEQUENCE (STEPS)
 *
 * Os temporizadores apresentam preset e valor corrente com barra de progresso.
 * Os contadores apresentam preset, valor atual e barra de proporção.
 * A sequência destaca a etapa ativa e permite remapear a variável das etapas.
 */

import { ChevronRight, Clock, Hash, ListOrdered, Plus, Trash2 } from 'lucide-react';
import type { PLCVariableDefinition, PLCVariableValue } from '@/plc';
import type { SimulationProject } from '@/simulation/scene';

interface ProcessPanelsProps {
  project: SimulationProject;
  variables: PLCVariableDefinition[];
  values: Record<string, PLCVariableValue>;
  activeStep: number | null;
  onSetStepsVariable: (address: string) => void;
  onUpdateStepLabel: (step: number, label: string) => void;
  onAddStep: () => void;
  onRemoveStep: (step: number) => void;
}

function sample(values: Record<string, PLCVariableValue>, variable?: PLCVariableDefinition) {
  return variable ? values[variable.id] : undefined;
}

function numberValue(values: Record<string, PLCVariableValue>, variable?: PLCVariableDefinition, fallback = 0) {
  const value = sample(values, variable)?.value;
  return typeof value === 'number' ? value : fallback;
}

function boolValue(values: Record<string, PLCVariableValue>, variable?: PLCVariableDefinition) {
  return sample(values, variable)?.value === true;
}

export function ProcessPanels({
  project,
  variables,
  values,
  activeStep,
  onSetStepsVariable,
  onUpdateStepLabel,
  onAddStep,
  onRemoveStep,
}: ProcessPanelsProps) {
  const timerIds = Array.from(
    new Set(
      variables
        .filter((variable) => variable.category === 'TIMERS')
        .map((variable) => variable.address.split('.')[0]),
    ),
  ).sort();

  const counterIds = Array.from(
    new Set(
      variables
        .filter((variable) => variable.category === 'COUNTERS')
        .map((variable) => variable.address.split('.')[0]),
    ),
  ).sort();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* TIMERS */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Timers</h3>
          <span className="ml-auto text-[10px] text-slate-500">{timerIds.length} temporizador(es)</span>
        </div>
        <div className="space-y-3">
          {timerIds.map((id) => {
            const done = variables.find((variable) => variable.address === id);
            const elapsed = variables.find((variable) => variable.address === `${id}.ET`);
            const preset = variables.find((variable) => variable.address === `${id}.PT`);
            const presetValue = numberValue(values, preset, 0) || 1;
            const current = numberValue(values, elapsed, 0);
            const percent = Math.max(0, Math.min(100, (current / presetValue) * 100));
            const isDone = boolValue(values, done);
            const running = current > 0 && !isDone;
            const status = !sample(values, done) || sample(values, done)?.quality !== 'good' ? 'SEM DADOS' : isDone ? 'DONE' : running ? 'RUN' : 'OFF';
            return (
              <div key={id} className="rounded border border-slate-700 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-300">{id}</span>
                  <span className="text-[10px] text-slate-400">{done?.comment || done?.name || 'Temporizador'}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      isDone
                        ? 'bg-emerald-900/60 text-emerald-400'
                        : running
                          ? 'bg-cyan-900/60 text-cyan-400'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>Preset: {(presetValue / 1000).toFixed(1)} s</span>
                  <span className={isDone ? 'text-emerald-400' : 'text-cyan-300'}>Atual: {(current / 1000).toFixed(1)} s</span>
                </div>
              </div>
            );
          })}
          {timerIds.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Nenhum temporizador definido. Adicione variáveis de temporizador (ex.: T1, T1.ET, T1.PT) na definição de variáveis.
            </p>
          )}
        </div>
      </section>

      {/* COUNTERS */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hash className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Counters</h3>
          <span className="ml-auto text-[10px] text-slate-500">{counterIds.length} contador(es)</span>
        </div>
        <div className="space-y-3">
          {counterIds.map((id) => {
            const done = variables.find((variable) => variable.address === id);
            const current = variables.find((variable) => variable.address === `${id}.PV`);
            const preset = variables.find((variable) => variable.address === `${id}.PRESET`);
            const presetValue = numberValue(values, preset, 0) || 1;
            const currentValue = numberValue(values, current, 0);
            const percent = Math.max(0, Math.min(100, (currentValue / presetValue) * 100));
            const isDone = boolValue(values, done);
            const hasData = sample(values, current)?.quality === 'good';
            return (
              <div key={id} className="rounded border border-slate-700 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-300">{id}</span>
                  <span className="text-[10px] text-slate-400">{done?.comment || done?.name || 'Contador'}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      !hasData ? 'bg-slate-800 text-slate-500' : isDone ? 'bg-emerald-900/60 text-emerald-400' : 'bg-cyan-900/60 text-cyan-400'
                    }`}
                  >
                    {!hasData ? 'SEM DADOS' : isDone ? 'DONE' : 'RUN'}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>Preset: {presetValue} {current?.unit || ''}</span>
                  <span className={isDone ? 'text-emerald-400' : 'text-cyan-300'}>Atual: {currentValue}</span>
                </div>
              </div>
            );
          })}
          {counterIds.length === 0 && (
            <p className="text-[11px] text-slate-500">Nenhum contador definido no projeto.</p>
          )}
        </div>
      </section>

      {/* SEQUENCE / STEPS */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4 xl:col-span-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ListOrdered className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Sequence / Steps</h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-[10px] uppercase text-slate-400">Variável da etapa</label>
            <select
              value={project.stepsVariableAddress}
              onChange={(event) => onSetStepsVariable(event.target.value)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 font-mono text-[10px] text-cyan-300 outline-none focus:border-cyan-500"
            >
              {variables.map((variable) => (
                <option key={variable.id} value={variable.address}>
                  {variable.address} · {variable.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAddStep}
              className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-600"
            >
              <Plus className="h-3 w-3" /> Etapa
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {project.steps.map((step) => {
            const isActive = activeStep === step.step;
            return (
              <div
                key={step.step}
                className={`flex items-center gap-3 rounded border p-2 transition ${
                  isActive
                    ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.15)]'
                    : 'border-slate-700 bg-slate-900/50'
                }`}
              >
                <span
                  className={`w-16 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold ${
                    isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  STEP {step.step}
                </span>
                <ChevronRight className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-600'}`} />
                <input
                  value={step.label}
                  onChange={(event) => onUpdateStepLabel(step.step, event.target.value)}
                  className={`flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold outline-none focus:border-slate-600 ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}
                />
                <span className="hidden max-w-[280px] truncate text-[10px] text-slate-500 md:block">{step.description}</span>
                {isActive && <span className="lab-blink h-2 w-2 rounded-full bg-cyan-400" />}
                <button
                  type="button"
                  onClick={() => onRemoveStep(step.step)}
                  className="rounded p-1 text-slate-500 transition hover:text-red-400"
                  aria-label={`Remover etapa ${step.step}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {project.steps.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Sem etapas definidas. O programa PLC está a ser executado mas a sequência não está mapeada — use «Etapa» para criar entradas.
            </p>
          )}
        </div>

        <p className="mt-3 rounded border border-slate-700 bg-slate-900/50 p-2 text-[10px] text-slate-400">
          A etapa ativa é lida da variável <span className="font-mono text-cyan-300">{project.stepsVariableAddress}</span>.
          Se o programa PLC usar outra variável (MW, DW de um DB ou um contador de passo GRAFCET), altere aqui — é um mapeamento configurável.
        </p>
      </section>
    </div>
  );
}
