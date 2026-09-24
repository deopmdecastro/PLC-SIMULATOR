import type { ReactNode } from 'react';
import type { PLCState } from '@/types/plc';
import { evaluateMainProgram } from '@/lib/tiaMainProgram';

interface LadderDiagramProps {
  state: PLCState;
}

type ContactType = 'NO' | 'NC';

const activeWire = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]';
const idleWire = 'bg-slate-600/80';
const activeSymbol = 'border-emerald-300 text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.25)]';
const idleSymbol = 'border-slate-500/90 text-slate-300';

export function LadderDiagram({ state }: LadderDiagramProps) {
  const main = evaluateMainProgram(state);
  const g0Ready = state.run && main.g0 === 1;
  const g0Right = state.run && main.g0 === 5;
  const g0Left = state.run && main.g0 === 10;

  const startRightActive = g0Ready && main.stopNf && main.frNf && main.startD && !main.startE;
  const startLeftActive = g0Ready && main.stopNf && main.frNf && main.startE && !main.startD;
  const stopRightFrActive = g0Right && !main.frNf;
  const stopRightStopActive = g0Right && !main.stopNf;
  const stopLeftFrActive = g0Left && !main.frNf;
  const stopLeftStopActive = g0Left && !main.stopNf;
  const km1Active = state.run && main.nextG0 === 5;
  const km2Active = state.run && main.nextG0 === 10;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-100">Main [OB1] - Ex6 LAD</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="rounded-sm border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">S7-315 PN/DP</span>
            <span>{state.source === 'tia-portal' ? 'TIA Portal online' : 'Simulator online'}</span>
            <span className={state.run ? 'text-emerald-300' : 'text-amber-300'}>{state.run ? 'CPU RUN' : 'CPU STOP'}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wide">
          <StatusBadge label="SF" ok={!state.sf} />
          <StatusBadge label="BF" ok={!state.bf} />
          <StatusBadge label="G0" ok value={String(state.mw100)} />
        </div>
      </div>

      <div className="divide-y divide-slate-700/70">
        <Network number={1} title="START MOTOR GIRA DIREITA">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 1" energized={g0Ready} />
            <Wire active={g0Ready} />
            <Contact address="I0.2" label="STOP_NF" closed={main.stopNf} type="NO" />
            <Wire active={g0Ready && main.stopNf} />
            <Contact address="I0.3" label="FR_NF" closed={main.frNf} type="NO" />
            <Wire active={g0Ready && main.stopNf && main.frNf} />
            <Contact address="I0.0" label="START_D" closed={main.startD} type="NO" />
            <Wire active={g0Ready && main.stopNf && main.frNf && main.startD} />
            <Contact address="I0.1" label="START_E" closed={!main.startE} type="NC" />
            <Wire active={startRightActive} />
            <MoveBlock inValue={5} outAddress="MW100" label="G0" energized={startRightActive} />
            <Rail />
          </Rung>
        </Network>

        <Network number={2} title="START MOTOR GIRA ESQUERDA">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 1" energized={g0Ready} />
            <Wire active={g0Ready} />
            <Contact address="I0.2" label="STOP_NF" closed={main.stopNf} type="NO" />
            <Wire active={g0Ready && main.stopNf} />
            <Contact address="I0.3" label="FR_NF" closed={main.frNf} type="NO" />
            <Wire active={g0Ready && main.stopNf && main.frNf} />
            <Contact address="I0.1" label="START_E" closed={main.startE} type="NO" />
            <Wire active={g0Ready && main.stopNf && main.frNf && main.startE} />
            <Contact address="I0.0" label="START_D" closed={!main.startD} type="NC" />
            <Wire active={startLeftActive} />
            <MoveBlock inValue={10} outAddress="MW100" label="G0" energized={startLeftActive} />
            <Rail />
          </Rung>
        </Network>

        <Network number={3} title="STOP">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 5" energized={g0Right} />
            <Wire active={g0Right} />
            <Branch
              entryActive={g0Right}
              top={<Contact address="I0.3" label="FR_NF" closed={!main.frNf} type="NC" compact />}
              topActive={stopRightFrActive}
              bottom={<Contact address="I0.2" label="STOP_NF" closed={!main.stopNf} type="NC" compact />}
              bottomActive={stopRightStopActive}
            />
            <Wire active={main.stopRightTransition} />
            <MoveBlock inValue={1} outAddress="MW100" label="G0" energized={main.stopRightTransition} />
            <Rail />
          </Rung>
        </Network>

        <Network number={4} title="STOP">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 10" energized={g0Left} />
            <Wire active={g0Left} />
            <Branch
              entryActive={g0Left}
              top={<Contact address="I0.3" label="FR_NF" closed={!main.frNf} type="NC" compact />}
              topActive={stopLeftFrActive}
              bottom={<Contact address="I0.2" label="STOP_NF" closed={!main.stopNf} type="NC" compact />}
              bottomActive={stopLeftStopActive}
            />
            <Wire active={main.stopLeftTransition} />
            <MoveBlock inValue={1} outAddress="MW100" label="G0" energized={main.stopLeftTransition} />
            <Rail />
          </Rung>
        </Network>

        <Network number={5} title="SAIDA MOTOR DIREITA">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 5" energized={km1Active} />
            <Wire active={km1Active} />
            <Coil address="Q0.0" label="KM1" energized={km1Active} />
            <Rail />
          </Rung>
        </Network>

        <Network number={6} title="SAIDA MOTOR ESQUERDA">
          <Rung>
            <Rail />
            <Compare address="MW100" label="G0" expression="== Int 10" energized={km2Active} />
            <Wire active={km2Active} />
            <Coil address="Q0.1" label="KM2" energized={km2Active} />
            <Rail />
          </Rung>
        </Network>
      </div>
    </div>
  );
}

function StatusBadge({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className={`min-w-14 rounded-sm border px-2 py-1 text-center ${ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'}`}>
      <span className="block text-[9px] text-slate-400">{label}</span>
      <span>{value ?? (ok ? 'OK' : 'ON')}</span>
    </div>
  );
}

function Network({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="py-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold">
        <span className="rounded-sm bg-slate-700 px-1.5 py-0.5 font-mono text-cyan-200">Network {number}</span>
        <span className="uppercase tracking-wide text-slate-300">{title}</span>
      </div>
      <div className="overflow-x-auto rounded-sm border border-slate-700/70 bg-[#101827] p-3 shadow-inner">
        {children}
      </div>
    </section>
  );
}

function Rung({ children }: { children: ReactNode }) {
  return <div className="flex min-w-max items-center text-[10px]">{children}</div>;
}

function Rail() {
  return <div className="h-[74px] w-1 flex-shrink-0 rounded-sm bg-slate-500" />;
}

function Wire({ active, className = '' }: { active: boolean; className?: string }) {
  return <div className={`h-0.5 w-9 flex-shrink-0 transition-colors ${active ? activeWire : idleWire} ${className}`} />;
}

function Contact({ address, label, closed, type, compact = false }: { address: string; label: string; closed: boolean; type: ContactType; compact?: boolean }) {
  return (
    <div className={`flex flex-shrink-0 flex-col items-center ${compact ? 'w-[70px]' : 'w-[82px]'}`}>
      <div className={`mb-1 max-w-full truncate font-mono text-[10px] font-bold ${closed ? 'text-emerald-200' : 'text-slate-300'}`}>{address}</div>
      <div className={`relative flex h-9 w-14 items-center justify-center transition-colors ${closed ? activeSymbol : idleSymbol}`}>
        <span className={`absolute left-[15px] top-1 h-7 border-l-2 ${closed ? 'border-emerald-300' : 'border-slate-500'}`} />
        <span className={`absolute right-[15px] top-1 h-7 border-l-2 ${closed ? 'border-emerald-300' : 'border-slate-500'}`} />
        {type === 'NC' && (
          <span className={`absolute h-9 rotate-45 border-l-2 ${closed ? 'border-emerald-300' : 'border-slate-500'}`} />
        )}
        <span className={`h-0.5 w-full ${closed ? activeWire : idleWire}`} />
      </div>
      <div className="mt-1 max-w-full truncate text-center text-[9px] leading-tight text-slate-400">{label}</div>
    </div>
  );
}

function Coil({ address, label, energized }: { address: string; label: string; energized: boolean }) {
  return (
    <div className="flex w-[82px] flex-shrink-0 flex-col items-center">
      <div className={`mb-1 max-w-full truncate font-mono text-[10px] font-bold ${energized ? 'text-cyan-200' : 'text-slate-300'}`}>{address}</div>
      <div className={`relative flex h-9 w-14 items-center justify-center transition-colors ${energized ? 'text-cyan-200' : 'text-slate-400'}`}>
        <span className={`absolute left-3 h-8 w-4 rounded-l-full border-y-2 border-l-2 ${energized ? 'border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]' : 'border-slate-500'}`} />
        <span className={`absolute right-3 h-8 w-4 rounded-r-full border-y-2 border-r-2 ${energized ? 'border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]' : 'border-slate-500'}`} />
        <span className={`h-0.5 w-full ${energized ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.45)]' : idleWire}`} />
      </div>
      <div className="mt-1 max-w-full truncate text-center text-[9px] leading-tight text-slate-400">{label}</div>
    </div>
  );
}

function Compare({ address, label, expression, energized }: { address: string; label: string; expression: string; energized: boolean }) {
  return (
    <div className="flex w-[94px] flex-shrink-0 flex-col items-center">
      <div className={`mb-1 max-w-full truncate font-mono text-[10px] font-bold ${energized ? 'text-cyan-200' : 'text-slate-300'}`}>{address}</div>
      <div className={`flex h-10 w-20 flex-col items-center justify-center rounded-sm border-2 font-mono text-[10px] font-bold leading-tight transition-colors ${energized ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.28)]' : 'border-slate-500 text-slate-300'}`}>
        <span>==I</span>
        <span>{expression}</span>
      </div>
      <div className="mt-1 max-w-full truncate text-center text-[9px] leading-tight text-slate-400">{label}</div>
    </div>
  );
}

function MoveBlock({ inValue, outAddress, label, energized }: { inValue: number; outAddress: string; label: string; energized: boolean }) {
  return (
    <div className="flex w-[104px] flex-shrink-0 flex-col items-center">
      <div className={`mb-1 max-w-full truncate font-mono text-[10px] font-bold ${energized ? 'text-cyan-200' : 'text-slate-300'}`}>MOVE</div>
      <div className={`grid h-12 w-24 grid-cols-[1fr_auto] grid-rows-2 items-center rounded-sm border-2 px-2 font-mono text-[10px] font-bold leading-tight transition-colors ${energized ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.28)]' : 'border-slate-500 text-slate-300'}`}>
        <span>IN</span>
        <span>{inValue}</span>
        <span>OUT</span>
        <span>{outAddress}</span>
      </div>
      <div className="mt-1 max-w-full truncate text-center text-[9px] leading-tight text-slate-400">{label}</div>
    </div>
  );
}

function Branch({
  entryActive,
  top,
  topActive,
  bottom,
  bottomActive,
}: {
  entryActive: boolean;
  top: ReactNode;
  topActive: boolean;
  bottom: ReactNode;
  bottomActive: boolean;
}) {
  const exitActive = topActive || bottomActive;

  return (
    <div className="relative flex h-[106px] w-[120px] flex-shrink-0 items-center justify-center">
      <span className={`absolute left-0 top-[34px] h-0.5 w-5 ${entryActive ? activeWire : idleWire}`} />
      <span className={`absolute left-5 top-[34px] h-[38px] w-0.5 ${entryActive ? activeWire : idleWire}`} />
      <span className={`absolute right-0 top-[34px] h-[38px] w-0.5 ${exitActive ? activeWire : idleWire}`} />
      <span className={`absolute right-0 top-[34px] h-0.5 w-5 ${topActive ? activeWire : idleWire}`} />
      <span className={`absolute right-0 top-[72px] h-0.5 w-5 ${bottomActive ? activeWire : idleWire}`} />
      <div className="absolute left-4 top-0 flex items-center">
        <Wire active={entryActive} className="w-4" />
        {top}
        <Wire active={topActive} className="w-4" />
      </div>
      <div className="absolute left-4 top-[38px] flex items-center">
        <Wire active={entryActive} className="w-4" />
        {bottom}
        <Wire active={bottomActive} className="w-4" />
      </div>
    </div>
  );
}
