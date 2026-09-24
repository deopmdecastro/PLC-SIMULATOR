/**
 * Editor de simulação 2D — biblioteca de componentes, área de desenho e
 * painel de propriedades com o mapeamento para endereços PLC.
 *
 * Fluxo: arrastar da biblioteca → largar na área → selecionar → configurar
 * o endereço PLC → o componente passa a reagir ao PLC (ou a comandá-lo).
 */

import { useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Grid2X2, Layers, MousePointerClick, Save, Trash2, X } from 'lucide-react';
import type { PLCVariableDefinition, PLCVariableValue } from '@/plc';
import type { SimulationComponent, SimulationProject } from '@/simulation/scene';
import {
  CATEGORY_LABELS,
  componentsByCategory,
  describeAnimations,
  findComponentDefinition,
  type ComponentCategory,
} from '@/simulation/catalog';
import { iconForComponent } from '@/simulation/icons';
import { ComponentView } from './ComponentRenderer';

interface SimulationEditorProps {
  project: SimulationProject;
  values: Record<string, PLCVariableValue>;
  variables: PLCVariableDefinition[];
  onAddComponent: (component: SimulationComponent) => void;
  onUpdateComponent: (id: string, patch: Partial<SimulationComponent>) => void;
  onRemoveComponent: (id: string) => void;
  onWrite: (address: string, value: boolean | number) => void;
  onPulse: (address: string, active: boolean) => void;
  onSaveProject: () => void;
}

const CANVAS_WIDTH = 980;
const CANVAS_HEIGHT = 620;

export function SimulationEditor({
  project,
  values,
  variables,
  onAddComponent,
  onUpdateComponent,
  onRemoveComponent,
  onWrite,
  onPulse,
  onSaveProject,
}: SimulationEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<ComponentCategory>('INPUTS');
  const [query, setQuery] = useState('');
  const [dropHint, setDropHint] = useState(false);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => project.components.find((component) => component.id === selectedId) ?? null,
    [project.components, selectedId],
  );

  const palette = useMemo(() => {
    const term = query.trim().toLowerCase();
    return componentsByCategory(category).filter(
      (definition) => !term || definition.label.toLowerCase().includes(term) || definition.description.toLowerCase().includes(term),
    );
  }, [category, query]);

  const addFromPalette = (type: string, x: number, y: number) => {
    const definition = findComponentDefinition(type);
    if (!definition) return;
    const component: SimulationComponent = {
      id: `cmp-${type}-${Date.now().toString(36)}`,
      type,
      name: `${definition.label} ${project.components.filter((item) => item.type === type).length + 1}`,
      x,
      y,
      address: definition.defaultAddress,
      analogAddress: definition.defaultAnalogAddress,
      animation: definition.defaultAnimation,
      mode: definition.category === 'INPUTS' ? 'toggle' : undefined,
      normal: 'open',
      description: definition.description,
    };
    onAddComponent(component);
    setSelectedId(component.id);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropHint(false);
    const type = event.dataTransfer.getData('text/component-type');
    if (!type || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    addFromPalette(type, Math.max(0, event.clientX - rect.left - 40), Math.max(0, event.clientY - rect.top - 40));
  };

  const handleCanvasMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onUpdateComponent(drag.id, {
      x: Math.max(0, Math.min(CANVAS_WIDTH - 60, event.clientX - rect.left - drag.offsetX)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - 60, event.clientY - rect.top - drag.offsetY)),
    });
  };

  const componentRuntime = (component: SimulationComponent) => {
    const definition = variables.find((variable) => variable.address.toUpperCase() === component.address.toUpperCase());
    const sample = definition ? values[definition.id] : undefined;
    const value = sample?.value ?? null;
    const quality = sample?.quality ?? 'unknown';
    const active = typeof value === 'boolean' ? value : typeof value === 'number' ? value !== 0 : false;
    let label = '—';
    if (value === null) label = 'desconhecido';
    else if (typeof value === 'boolean') label = value ? 'ON' : 'OFF';
    else label = String(Math.round(Number(value)));
    return {
      value,
      analogValue: null,
      quality,
      address: component.address,
      active,
      animation: quality === 'good' ? component.animation ?? null : null,
      label,
      mapped: Boolean(definition) && quality === 'good',
    };
  };

  const definition = selected ? findComponentDefinition(selected.type) : undefined;
  const animationLabels = describeAnimations();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Biblioteca */}
      <aside className="rounded-lg border border-slate-700 bg-slate-800 p-3 xl:col-span-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Components</h3>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Procurar componente…"
          className="mb-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
        />
        <div className="mb-2 flex flex-wrap gap-1">
          {(Object.keys(CATEGORY_LABELS) as ComponentCategory[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`rounded px-2 py-1 text-[9px] font-bold tracking-wide transition ${
                category === key ? 'bg-cyan-600 text-white' : 'border border-slate-600 text-slate-400 hover:border-cyan-600'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {palette.map((item) => {
            const Icon = iconForComponent(item.icon);
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/component-type', item.type);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => addFromPalette(item.type, 40, 40)}
                title={`${item.description}\n(duplo clique adiciona ao canto; ou arraste para a área)`}
                className="flex cursor-grab flex-col items-center gap-1 rounded border border-slate-600 bg-slate-900/70 p-2 text-center transition hover:border-cyan-500 hover:bg-slate-900"
              >
                <Icon className="h-4 w-4 text-cyan-300" />
                <span className="text-[9px] font-semibold leading-tight text-slate-300">{item.label}</span>
                <span className="font-mono text-[8px] text-slate-500">{item.defaultAddress}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1 rounded border border-slate-700 bg-slate-900/50 p-2 text-[9px] text-slate-400">
          <MousePointerClick className="mt-0.5 h-3 w-3 flex-shrink-0 text-cyan-400" />
          Arraste para a área 2D (ou duplo clique). Clique para selecionar e configurar o endereço PLC.
        </p>
      </aside>

      {/* Área 2D */}
      <section className="xl:col-span-6">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Grid2X2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Simulation</h3>
            <span className="text-[10px] text-slate-500">
              {project.components.length} componente(s) · {project.components.filter((c) => c.address).length} mapeado(s)
            </span>
            <div className="ml-auto flex gap-2">
              <span className="rounded border border-slate-700 px-2 py-0.5 font-mono text-[9px] text-slate-400">
                {project.name}
              </span>
            </div>
          </div>

          <div
            ref={canvasRef}
            onDragOver={(event) => {
              event.preventDefault();
              setDropHint(true);
            }}
            onDragLeave={() => setDropHint(false)}
            onDrop={handleDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={() => {
              dragRef.current = null;
            }}
            onMouseLeave={() => {
              dragRef.current = null;
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
            className={`relative w-full overflow-hidden rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-900 to-slate-950 transition ${
              dropHint ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-700'
            }`}
            style={{ height: CANVAS_HEIGHT, cursor: dragRef.current ? 'grabbing' : 'default' }}
          >
            {project.settings.showGrid && (
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.25) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
            )}

            {project.components.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-600">
                <Layers className="h-8 w-8" />
                <p className="text-xs">Arraste componentes da biblioteca para aqui</p>
              </div>
            )}

            {project.components.map((component) => {
              const componentDefinition = findComponentDefinition(component.type);
              return (
                <div key={component.id} className="absolute" style={{ zIndex: selectedId === component.id ? 20 : 10 }}>
                  <ComponentView
                    component={{ ...component, size: componentDefinition?.size }}
                    state={componentRuntime(component)}
                    selected={selectedId === component.id}
                    interactive={componentDefinition?.direction === 'input'}
                    values={values}
                    variables={variables}
                    onSelect={(item) => setSelectedId(item.id)}
                    onDragStart={(item, event) => {
                      const target = event.currentTarget as HTMLElement;
                      const rect = target.getBoundingClientRect();
                      dragRef.current = { id: item.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
                    }}
                    onInteract={(item, active) => {
                      if (!item.address) return;
                      if (componentDefinition?.type === 'push_button' || componentDefinition?.type === 'emergency_stop') {
                        onPulse(item.address, active);
                      } else if (item.mode === 'momentary') {
                        onPulse(item.address, active);
                      } else {
                        onWrite(item.address, active);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[10px] text-slate-500">
            Os componentes laranja/“sem dados” não têm valor válido do PLC — verifique o endereço e a ligação.
          </p>
        </div>
      </section>

      {/* Propriedades */}
      <aside className="rounded-lg border border-slate-700 bg-slate-800 p-3 xl:col-span-3">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Component properties</h3>
          {selected && (
            <button
              type="button"
              onClick={() => {
                onRemoveComponent(selected.id);
                setSelectedId(null);
              }}
              className="ml-auto rounded p-1 text-slate-500 transition hover:text-red-400"
              aria-label="Remover componente"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!selected && (
          <p className="rounded border border-slate-700 bg-slate-900/50 p-3 text-[10px] text-slate-400">
            Selecione um componente na área de simulação para configurar nome, endereço PLC, modo, animação e descrição.
          </p>
        )}

        {selected && definition && (
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={selected.name}
                onChange={(event) => onUpdateComponent(selected.id, { name: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Type">
              <div className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
                {definition.label}
                <span className="ml-2 text-[9px] text-slate-500">
                  {definition.direction === 'input' ? 'escreve no PLC' : 'comandado pelo PLC'}
                </span>
              </div>
            </Field>

            <Field label="PLC Address" hint="ex.: I0.0 · Q0.2 · M0.0 · DB1.DBX0.0">
              <input
                value={selected.address}
                onChange={(event) => onUpdateComponent(selected.id, { address: event.target.value.toUpperCase() })}
                className={`${inputClass} font-mono`}
              />
            </Field>

            {(selected.type === 'conveyor' || selected.type === 'cylinder' || selected.type === 'tank' || selected.type === 'silo') && (
              <Field label="Analog / position address" hint="ex.: DB1.DBD4 · MD50 · DB1.DBD12">
                <input
                  value={selected.analogAddress || ''}
                  onChange={(event) => onUpdateComponent(selected.id, { analogAddress: event.target.value.toUpperCase() })}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            )}

            {definition.category === 'INPUTS' && (
              <>
                <Field label="Mode">
                  <select
                    value={selected.mode || 'momentary'}
                    onChange={(event) => onUpdateComponent(selected.id, { mode: event.target.value as 'momentary' | 'toggle' })}
                    className={inputClass}
                  >
                    <option value="momentary">Momentary (impulso)</option>
                    <option value="toggle">Toggle (mantém)</option>
                  </select>
                </Field>
                <Field label="Normally">
                  <select
                    value={selected.normal || 'open'}
                    onChange={(event) => onUpdateComponent(selected.id, { normal: event.target.value as 'open' | 'closed' })}
                    className={inputClass}
                  >
                    <option value="open">Open (NA)</option>
                    <option value="closed">Closed (NF)</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="Animation">
              <select
                value={selected.animation || definition.defaultAnimation}
                onChange={(event) => onUpdateComponent(selected.id, { animation: event.target.value })}
                className={inputClass}
              >
                {definition.animations.map((animation) => (
                  <option key={animation} value={animation}>
                    {animationLabels[animation] || animation}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description">
              <textarea
                value={selected.description || ''}
                onChange={(event) => onUpdateComponent(selected.id, { description: event.target.value })}
                rows={2}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={(event) => onUpdateComponent(selected.id, { x: Number(event.target.value) })}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Y">
                <input
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={(event) => onUpdateComponent(selected.id, { y: Number(event.target.value) })}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>

            <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Mapeamento</span>
                <span className={isValidPlcAddress(selected.address) ? 'text-emerald-400' : 'text-amber-400'}>
                  {isValidPlcAddress(selected.address) ? 'válido' : 'endereço não reconhecido'}
                </span>
              </div>
              <pre className="mt-1 overflow-x-auto text-[9px] text-slate-300">
{JSON.stringify(
  {
    component: selected.id,
    type: selected.type,
    plc_address: selected.address,
    ...(selected.analogAddress ? { analog_address: selected.analogAddress } : {}),
    ...(selected.mode ? { mode: selected.mode } : {}),
  },
  null,
  2,
)}
              </pre>
            </div>

            <button
              type="button"
              onClick={onSaveProject}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-cyan-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-cyan-500"
            >
              <Save className="h-3.5 w-3.5" /> Guardar projeto
            </button>
          </div>
        )}

        {selected && !definition && (
          <div className="flex items-center gap-2 rounded border border-amber-800/60 bg-amber-900/20 p-2 text-[10px] text-amber-200">
            <X className="h-3.5 w-3.5" /> Tipo «{selected.type}» não existe no catálogo.
          </div>
        )}
      </aside>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block font-mono text-[9px] text-slate-500">{hint}</span>}
    </label>
  );
}

/** Validação local rápida (a validação completa vive em src/plc/address.ts). */
function isValidPlcAddress(address: string): boolean {
  const value = address.trim().toUpperCase();
  return (
    /^[IQM]\d+\.[0-7]$/.test(value) ||
    /^[IQM][BWD]\d+$/.test(value) ||
    /^DB\d+\.DB[XBWD]\d+(\.\d+)?$/.test(value) ||
    /^[TC]\d+(\.(ET|PT|PV|PRESET))?$/.test(value) ||
    /^MW\d+$/.test(value)
  );
}
