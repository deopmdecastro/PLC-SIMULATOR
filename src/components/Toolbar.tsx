import { Play, Square, RotateCcw, Zap, ZapOff, AlertTriangle, RefreshCw } from 'lucide-react';
import type { PLCState, ConnectionStatus } from '@/types/plc';

interface ToolbarProps {
  state: PLCState;
  connectionStatus: ConnectionStatus;
  onToggleRun: () => void;
  onToggleAuto: () => void;
  onPulseStart: () => void;
  onSetStop: (held: boolean) => void;
  onResetFaults: () => void;
  onResetCycles: () => void;
}

export function Toolbar({
  state, connectionStatus, onToggleRun, onToggleAuto, onPulseStart, onSetStop, onResetFaults, onResetCycles,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 bg-slate-800 px-4 py-2.5 border-b border-slate-700 flex-wrap">
      <button
        onClick={onToggleRun}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
          state.run
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
        }`}
      >
        {state.run ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {state.run ? 'STOP' : 'START'} CPU
      </button>

      <div className="h-6 w-px bg-slate-600" />

      <button
        onClick={onToggleAuto}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
          state.autoMode
            ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        AUTO {state.autoMode ? 'ON' : 'OFF'}
      </button>

      <button
        onMouseDown={() => onPulseStart()}
        onTouchStart={() => onPulseStart()}
        disabled={!state.run}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
      >
        <Zap className="w-3.5 h-3.5" />
        START (I0.0)
      </button>

      <button
        onMouseDown={() => onSetStop(true)}
        onMouseUp={() => onSetStop(false)}
        onMouseLeave={() => state.stopHeld && onSetStop(false)}
        onTouchStart={() => onSetStop(true)}
        onTouchEnd={() => onSetStop(false)}
        disabled={!state.run}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          state.stopHeld
            ? 'bg-red-500 text-white shadow-md shadow-red-500/40'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
        }`}
      >
        <Square className="w-3.5 h-3.5" />
        STOP (I0.1) NF
      </button>

      <div className="h-6 w-px bg-slate-600" />

      <button
        onClick={onResetFaults}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-600/80 hover:bg-amber-500 text-white transition-all"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        RESET FAULTS
      </button>

      <button
        onClick={onResetCycles}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        RESET COUNTER
      </button>

      <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
        <RefreshCw className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-emerald-400 animate-spin-slow' : ''}`} />
        <span>Live sync {connectionStatus === 'connected' ? 'active' : 'inactive'}</span>
      </div>
    </div>
  );
}
