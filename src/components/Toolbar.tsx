import { Play, Square, RotateCcw, Zap, AlertTriangle, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import type { PLCState, ConnectionStatus } from '@/types/plc';

interface ToolbarProps {
  state: PLCState;
  connectionStatus: ConnectionStatus;
  onToggleRun: () => void;
  onPulseStartD: () => void;
  onPulseStartE: () => void;
  onSetStopNf: (closed: boolean) => void;
  onSetFrNf: (closed: boolean) => void;
  onResetFaults: () => void;
  onResetCycles: () => void;
}

export function Toolbar({
  state, connectionStatus, onToggleRun, onPulseStartD, onPulseStartE, onSetStopNf, onSetFrNf, onResetFaults, onResetCycles,
}: ToolbarProps) {
  const mobileButtonLayout = 'min-w-0 flex-1 basis-[calc(50%-0.25rem)] justify-center text-center leading-tight sm:flex-none sm:basis-auto';

  return (
    <div className="flex items-stretch gap-2 bg-slate-800 px-3 py-2.5 border-b border-slate-700 flex-wrap sm:items-center sm:gap-3 sm:px-4">
      <button
        onClick={onToggleRun}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${mobileButtonLayout} ${
          state.run
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
        }`}
      >
        {state.run ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {state.run ? 'STOP' : 'START'} CPU
      </button>

      <div className="hidden h-6 w-px bg-slate-600 sm:block" />

      <button
        onMouseDown={() => onPulseStartD()}
        onTouchStart={() => onPulseStartD()}
        disabled={!state.run}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all ${mobileButtonLayout}`}
      >
        <ArrowRight className="w-3.5 h-3.5" />
        START_D (I0.0)
      </button>

      <button
        onMouseDown={() => onPulseStartE()}
        onTouchStart={() => onPulseStartE()}
        disabled={!state.run}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all ${mobileButtonLayout}`}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        START_E (I0.1)
      </button>

      <button
        onMouseDown={() => onSetStopNf(false)}
        onMouseUp={() => onSetStopNf(true)}
        onMouseLeave={() => !state.stopNfClosed && onSetStopNf(true)}
        onTouchStart={() => onSetStopNf(false)}
        onTouchEnd={() => onSetStopNf(true)}
        disabled={!state.run}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${mobileButtonLayout} ${
          !state.stopNfClosed
            ? 'bg-red-500 text-white shadow-md shadow-red-500/40'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
        }`}
      >
        <Square className="w-3.5 h-3.5" />
        STOP_NF (I0.2)
      </button>

      <button
        onClick={() => onSetFrNf(!state.frNfClosed)}
        disabled={!state.run}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${mobileButtonLayout} ${
          state.frNfClosed
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            : 'bg-orange-600 text-white shadow-md shadow-orange-600/40'
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        FR_NF {state.frNfClosed ? 'OK' : 'TRIP'}
      </button>

      <div className="hidden h-6 w-px bg-slate-600 sm:block" />

      <button
        onClick={onResetFaults}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-600/80 hover:bg-amber-500 text-white transition-all ${mobileButtonLayout}`}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        RESET FAULTS
      </button>

      <button
        onClick={onResetCycles}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all ${mobileButtonLayout}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        RESET COUNTER
      </button>

      <div className="flex w-full items-center gap-2 text-xs text-slate-400 sm:ml-auto sm:w-auto">
        <RefreshCw className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-emerald-400 animate-spin-slow' : ''}`} />
        <span>Live sync {connectionStatus === 'connected' ? 'active' : 'inactive'}</span>
      </div>
    </div>
  );
}
