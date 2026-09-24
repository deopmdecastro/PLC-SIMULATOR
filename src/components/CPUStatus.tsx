import { AlertTriangle, Bus, Power, Cpu } from 'lucide-react';
import type { PLCState } from '@/types/plc';

interface CPUStatusProps {
  state: PLCState;
}

export function CPUStatus({ state }: CPUStatusProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">CPU Status</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatusLED label="RUN" active={state.run} color="emerald" icon={<Power className="w-3 h-3" />} />
        <StatusLED label="STOP" active={!state.run} color="red" icon={<Power className="w-3 h-3" />} />
        <StatusLED label="SF (System Fault)" active={state.sf} color="red" icon={<AlertTriangle className="w-3 h-3" />} />
        <StatusLED label="BF (Bus Fault)" active={state.bf} color="amber" icon={<Bus className="w-3 h-3" />} />
        <StatusLED label="MAINT" active={false} color="amber" icon={<AlertTriangle className="w-3 h-3" />} />
        <StatusLED label="FORCE" active={false} color="amber" icon={<AlertTriangle className="w-3 h-3" />} />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 space-y-1.5">
        <DataRow label="G0 / MW100" value={state.mw100.toString()} mono />
        <DataRow label="STOP_NF" value={state.stopNfClosed ? 'TRUE' : 'FALSE'} highlight={state.stopNfClosed} />
        <DataRow label="FR_NF" value={state.frNfClosed ? 'TRUE' : 'FALSE'} highlight={state.frNfClosed} />
        <DataRow label="KM1 / KM2" value={`${state.relayK1 ? '1' : '0'} / ${state.relayK2 ? '1' : '0'}`} mono highlight={state.relayK1 || state.relayK2} />
        <DataRow label="Source" value={state.source === 'tia-portal' ? 'TIA PORTAL' : 'SIMULATOR'} />
      </div>
    </div>
  );
}

function StatusLED({
  label, active, color, icon,
}: {
  label: string;
  active: boolean;
  color: 'emerald' | 'red' | 'amber';
  icon: React.ReactNode;
}) {
  const colorMap = {
    emerald: { on: 'bg-emerald-500 shadow-emerald-500/50', off: 'bg-slate-700', text: 'text-emerald-400' },
    red: { on: 'bg-red-500 shadow-red-500/50', off: 'bg-slate-700', text: 'text-red-400' },
    amber: { on: 'bg-amber-500 shadow-amber-500/50', off: 'bg-slate-700', text: 'text-amber-400' },
  };
  const c = colorMap[color];
  return (
    <div className="flex items-center gap-2 bg-slate-900/50 rounded px-2 py-1.5">
      <div className={`w-2.5 h-2.5 rounded-full transition-all ${active ? `${c.on} shadow-md` : c.off}`}>
      </div>
      <span className="text-[10px] text-slate-400 flex items-center gap-1">
        {icon}
        {label}
      </span>
    </div>
  );
}

function DataRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`${mono ? 'font-mono' : 'font-semibold'} ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}
