import { Cpu, Power, Activity, Wifi, WifiOff } from 'lucide-react';
import type { PLCState, ConnectionStatus } from '@/types/plc';

interface TitleBarProps {
  state: PLCState;
  connectionStatus: ConnectionStatus;
}

export function TitleBar({ state, connectionStatus }: TitleBarProps) {
  const connected = connectionStatus === 'connected';
  return (
    <header className="flex items-center justify-between bg-slate-900 px-6 py-3 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">S7-1200 PLC SIMULATOR</h1>
            <p className="text-[10px] text-slate-400">Real-time Simulation &middot; TIA Portal Bridge</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Power className={`w-4 h-4 ${state.run ? 'text-emerald-400' : 'text-red-400'}`} />
          <span className={state.run ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
            {state.run ? 'RUN' : 'STOP'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300">Scan: <span className="text-white font-mono font-bold">{state.cycles}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
          <span className={connected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
            {connected ? 'SYNCED' : connectionStatus === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Source:</span>
          <span className={`font-semibold ${state.source === 'tia-portal' ? 'text-orange-400' : 'text-cyan-400'}`}>
            {state.source === 'tia-portal' ? 'TIA PORTAL' : 'SIMULATOR'}
          </span>
        </div>
      </div>
    </header>
  );
}
