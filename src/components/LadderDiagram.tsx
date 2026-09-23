import type { PLCState } from '@/types/plc';

interface LadderDiagramProps {
  state: PLCState;
}

export function LadderDiagram({ state }: LadderDiagramProps) {
  const i00 = state.inputs[7]; // Start
  const i01closed = !state.stopHeld; // Stop NF
  const i02 = state.autoMode; // Auto
  const q00 = state.outputs[7]; // Q0.0 Motor
  const q01 = state.outputs[6]; // Q0.1 Standby
  const q02 = state.outputs[5]; // Q0.2 Stopped
  const q03 = state.outputs[4]; // Q0.3 Auto

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Ladder Logic (LAD)</h3>
      <div className="space-y-4">
        {/* Network 1: Motor control with seal-in */}
        <Network label="Network 1: Motor Start/Stop with Seal-in" state={state}>
          <div className="flex items-center gap-1 text-[10px]">
            <PowerRail />
            {/* Start NO */}
            <Contact label="I0.0" closed={i00} type="NO" />
            <Wire active={i00} />
            {/* Seal-in from Q0.0 */}
            <div className="flex flex-col items-center">
              <Wire active={q00} />
              <Contact label="Q0.0" closed={q00} type="NO" />
            </div>
            <Wire active={i00 || q00} />
            {/* Stop NC */}
            <Contact label="I0.1" closed={i01closed} type="NC" />
            <Wire active={(i00 || q00) && i01closed} />
            {/* Coil */}
            <Coil label="Q0.0" energized={q00} />
            <PowerRail />
          </div>
          <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-slate-500">
            <span>Motor = (Start OR Latch) AND NOT Stop</span>
          </div>
        </Network>

        {/* Network 2: Auto mode indicator */}
        <Network label="Network 2: Auto Mode Indicator" state={state}>
          <div className="flex items-center gap-1 text-[10px]">
            <PowerRail />
            <Contact label="I0.2" closed={i02} type="NO" />
            <Wire active={i02} />
            <Wire active={i02} />
            <Wire active={i02} />
            <Coil label="Q0.3" energized={q03} />
            <PowerRail />
          </div>
        </Network>

        {/* Network 3: Standby in auto */}
        <Network label="Network 3: Standby (Auto & Not Running)" state={state}>
          <div className="flex items-center gap-1 text-[10px]">
            <PowerRail />
            <Contact label="I0.2" closed={i02} type="NO" />
            <Wire active={i02} />
            <Contact label="Q0.0" closed={!q00} type="NC" />
            <Wire active={i02 && !q00} />
            <Coil label="Q0.1" energized={q01} />
            <PowerRail />
          </div>
        </Network>

        {/* Network 4: Stopped indicator */}
        <Network label="Network 4: Stopped Indicator" state={state}>
          <div className="flex items-center gap-1 text-[10px]">
            <PowerRail />
            <Contact label="Q0.0" closed={!q00} type="NC" />
            <Wire active={!q00} />
            <Wire active={!q00} />
            <Wire active={!q00} />
            <Coil label="Q0.2" energized={q02} />
            <PowerRail />
          </div>
        </Network>
      </div>
    </div>
  );
}

function Network({ label, state, children }: { label: string; state: PLCState; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg p-3 border transition-colors ${state.run ? 'border-slate-700 bg-slate-900/30' : 'border-slate-800 bg-slate-900/10'}`}>
      <div className="text-[10px] text-slate-400 font-semibold mb-2">{label}</div>
      {children}
    </div>
  );
}

function PowerRail() {
  return <div className="w-1 h-10 bg-slate-600 rounded-full flex-shrink-0" />;
}

function Wire({ active }: { active: boolean }) {
  return (
    <div className={`h-0.5 w-6 flex-shrink-0 transition-colors ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
  );
}

function Contact({ label, closed, type }: { label: string; closed: boolean; type: 'NO' | 'NC' }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="flex items-center justify-center w-10 h-7 border-2 rounded-sm transition-colors relative"
        style={{
          borderColor: closed ? 'rgb(52, 211, 153)' : 'rgb(71, 85, 105)',
          backgroundColor: closed ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
        }}>
        {type === 'NO' ? (
          <div className={`w-full h-0.5 ${closed ? 'bg-emerald-400' : 'bg-slate-500'}`} />
        ) : (
          <div className="flex items-center w-full h-full justify-center">
            <div className={`w-full h-0.5 ${closed ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <div className="absolute right-0 w-1 h-1 bg-slate-500 rounded-full" />
          </div>
        )}
      </div>
      <span className="text-[8px] text-slate-400 mt-0.5">{label}</span>
    </div>
  );
}

function Coil({ label, energized }: { label: string; energized: boolean }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors"
        style={{
          borderColor: energized ? 'rgb(34, 211, 238)' : 'rgb(71, 85, 105)',
          backgroundColor: energized ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
          boxShadow: energized ? '0 0 8px rgba(34, 211, 238, 0.4)' : 'none',
        }}>
        <div className={`w-3 h-3 rounded-full ${energized ? 'bg-cyan-400' : 'bg-slate-600'}`} />
      </div>
      <span className={`text-[8px] mt-0.5 ${energized ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}
