import { DEFAULT_SIMULATOR_CONFIG } from '@/types/plc';
import type { PLCState, SimulatorTagConfig } from '@/types/plc';

interface IOPanelProps {
  state: PLCState;
  tags?: SimulatorTagConfig[];
}

export function InputPanel({ state, tags = DEFAULT_SIMULATOR_CONFIG.inputTags }: IOPanelProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Digital Inputs</h3>
      <div className="space-y-1.5">
        {tags.map((tag, i) => {
          const bit = state.inputs[7 - i];
          return (
            <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded px-2.5 py-2">
              <div className={`w-3 h-3 rounded-full transition-all flex-shrink-0 ${
                bit ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-slate-700'
              }`} />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                <span className="font-mono text-[10px] font-semibold text-slate-500">{tag.address}</span>{' '}
                {tag.label}
              </span>
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

export function OutputPanel({ state, tags = DEFAULT_SIMULATOR_CONFIG.outputTags }: IOPanelProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Digital Outputs</h3>
      <div className="space-y-1.5">
        {tags.map((tag, i) => {
          const bit = state.outputs[7 - i];
          return (
            <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded px-2.5 py-2">
              <div className={`w-3 h-3 rounded-full transition-all flex-shrink-0 ${
                bit ? 'bg-cyan-500 shadow-md shadow-cyan-500/50' : 'bg-slate-700'
              }`} />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                <span className="font-mono text-[10px] font-semibold text-slate-500">{tag.address}</span>{' '}
                {tag.label}
              </span>
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
