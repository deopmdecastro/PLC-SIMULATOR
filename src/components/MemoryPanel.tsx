import type { PLCState } from '@/types/plc';

interface MemoryPanelProps {
  state: PLCState;
}

export function MemoryPanel({ state }: MemoryPanelProps) {
  const bits: { key: keyof PLCState['memoryBits']; label: string }[] = [
    { key: 'M0_0', label: 'M0.0 KM1' },
    { key: 'M0_1', label: 'M0.1 KM2' },
    { key: 'M0_2', label: 'M0.2 Perm.' },
    { key: 'M10_0', label: 'M10.0 Pulso' },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Memory / Markers</h3>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {bits.map((b) => {
          const val = state.memoryBits[b.key];
          return (
            <div key={b.key} className="flex items-center gap-2 bg-slate-900/50 rounded px-2.5 py-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                val ? 'bg-orange-500 shadow-md shadow-orange-500/50' : 'bg-slate-700'
              }`} />
              <span className="text-xs text-slate-300">{b.label}</span>
              <span className={`text-xs font-mono font-bold ml-auto ${val ? 'text-orange-400' : 'text-slate-500'}`}>
                {val ? '1' : '0'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-2">
          <span className="text-xs text-slate-400">G0 / MW100</span>
          <span className="text-sm font-mono font-bold text-white">{state.mw100}</span>
        </div>
        <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-2">
          <span className="text-xs text-slate-400">KM1</span>
          <span className={`text-sm font-mono font-bold ${state.relayK1 ? 'text-emerald-400' : 'text-slate-500'}`}>
            {state.relayK1 ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-2">
          <span className="text-xs text-slate-400">KM2</span>
          <span className={`text-sm font-mono font-bold ${state.relayK2 ? 'text-emerald-400' : 'text-slate-500'}`}>
            {state.relayK2 ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}
