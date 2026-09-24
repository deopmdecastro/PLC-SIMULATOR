/**
 * Painel de simulação 2D — desenha cada componente com comportamento derivado
 * do estado real da variável PLC associada.
 *
 * Princípio: o desenho nunca inventa estado. Sem valor `good` vindo do PLC, o
 * componente aparece esbatido com a etiqueta "sem dados".
 */

import type { MouseEvent as ReactMouseEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ComponentRuntimeState, SimulationComponent } from '@/simulation/scene';
import { resolveAnalogPercent } from '@/simulation/scene';

interface ComponentViewProps {
  component: SimulationComponent;
  state: ComponentRuntimeState;
  selected: boolean;
  interactive: boolean;
  values: Record<string, import('@/plc').PLCVariableValue>;
  variables: import('@/plc').PLCVariableDefinition[];
  onInteract?: (component: SimulationComponent, active: boolean) => void;
  onSelect?: (component: SimulationComponent) => void;
  onDragStart?: (component: SimulationComponent, event: ReactMouseEvent) => void;
}

const DIM = 'opacity-45';

function frame(state: ComponentRuntimeState, selected: boolean, active: boolean) {
  const border = selected
    ? 'border-cyan-400 ring-2 ring-cyan-400/40'
    : active
      ? 'border-emerald-400/70'
      : 'border-slate-700';
  return `relative select-none rounded-lg border ${border} ${state.mapped ? '' : DIM}`;
}

function AnimationClass(state: ComponentRuntimeState, animation: string): string {
  if (!state.mapped || !state.active) return '';
  if (state.animation !== animation) return '';
  return `lab-${animation}`;
}

export function ComponentView({
  component,
  state,
  selected,
  interactive,
  values,
  variables,
  onInteract,
  onSelect,
  onDragStart,
}: ComponentViewProps) {
  const handlePointerDown = (event: ReactMouseEvent) => {
    onSelect?.(component);
    if (event.shiftKey) return;
    onDragStart?.(component, event);
  };

  const press = () => {
    if (!interactive) return;
    if (component.mode === 'momentary') onInteract?.(component, true);
    else onInteract?.(component, !state.active);
  };

  const release = () => {
    if (!interactive) return;
    if (component.mode === 'momentary') onInteract?.(component, false);
  };

  const percent = resolveAnalogPercent(component, values, variables, 0);

  const body = () => {
    switch (component.type) {
      case 'motor':
      case 'fan':
        return <MotorView component={component} state={state} />;
      case 'conveyor':
        return <ConveyorView component={component} state={state} percent={percent} />;
      case 'cylinder':
        return <CylinderView component={component} state={state} percent={percent} />;
      case 'tank':
      case 'silo':
        return <TankView component={component} state={state} percent={percent} />;
      case 'valve':
        return <ValveView component={component} state={state} />;
      case 'lamp':
      case 'signal_light':
        return <LampView component={component} state={state} />;
      case 'buzzer':
      case 'siren':
        return <BuzzerView component={component} state={state} />;
      case 'potentiometer':
      case 'analog_sensor':
        return <AnalogView component={component} state={state} />;
      case 'selector_switch':
      case 'switch':
        return <SwitchView component={component} state={state} />;
      case 'emergency_stop':
        return <EStopView component={component} state={state} />;
      case 'contactor':
      case 'relay':
        return <CoilView component={component} state={state} />;
      case 'heater':
        return <HeaterView component={component} state={state} />;
      case 'sensor':
      case 'proximity_sensor':
      case 'limit_switch':
      case 'photoelectric_sensor':
        return <SensorView component={component} state={state} />;
      case 'push_button':
      default:
        return <ButtonView component={component} state={state} />;
    }
  };

  return (
    <div
      data-component-id={component.id}
      className={`${frame(state, selected, state.active)} ${component.type === 'push_button' || component.type === 'emergency_stop' ? 'cursor-pointer active:scale-95' : 'cursor-grab'}`}
      style={{ left: component.x, top: component.y, width: component.size?.w, minWidth: 80 }}
      onMouseDown={handlePointerDown}
      onMouseDownCapture={press}
      onMouseUp={release}
      onMouseLeave={release}
      title={`${component.name} · ${component.address || 'sem endereço'} · ${state.label}`}
    >
      <div className="flex flex-col items-center gap-1 p-2">
        {body()}
        <div className="flex items-center gap-1 text-[9px] leading-none">
          <span className="font-mono font-semibold text-slate-300">{component.address || '—'}</span>
          <span className={state.active ? 'text-emerald-400' : 'text-slate-500'}>{state.label}</span>
        </div>
      </div>
      {!state.mapped && (
        <span className="absolute -top-2 right-1 rounded bg-amber-500/90 px-1 text-[8px] font-bold text-slate-950">
          sem dados
        </span>
      )}
      {selected && (
        <span className="absolute -top-2 left-1 rounded bg-cyan-500 px-1 text-[8px] font-bold text-slate-950">
          {component.name}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vistas                                                             */
/* ------------------------------------------------------------------ */

interface ViewProps {
  component: SimulationComponent;
  state: ComponentRuntimeState;
}

function ButtonView({ component, state }: ViewProps) {
  const on = state.active;
  return (
    <div className="flex flex-col items-center" title={component.description}>
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all ${
          on ? 'border-emerald-300 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40' : 'border-slate-500 bg-slate-700 text-slate-300'
        }`}
      >
        {on ? 'ON' : 'OFF'}
      </div>
      <span className="mt-0.5 max-w-[92px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}

function EStopView({ component, state }: ViewProps) {
  const triggered = !state.active && state.mapped;
  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border-4 ${
          triggered
            ? 'lab-blink border-red-300 bg-red-600 shadow-lg shadow-red-500/50'
            : 'border-amber-300 bg-amber-500 shadow-lg shadow-amber-500/30'
        }`}
      >
        <AlertTriangle className={`h-5 w-5 ${triggered ? 'text-white' : 'text-slate-950'}`} />
      </div>
      <span className="mt-0.5 max-w-[92px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}

function SwitchView({ component, state }: ViewProps) {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-7 w-14 items-center rounded-full border p-0.5 transition-all ${state.active ? 'justify-end border-emerald-400 bg-emerald-900/60' : 'justify-start border-slate-600 bg-slate-800'}`}>
        <div className={`h-6 w-6 rounded-full transition-all ${state.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      </div>
      <span className="mt-0.5 max-w-[92px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}

function SensorView({ component, state }: ViewProps) {
  const pulse = AnimationClass(state, 'signal');
  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex h-10 w-10 items-center justify-center rounded-md border-2 ${state.active ? 'border-cyan-300 bg-cyan-900/50' : 'border-slate-600 bg-slate-800'}`}>
        <div className={`h-3 w-3 rounded-full ${state.active ? 'bg-cyan-400' : 'bg-slate-600'} ${pulse}`} />
        <div className={`absolute -right-3 h-0.5 w-3 ${state.active ? 'bg-cyan-400' : 'bg-slate-700'}`} />
      </div>
      <span className="mt-0.5 max-w-[92px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}

function AnalogView({ component, state }: ViewProps) {
  const raw = typeof state.value === 'number' ? state.value : 0;
  const percent = Math.max(0, Math.min(100, (raw / 27648) * 100));
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-900">
        <div
          className="absolute h-[3px] w-6 origin-left bg-cyan-400"
          style={{ transform: `rotate(${-90 + (percent / 100) * 180}deg)`, left: '50%' }}
        />
        <div className="h-2 w-2 rounded-full bg-slate-500" />
      </div>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className="font-mono text-[9px] text-cyan-300">{Math.round(raw)}</span>
    </div>
  );
}

function MotorView({ component, state }: ViewProps) {
  const spin = state.animation === 'reverse_rotation' ? 'lab-spin-reverse' : 'lab-spin';
  const running = state.mapped && state.active;
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 ${running ? 'border-emerald-400 bg-emerald-900/40 shadow-lg shadow-emerald-500/30' : 'border-slate-600 bg-slate-800'}`}>
        <svg viewBox="0 0 40 40" className={`h-8 w-8 ${running ? spin : ''}`} aria-hidden>
          <g fill={running ? '#34d399' : '#64748b'}>
            <rect x="17" y="4" width="6" height="14" rx="2" />
            <rect x="17" y="22" width="6" height="14" rx="2" />
            <rect x="4" y="17" width="14" height="6" rx="2" />
            <rect x="22" y="17" width="14" height="6" rx="2" />
          </g>
          <circle cx="20" cy="20" r="5" fill={running ? '#065f46' : '#334155'} />
        </svg>
      </div>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className={`text-[9px] font-mono ${running ? 'text-emerald-400' : 'text-slate-500'}`}>
        {running ? (state.animation === 'reverse_rotation' ? 'REV' : 'FWD') : 'STOP'}
      </span>
    </div>
  );
}

function ConveyorView({ component, state, percent }: ViewProps & { percent: number }) {
  const running = state.mapped && state.active;
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative h-11 w-full overflow-hidden rounded-md border-2 border-slate-600 bg-slate-800">
        <div className={`absolute inset-0 ${running ? 'lab-tape' : ''}`} />
        {running && (
          <div
            className="lab-product absolute top-1.5 h-7 w-7 rounded bg-cyan-400 shadow-lg shadow-cyan-500/40"
            style={{ left: 4, ['--lab-run' as string]: `${Math.max(120, percent + 160)}px` }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-around">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className={`h-4 w-4 rounded-full border-2 ${running ? 'lab-spin border-cyan-400 bg-cyan-900/40' : 'border-slate-600 bg-slate-800'}`} />
          ))}
        </div>
      </div>
      <span className="mt-0.5 max-w-[240px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className={`text-[9px] font-mono ${running ? 'text-cyan-300' : 'text-slate-500'}`}>
        {running ? `pos ${Math.round(percent)}` : 'PARADO'}
      </span>
    </div>
  );
}

function CylinderView({ component, state, percent }: ViewProps & { percent: number }) {
  const ext = state.mapped ? percent : state.active ? 100 : 0;
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative h-12 w-full rounded-md border-2 border-slate-600 bg-slate-900">
        <div className="absolute left-1 top-1/2 h-8 w-3 -translate-y-1/2 rounded bg-slate-600" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-500 transition-all duration-200"
          style={{ left: 12, width: `${8 + (ext / 100) * 55}%` }}
        />
        <div
          className={`absolute top-1/2 h-14 w-5 -translate-y-1/2 rounded border-2 transition-all duration-200 ${
            ext > 50 ? 'border-cyan-300 bg-cyan-600' : 'border-slate-500 bg-slate-600'
          }`}
          style={{ left: `calc(${12 + (ext / 100) * 62}%)` }}
        />
      </div>
      <div className="mt-0.5 flex w-full items-center justify-between text-[9px]">
        <span className="truncate font-semibold text-slate-300">{component.name}</span>
        <span className={`font-mono ${ext > 50 ? 'text-cyan-300' : 'text-slate-500'}`}>{Math.round(ext)} %</span>
      </div>
    </div>
  );
}

function TankView({ component, state, percent }: ViewProps & { percent: number }) {
  const level = state.mapped ? percent : typeof state.value === 'number' ? Math.max(0, Math.min(100, state.value)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-20 overflow-hidden rounded-md border-2 border-slate-600 bg-slate-900">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-700 to-cyan-400 transition-all duration-300 ${state.active ? 'lab-flow' : ''}`}
          style={{ height: `${Math.max(2, level)}%` }}
        />
        <div className="absolute inset-x-0 top-1/3 border-t border-slate-700" />
        <div className="absolute inset-x-0 top-2/3 border-t border-slate-700" />
      </div>
      <span className="mt-0.5 max-w-[120px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className="font-mono text-[9px] text-cyan-300">{Math.round(level)} %</span>
    </div>
  );
}

function ValveView({ component, state }: ViewProps) {
  const open = state.mapped && state.active;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 60 50" className="h-11 w-16" aria-hidden>
        <rect x="4" y="22" width="52" height="6" rx="2" fill="#475569" />
        <path d="M22 25 L38 10 L38 40 Z" fill={open ? '#22d3ee' : '#64748b'} />
        <path d="M38 25 L22 10 L22 40 Z" fill={open ? '#0891b2' : '#475569'} />
        <circle cx="30" cy="6" r="4" fill={open ? '#34d399' : '#64748b'} />
      </svg>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className={`text-[9px] font-mono ${open ? 'text-emerald-400' : 'text-slate-500'}`}>{open ? 'OPEN' : 'CLOSED'}</span>
    </div>
  );
}

function LampView({ component, state }: ViewProps) {
  const glow = AnimationClass(state, 'glow');
  const blink = AnimationClass(state, 'blink');
  const red = component.name.toUpperCase().includes('RED') || component.type === 'signal_light';
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${state.active ? (red ? 'border-red-300 bg-red-500 shadow-lg shadow-red-500/50' : 'border-emerald-300 bg-emerald-500 shadow-lg shadow-emerald-500/50') : 'border-slate-600 bg-slate-800'}`}>
        <div className={`h-5 w-5 rounded-full ${state.active ? 'bg-white/90' : 'bg-slate-700'} ${glow || blink}`} />
      </div>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}

function BuzzerView({ component, state }: ViewProps) {
  const sound = AnimationClass(state, 'sound');
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${state.active ? 'border-amber-300 bg-amber-500' : 'border-slate-600 bg-slate-800'} ${sound}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill={state.active ? '#1e293b' : '#64748b'} />
          {state.active && <path d="M16 8c1.5 1 1.5 7 0 8" stroke="#1e293b" strokeWidth="1.6" fill="none" />}
        </svg>
      </div>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
      <span className={`text-[9px] font-mono ${state.active ? 'text-amber-300' : 'text-slate-500'}`}>{state.active ? 'SOM' : '—'}</span>
    </div>
  );
}

function CoilView({ component, state }: ViewProps) {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-10 w-14 flex-col items-center justify-center rounded border-2 ${state.active ? 'border-emerald-400 bg-emerald-900/40' : 'border-slate-600 bg-slate-800'}`}>
        <span className="font-mono text-[8px] text-slate-400">{component.name.slice(0, 6)}</span>
        <span className={`text-[10px] font-bold ${state.active ? 'text-emerald-400' : 'text-slate-500'}`}>{state.active ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
}

function HeaterView({ component, state }: ViewProps) {
  const heat = AnimationClass(state, 'heat');
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-md border-2 ${state.active ? 'border-orange-300 bg-orange-600/70' : 'border-slate-600 bg-slate-800'} ${heat}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path d="M12 2c3 4 5 6 5 9a5 5 0 1 1-10 0c0-3 2-5 5-9z" fill={state.active ? '#fed7aa' : '#64748b'} />
        </svg>
      </div>
      <span className="mt-0.5 max-w-[104px] truncate text-[9px] font-semibold text-slate-300">{component.name}</span>
    </div>
  );
}
