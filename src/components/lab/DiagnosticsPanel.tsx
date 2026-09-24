/**
 * Diagnóstico de comunicação + configuração do provider + event log.
 *
 * Aqui o utilizador escolhe a rota de integração (Mock / S7 / PLCSIM Advanced),
 * define IP, rack, slot, nome da instância, intervalo de varrimento e vê os
 * resultados da descoberta automática e do histórico de eventos.
 */

import { useState } from 'react';
import { Activity, Cable, Eraser, Radar, Save, ShieldAlert, Terminal } from 'lucide-react';
import type {
  PLCDiagnosticEvent,
  PLCDiagnosticLevel,
  PLCDiscoveryResult,
  PLCProviderConfig,
} from '@/plc';
import { PLC_PROVIDERS } from '@/plc';
import type { SimulationProject } from '@/simulation/scene';

interface DiagnosticsPanelProps {
  project: SimulationProject;
  info: import('@/plc').PLCConnectionInfo;
  diagnostics: PLCDiagnosticEvent[];
  discovery: PLCDiscoveryResult[];
  lastError: string | null;
  busy: boolean;
  onUpdatePlcConfig: (patch: Partial<PLCProviderConfig>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDiscover: () => void;
  onClear: () => void;
}

const LEVEL_STYLE: Record<PLCDiagnosticLevel, { dot: string; text: string }> = {
  info: { dot: 'bg-slate-400', text: 'text-slate-300' },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-300' },
  error: { dot: 'bg-red-400', text: 'text-red-300' },
  value: { dot: 'bg-cyan-400', text: 'text-cyan-300' },
};

export function DiagnosticsPanel({
  project,
  info,
  diagnostics,
  discovery,
  lastError,
  busy,
  onUpdatePlcConfig,
  onConnect,
  onDisconnect,
  onDiscover,
  onClear,
}: DiagnosticsPanelProps) {
  const [draft, setDraft] = useState<{ ip: string; rack: string; slot: string; instance: string; scan: string }>({
    ip: project.plc.ip,
    rack: String(project.plc.rack),
    slot: String(project.plc.slot),
    instance: project.plc.instanceName,
    scan: String(project.plc.scanIntervalMs),
  });

  const descriptor = PLC_PROVIDERS.find((provider) => provider.id === project.plc.providerId) ?? PLC_PROVIDERS[0];

  const apply = () => {
    onUpdatePlcConfig({
      ip: draft.ip.trim(),
      rack: Number(draft.rack) || 0,
      slot: Number(draft.slot) || 1,
      instanceName: draft.instance.trim(),
      scanIntervalMs: Math.max(50, Number(draft.scan) || 250),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Configuração */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4 xl:col-span-5">
        <div className="mb-3 flex items-center gap-2">
          <Cable className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">PLC Connection</h3>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Rota de comunicação (provider)
          </span>
          <select
            value={project.plc.providerId}
            onChange={(event) => onUpdatePlcConfig({ providerId: event.target.value })}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-cyan-500"
          >
            {PLC_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-2 rounded border border-slate-700 bg-slate-900/60 p-2 text-[10px] leading-relaxed text-slate-400">
          {descriptor.description}
          {descriptor.platform === 'windows' && (
            <span className="mt-1 block font-semibold text-amber-300">
              Plataforma: Windows apenas (API .NET da Siemens).
            </span>
          )}
          {descriptor.requiresGateway && (
            <span className="mt-1 block font-mono text-[9px] text-slate-500">
              Requer o gateway local: npm run gateway
            </span>
          )}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input label="IP / host" value={draft.ip} onChange={(value) => setDraft({ ...draft, ip: value })} mono />
          <Input
            label="Instance name"
            value={draft.instance}
            onChange={(value) => setDraft({ ...draft, instance: value })}
            mono
            disabled={project.plc.providerId !== 'plcsim-advanced'}
          />
          <Input label="Rack" value={draft.rack} onChange={(value) => setDraft({ ...draft, rack: value })} mono />
          <Input label="Slot" value={draft.slot} onChange={(value) => setDraft({ ...draft, slot: value })} mono />
          <Input
            label="Scan interval (ms)"
            value={draft.scan}
            onChange={(value) => setDraft({ ...draft, scan: value })}
            mono
          />
          <Input
            label="Gateway URL"
            value={project.plc.gatewayUrl}
            onChange={(value) => onUpdatePlcConfig({ gatewayUrl: value })}
            mono
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={project.plc.autoReconnect}
            onChange={(event) => onUpdatePlcConfig({ autoReconnect: event.target.checked })}
            className="accent-cyan-500"
          />
          Reconexão automática (retry com backoff)
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={busy}
            className="flex items-center gap-1.5 rounded bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-600 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> Aplicar
          </button>
          <button
            type="button"
            onClick={onDiscover}
            disabled={busy}
            className="flex items-center gap-1.5 rounded bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
          >
            <Radar className="h-3.5 w-3.5" /> Procurar PLCSIM
          </button>
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            Ligar
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="rounded border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-red-500 hover:text-red-300 disabled:opacity-40"
          >
            Desligar
          </button>
        </div>

        {lastError && (
          <p className="mt-3 flex items-start gap-2 rounded border border-red-800/60 bg-red-900/20 p-2 text-[10px] text-red-200">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {lastError}
          </p>
        )}
      </section>

      {/* Estado / descoberta */}
      <section className="space-y-4 xl:col-span-7">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Communication diagnostics</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Status" value={info.status.toUpperCase()} tone={info.status === 'connected' ? 'good' : 'bad'} />
            <Stat label="Latência" value={info.latencyMs !== null ? `${info.latencyMs.toFixed(1)} ms` : '—'} />
            <Stat label="Ciclo CPU" value={info.cycleTimeMs ? `${info.cycleTimeMs.toFixed(1)} ms` : '—'} />
            <Stat label="Modo" value={info.mode} tone={info.mode === 'RUN' ? 'good' : 'warn'} />
            <Stat label="Leituras" value={String(info.readCount)} />
            <Stat label="Escritas" value={String(info.writeCount)} />
            <Stat label="Erros" value={String(info.errorCount)} tone={info.errorCount > 0 ? 'bad' : 'good'} />
            <Stat label="Descobertas" value={String(discovery.length)} />
          </div>
          {info.message && <p className="mt-2 font-mono text-[10px] text-slate-400">{info.message}</p>}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">PLC Discovery</h3>
          </div>
          {discovery.length === 0 ? (
            <p className="text-[10px] text-slate-500">
              Ainda não foi feita nenhuma procura. Use «Procurar PLCSIM» — o resultado é sempre o que o provider devolve, sem dados inventados.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {discovery.map((item) => (
                <li key={item.id} className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/50 p-2">
                  <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${item.reachable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-slate-200">
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono text-[10px] text-cyan-300">{item.address}</span>
                    </div>
                    {item.detail && <p className="text-[10px] text-slate-400">{item.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Event log */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4 xl:col-span-12">
        <div className="mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Event log</h3>
          <span className="text-[10px] text-slate-500">{diagnostics.length} evento(s)</span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-600"
          >
            <Eraser className="h-3 w-3" /> Limpar
          </button>
        </div>
        <div className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto">
          {diagnostics.length === 0 && <p className="text-[10px] text-slate-500">Sem eventos registados.</p>}
          {diagnostics.map((event) => {
            const style = LEVEL_STYLE[event.level];
            return (
              <div key={event.id} className="flex items-start gap-2 rounded bg-slate-900/50 px-2 py-1.5 text-[10px]">
                <span className="font-mono text-slate-500">{new Date(event.at).toLocaleTimeString()}</span>
                <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
                <span className="font-mono text-slate-400">[{event.source}]</span>
                <span className={`flex-1 ${style.text}`}>{event.message}</span>
                {event.detail && <span className="max-w-[40%] truncate text-slate-500">{event.detail}</span>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  mono,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-40 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-mono text-sm font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
