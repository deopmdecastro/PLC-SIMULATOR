/**
 * Variable Monitor — INPUTS / OUTPUTS / MEMORY / DB / ANALOG.
 *
 * Cada linha mostra endereço, símbolo, tipo, valor e estado. As variáveis
 * graváveis (entradas, memórias) podem ser comandadas diretamente na tabela,
 * o que fecha o ciclo bidirecional PLC ↔ simulador.
 */

import { useMemo, useState } from 'react';
import type { PLCQuality, PLCVariableCategory, PLCVariableDefinition, PLCVariableValue } from '@/plc';
import { formatValue } from '@/plc';

export interface VariableTableProps {
  variables: PLCVariableDefinition[];
  values: Record<string, PLCVariableValue>;
  onToggle: (definition: PLCVariableDefinition) => void;
  onWriteAnalog: (definition: PLCVariableDefinition, value: number) => void;
  onFocusAddress: (address: string) => void;
}

const TABS: { id: PLCVariableCategory; label: string }[] = [
  { id: 'INPUTS', label: 'INPUTS' },
  { id: 'OUTPUTS', label: 'OUTPUTS' },
  { id: 'MEMORY', label: 'MEMORY' },
  { id: 'DB', label: 'DB' },
  { id: 'ANALOG', label: 'ANALOG' },
];

export function VariablePanels({ variables, values, onToggle, onWriteAnalog, onFocusAddress }: VariableTableProps) {
  const [active, setActive] = useState<PLCVariableCategory>('INPUTS');
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const term = filter.trim().toUpperCase();
    return variables
      .filter((variable) => variable.category === active)
      .filter(
        (variable) =>
          !term ||
          variable.address.toUpperCase().includes(term) ||
          variable.name.toUpperCase().includes(term),
      );
  }, [active, filter, variables]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Variable Monitor</h3>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar endereço ou símbolo…"
            className="w-48 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-700 px-3 py-2">
        {TABS.map((tab) => {
          const count = variables.filter((variable) => variable.category === tab.id).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wide transition ${
                active === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'border border-slate-600 text-slate-400 hover:border-cyan-600 hover:text-cyan-300'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-[11px]">
          <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Endereço</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Comentário</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((variable) => {
              const sample = values[variable.id];
              const quality: PLCQuality = sample?.quality ?? 'unknown';
              const boolValue = typeof sample?.value === 'boolean' ? sample.value : null;
              const numeric = typeof sample?.value === 'number' ? sample.value : null;
              return (
                <tr key={variable.id} className="border-b border-slate-700/60 hover:bg-slate-900/40">
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => onFocusAddress(variable.address)}
                      className="font-mono font-semibold text-cyan-300 hover:underline"
                    >
                      {variable.address}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-slate-200">{variable.name}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-400">{variable.dataType}</td>
                  <td className="px-3 py-1.5 font-mono text-white">
                    {quality === 'good' ? formatValue(sample?.value ?? null, variable.dataType, variable.unit) : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <QualityBadge quality={quality} active={boolValue === true} />
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-1.5 text-slate-500">{variable.comment || ''}</td>
                  <td className="px-3 py-1.5 text-right">
                    {variable.writable && variable.dataType === 'BOOL' && (
                      <button
                        type="button"
                        onClick={() => onToggle(variable)}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                          boolValue ? 'bg-emerald-600 text-white' : 'border border-slate-600 text-slate-300 hover:border-emerald-500'
                        }`}
                      >
                        {boolValue ? 'TRUE → 0' : 'FALSE → 1'}
                      </button>
                    )}
                    {variable.writable && variable.dataType !== 'BOOL' && (
                      <input
                        type="number"
                        value={numeric ?? 0}
                        min={variable.min ?? 0}
                        max={variable.max ?? 27648}
                        onChange={(event) => onWriteAnalog(variable, Number(event.target.value))}
                        className="w-24 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-cyan-500"
                      />
                    )}
                    {!variable.writable && <span className="text-[10px] text-slate-600">só leitura</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[11px] text-slate-500">
                  Sem variáveis nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QualityBadge({ quality, active }: { quality: PLCQuality; active: boolean }) {
  const map: Record<PLCQuality, { label: string; className: string }> = {
    good: {
      label: active ? 'ON' : 'OFF',
      className: active ? 'border-emerald-700 bg-emerald-900/40 text-emerald-400' : 'border-slate-600 bg-slate-900 text-slate-400',
    },
    bad: { label: 'BAD', className: 'border-red-700 bg-red-900/40 text-red-400' },
    unknown: { label: '—', className: 'border-slate-600 bg-slate-900 text-slate-500' },
    forced: { label: 'FORCED', className: 'border-amber-700 bg-amber-900/40 text-amber-400' },
  };
  const entry = map[quality];
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${entry.className}`}>{entry.label}</span>
  );
}
