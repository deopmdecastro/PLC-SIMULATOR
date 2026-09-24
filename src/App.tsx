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
import { SimulatorConfigPanel } from '@/components/SimulatorConfigPanel';
import { usePLCSync } from '@/hooks/usePLCSync';

function App() {
  const {
    state,
    config: simulatorConfig,
    connectionStatus,
    events,
    toggleRun,
    pulseStartD,
    pulseStartE,
    setStopNf,
    setFrNf,
    resetFaults,
    resetCycles,
    updateConfig,
  } = usePLCSync();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <TitleBar state={state} connectionStatus={connectionStatus} />
      <Toolbar
        state={state}
        connectionStatus={connectionStatus}
        onToggleRun={toggleRun}
        onPulseStartD={pulseStartD}
        onPulseStartE={pulseStartE}
        onSetStopNf={setStopNf}
        onSetFrNf={setFrNf}
        onResetFaults={resetFaults}
        onResetCycles={resetCycles}
      />

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4">
          {/* Left column: CPU + Inputs + Memory */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <CPUStatus state={state} />
            <SimulatorConfigPanel config={simulatorConfig} onConfigChange={updateConfig} />
            <InputPanel state={state} tags={simulatorConfig.inputTags} />
            <MemoryPanel state={state} />
          </div>

          {/* Center column: Process animation + Ladder diagram */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <ProcessAnimation state={state} />
            <LadderDiagram state={state} />
          </div>

          {/* Right column: Outputs + Connection + Event log + Legend */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <OutputPanel state={state} tags={simulatorConfig.outputTags} />
            <ConnectionPanel connectionStatus={connectionStatus} config={simulatorConfig} />
            <EventLog events={events} />
            <Legend />
          </div>
        </div>
      </main>

      <footer className="flex flex-col gap-1 bg-slate-900 border-t border-slate-700 px-4 py-2 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="min-w-0 break-all">{simulatorConfig.profileName} &middot; Local bridge: {simulatorConfig.bridgeEndpoint}</span>
        <span className="shrink-0">Scan: {simulatorConfig.scanIntervalMs}ms &middot; KM1: {state.relayK1 ? 'ON' : 'OFF'} &middot; KM2: {state.relayK2 ? 'ON' : 'OFF'} &middot; Source: {state.source}</span>
      </footer>
    </div>
  );
}

export default App;
