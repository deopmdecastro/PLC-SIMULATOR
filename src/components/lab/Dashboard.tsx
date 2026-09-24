/**
 * Dashboard de operação — estado da CPU, comunicação, contagens de I/O,
 * temporizadores, contadores e avarias.
 *
 * Todos os valores vêm do último varrimento real. Sem ligação, mostra
 * "PLC DESCONECTADO" em vez de números.
 */

import { Activity, AlertTriangle, Cpu, Gauge, Timer, TrendingUp } from 'lucide-react';
import type { PLCDiagnosticEvent, PLCVariableDefinition, PLCVariableValue } from '@/plc';
import { formatValue } from '@/plc';
import type { SimulationProject } from '@/simulation/scene';

interface DashboardProps {
  info: import('@/plc').PLCConnectionInfo;
  values: Record<string, PLCVariableValue>;
  variables: PLCVariableDefinition[];
  project: SimulationProject;
  diagnostics: PLCDiagnosticEvent[];
  onSetCpuMode: (action: 'run' | 'stop') => void;
  onConnect: () => void;
  onDiscover: () => void;
  busy: boolean;
}

function countActive(variables: PLCVariableDefinition[], values: Record<string, PLCVariableValue>, category: string) {
  const relevant = variables.filter((variable) => variable.category === category && variable.dataType === 'BOOL');
  const active = relevant.filter((variable) => values[variable.id]?.value === true).length;
  return { active, total: relevant.length };
}

export function Dashboard({
  info,
  values,
  variables,
  project,
  diagnostics,
  onSetCpuMode,
  onConnect,
  onDiscover,
  busy,
}: DashboardProps) {
  const inputs = countActive(variables, values, 'INPUTS');
  const outputs = countActive(variables, values, 'OUTPUTS');
  const memory = countActive(variables, values, 'MEMORY');
  const analog = variables.filter((variable) => variable.category === 'ANALOG');
  const timers = variables.filter((variable) => variable.category === 'TIMERS' && variable.dataType === 'BOOL');
  const counters = variables.filter((variable) => variable.category === 'COUNTERS' && variable.dataType === 'BOOL');
  const activeTimers = timers.filter((variable) => values[variable.id]?.value === true).length;
  const activeCounters = counters.filter((variable) => values[variable.id]?.value === true).length;
  const faults = variables.filter(
    (variable) => (variable.address === 'M0.1' || variable.name.includes('FAULT')) && values[variable.id]?.value === true,
  ).length;
  const errors = diagnostics.filter((event) => event.level === 'error').length;
  const connected = info.status === 'connected';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Estado PLC */}
        <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">PLC Status</h3>
            <span
              className={`ml-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                connected
                  ? 'border-emerald-700 bg-emerald-900/50 text-emerald-400'
                  : info.status === 'connecting' || info.status === 'discovering'
                    ? 'border-amber-700 bg-amber-900/50 text-amber-400'
                    : 'border-red-700 bg-red-900/50 text-red-400'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`} />
              {connected ? 'CONNECTED' : info.status.toUpperCase()}
            </span>
          </div>

          <dl className="space-y-1.5 text-xs">
            <Row label="Provider" value={info.providerLabel} />
            <Row label="PLC" value={info.plcName} />
            <Row label="CPU" value={info.cpu} />
            <Row label="IP" value={info.ip || '—'} mono />
            <Row label="Rack / Slot" value={`${info.rack} / ${info.slot}`} mono />
            <Row
              label="Mode"
              value={info.mode}
              tone={info.mode === 'RUN' ? 'good' : info.mode === 'STOP' ? 'warn' : 'muted'}
            />
            <Row label="Cycle time" value={info.cycleTimeMs ? `${info.cycleTimeMs.toFixed(1)} ms` : '—'} mono />
            <Row
              label="Communication"
              value={info.latencyMs !== null ? `${info.latencyMs.toFixed(1)} ms` : '—'}
              mono
              tone={info.latencyMs !== null && info.latencyMs > 200 ? 'warn' : 'good'}
            />
            <Row
              label="Last update"
              value={info.lastUpdate ? new Date(info.lastUpdate).toLocaleTimeString() : '—'}
              mono
            />
          </dl>

          {!connected && (
            <div className="mt-3 space-y-2">
              <p className="rounded border border-amber-800/60 bg-amber-900/20 p-2 text-[10px] text-amber-200">
                {info.message || 'Sem ligação ao PLC. Nenhum valor é apresentado enquanto a comunicação não estiver estabelecida.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={busy}
                  className="flex-1 rounded bg-cyan-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
                >
                  [Retry connection]
                </button>
                <button
                  type="button"
                  onClick={onDiscover}
                  disabled={busy}
                  className="rounded border border-slate-600 px-2 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-600 disabled:opacity-40"
                >
                  Procurar PLCSIM
                </button>
              </div>
            </div>
          )}

          {connected && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onSetCpuMode('run')}
                disabled={busy || info.mode === 'RUN'}
                className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                RUN
              </button>
              <button
                type="button"
                onClick={() => onSetCpuMode('stop')}
                disabled={busy || info.mode === 'STOP'}
                className="flex-1 rounded bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                STOP
              </button>
            </div>
          )}
        </section>

        {/* Contadores de processo */}
        <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Contagens do processo</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Inputs" value={`${inputs.active} / ${inputs.total}`} hint="BOOLEAN ativas" tone="cyan" />
            <Tile label="Outputs" value={`${outputs.active} / ${outputs.total}`} hint="BOOLEAN ativas" tone="emerald" />
            <Tile label="Memory bits" value={`${memory.active} / ${memory.total}`} hint="Merker ativos" tone="amber" />
            <Tile label="Timers" value={`${activeTimers} / ${timers.length}`} hint="Q = TRUE" tone="cyan" />
            <Tile label="Counters" value={`${activeCounters} / ${counters.length}`} hint="Q = TRUE" tone="emerald" />
            <Tile label="Alarms" value={String(faults + errors)} hint="avarias + erros" tone={faults + errors > 0 ? 'red' : 'slate'} />
          </div>
        </section>

        {/* Comunicação / performance */}
        <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Comunicação</h3>
          </div>
          <dl className="space-y-1.5 text-xs">
            <Row label="Ciclo de varrimento" value={`${project.plc.scanIntervalMs} ms`} mono />
            <Row label="Variáveis mapeadas" value={`${variables.length}`} mono />
            <Row label="Leituras efetuadas" value={`${info.readCount}`} mono />
            <Row label="Escritas efetuadas" value={`${info.writeCount}`} mono />
            <Row label="Erros" value={`${info.errorCount}`} mono tone={info.errorCount > 0 ? 'warn' : 'good'} />
            <Row label="Reconexão automática" value={project.plc.autoReconnect ? 'ATIVA' : 'INATIVA'} />
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
              <div className="flex items-center gap-1 text-slate-400">
                <Timer className="h-3 w-3" /> Passos definidos
              </div>
              <div className="mt-1 font-mono text-sm text-white">{project.steps.length}</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
              <div className="flex items-center gap-1 text-slate-400">
                <TrendingUp className="h-3 w-3" /> Componentes
              </div>
              <div className="mt-1 font-mono text-sm text-white">{project.components.length}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Analógicas em destaque */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Valores analógicos</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {analog.map((variable) => {
            const sample = values[variable.id];
            const numeric = typeof sample?.value === 'number' ? sample.value : null;
            const max = variable.max ?? 27648;
            const percent = numeric === null ? 0 : Math.min(100, (numeric / max) * 100);
            return (
              <div key={variable.id} className="rounded border border-slate-700 bg-slate-900/60 p-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="truncate text-slate-300">{variable.name}</span>
                  <span className="font-mono text-cyan-300">
                    {sample?.quality === 'good' ? formatValue(sample.value, variable.dataType, variable.unit) : '—'}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-1 font-mono text-[9px] text-slate-500">{variable.address}</div>
              </div>
            );
          })}
          {analog.length === 0 && <p className="text-[10px] text-slate-500">Sem variáveis analógicas definidas.</p>}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone = 'default',
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'default' | 'good' | 'warn' | 'muted';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'muted' ? 'text-slate-500' : 'text-white';
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`truncate ${mono ? 'font-mono' : 'font-semibold'} ${toneClass}`}>{value}</dd>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const tones = {
    cyan: 'border-cyan-800/60 bg-cyan-900/20 text-cyan-300',
    emerald: 'border-emerald-800/60 bg-emerald-900/20 text-emerald-300',
    amber: 'border-amber-800/60 bg-amber-900/20 text-amber-300',
    red: 'border-red-800/60 bg-red-900/20 text-red-300',
    slate: 'border-slate-700 bg-slate-900/60 text-slate-300',
  };
  return (
    <div className={`rounded border p-2 ${tones[tone]}`}>
      <div className="text-[9px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
      <div className="text-[9px] opacity-70">{hint}</div>
    </div>
  );
}
