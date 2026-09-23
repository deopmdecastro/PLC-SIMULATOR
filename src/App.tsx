import { TitleBar } from '@/components/TitleBar';
import { Toolbar } from '@/components/Toolbar';
import { CPUStatus } from '@/components/CPUStatus';
import { InputPanel, OutputPanel } from '@/components/IOPanels';
import { MemoryPanel } from '@/components/MemoryPanel';
import { LadderDiagram } from '@/components/LadderDiagram';
import { ProcessAnimation } from '@/components/ProcessAnimation';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { EventLog } from '@/components/EventLog';
import { Legend } from '@/components/Legend';
import { usePLCSync } from '@/hooks/usePLCSync';

function App() {
  const {
    state,
    connectionStatus,
    events,
    toggleRun,
    toggleAuto,
    pulseStart,
    setStop,
    resetFaults,
    resetCycles,
  } = usePLCSync({ scanIntervalMs: 500 });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <TitleBar state={state} connectionStatus={connectionStatus} />
      <Toolbar
        state={state}
        connectionStatus={connectionStatus}
        onToggleRun={toggleRun}
        onToggleAuto={toggleAuto}
        onPulseStart={pulseStart}
        onSetStop={setStop}
        onResetFaults={resetFaults}
        onResetCycles={resetCycles}
      />

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4">
          {/* Left column: CPU + Inputs + Memory */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <CPUStatus state={state} />
            <InputPanel state={state} />
            <MemoryPanel state={state} />
          </div>

          {/* Center column: Process animation + Ladder diagram */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <ProcessAnimation state={state} />
            <LadderDiagram state={state} />
          </div>

          {/* Right column: Outputs + Connection + Event log + Legend */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <OutputPanel state={state} />
            <ConnectionPanel connectionStatus={connectionStatus} />
            <EventLog events={events} />
            <Legend />
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-700 px-6 py-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>S7-1200 PLC Simulator &middot; Real-time TIA Portal Bridge via Supabase</span>
        <span>Scan: 500ms &middot; Mode: {state.autoMode ? 'AUTO' : 'MANUAL'} &middot; Source: {state.source}</span>
      </footer>
    </div>
  );
}

export default App;
