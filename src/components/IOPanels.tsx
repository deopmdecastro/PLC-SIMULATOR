import type { PLCState } from '@/types/plc';

interface IOPanelProps {
  state: PLCState;
}

export function InputPanel({ state }: IOPanelProps) {
  const labels = ['I0.0 Start', 'I0.1 Stop NF', 'I0.2 Auto', 'I0.3', 'I0.4', 'I0.5', 'I0.6', 'I0.7'];
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Digital Inputs</h3>
      <div className="space-y-1.5">
        {labels.map((label, i) => {
          const bit = state.inputs[7 - i];
          return (
            <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded px-2.5 py-2">
              <div className={`w-3 h-3 rounded-full transition-all flex-shrink-0 ${
                bit ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-slate-700'
              }`} />
              <span className="text-xs text-slate-300 flex-1">{label}</span>
              <span className={`text-xs font-mono font-bold ${bit ? 'text-emerald-400' : 'text-slate-500'}`}>
                {bit ? '1' : '0'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OutputPanel({ state }: IOPanelProps) {
  const labels = ['Q0.0 Motor', 'Q0.1 Standby', 'Q0.2 Stopped', 'Q0.3 Auto LED', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7'];
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Digital Outputs</h3>
      <div className="space-y-1.5">
        {labels.map((label, i) => {
          const bit = state.outputs[7 - i];
          return (
            <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded px-2.5 py-2">
              <div className={`w-3 h-3 rounded-full transition-all flex-shrink-0 ${
                bit ? 'bg-cyan-500 shadow-md shadow-cyan-500/50' : 'bg-slate-700'
              }`} />
              <span className="text-xs text-slate-300 flex-1">{label}</span>
              <span className={`text-xs font-mono font-bold ${bit ? 'text-cyan-400' : 'text-slate-500'}`}>
                {bit ? '1' : '0'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
