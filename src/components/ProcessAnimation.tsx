import { Factory, Fan, Gauge } from 'lucide-react';
import type { PLCState } from '@/types/plc';

interface ProcessAnimationProps {
  state: PLCState;
}

export function ProcessAnimation({ state }: ProcessAnimationProps) {
  const motorRunning = state.outputs[7]; // Q0.0
  const standby = state.outputs[6]; // Q0.1
  const stopped = state.outputs[5]; // Q0.2
  const autoLed = state.outputs[4]; // Q0.3

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Factory className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Process Visualization</h3>
      </div>

      <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg p-6 overflow-hidden" style={{ height: '280px' }}>
        {/* Grid background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.3) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />

        {/* Conveyor belt */}
        <div className="absolute bottom-12 left-4 right-4 h-8 bg-slate-700 rounded">
          <div className="absolute inset-0 flex items-center justify-around">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  motorRunning ? 'border-cyan-400 bg-cyan-900/50 animate-spin' : 'border-slate-500 bg-slate-800'
                }`}
                style={{ animationDuration: '0.8s' }}
              />
            ))}
          </div>
        </div>

        {/* Motor */}
        <div className="absolute bottom-20 left-8 flex flex-col items-center">
          <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all ${
            motorRunning
              ? 'border-emerald-400 bg-emerald-900/30 shadow-lg shadow-emerald-500/30'
              : standby
                ? 'border-amber-400 bg-amber-900/20'
                : 'border-slate-600 bg-slate-800'
          }`}>
            <Fan className={`w-7 h-7 transition-all ${motorRunning ? 'text-emerald-400 animate-spin' : standby ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <span className="text-[9px] text-slate-400 mt-1">Motor M1</span>
        </div>

        {/* Product on conveyor */}
        {motorRunning && (
          <div className="absolute bottom-14 w-6 h-6 bg-cyan-500 rounded shadow-lg shadow-cyan-500/50 animate-conveyor" />
        )}

        {/* Control panel */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Indicator label="RUN" active={motorRunning} color="emerald" />
          <Indicator label="STBY" active={standby} color="amber" />
          <Indicator label="STOP" active={stopped} color="red" />
          <Indicator label="AUTO" active={autoLed} color="cyan" />
        </div>

        {/* Gauge */}
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2 bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-700">
            <Gauge className={`w-5 h-5 ${motorRunning ? 'text-emerald-400' : 'text-slate-500'}`} />
            <div>
              <div className="text-[9px] text-slate-400">SPEED</div>
              <div className="text-sm font-mono font-bold text-white">
                {motorRunning ? '1450' : '0'} <span className="text-[9px] text-slate-400">RPM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status banner */}
        <div className="absolute bottom-2 left-4 right-4 text-center">
          <span className={`text-xs font-bold tracking-wide ${
            motorRunning ? 'text-emerald-400' : standby ? 'text-amber-400' : 'text-red-400'
          }`}>
            {motorRunning ? '>>> MOTOR RUNNING <<< PRODUCTION ACTIVE' : standby ? '--- STANDBY --- AWAITING START' : '### STOPPED ### MOTOR OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Indicator({ label, active, color }: { label: string; active: boolean; color: 'emerald' | 'amber' | 'red' | 'cyan' }) {
  const colorMap = {
    emerald: 'bg-emerald-500 shadow-emerald-500/50 text-emerald-400',
    amber: 'bg-amber-500 shadow-amber-500/50 text-amber-400',
    red: 'bg-red-500 shadow-red-500/50 text-red-400',
    cyan: 'bg-cyan-500 shadow-cyan-500/50 text-cyan-400',
  };
  const c = colorMap[color];
  return (
    <div className="flex items-center gap-1.5 bg-slate-900/80 rounded px-2 py-1 border border-slate-700">
      <div className={`w-2 h-2 rounded-full transition-all ${active ? c.split(' ')[0] + ' ' + c.split(' ')[1] : 'bg-slate-700'}`} />
      <span className={`text-[9px] font-semibold ${active ? c.split(' ')[2] : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}
