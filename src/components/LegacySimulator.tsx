/**
 * Interface legacy da aplicação (Ex6 — motor D/E com KM1/KM2).
 *
 * Preservada integralmente: os mesmos painéis, a mesma lógica de varrimento
 * (`usePLCSync`) e o mesmo bridge local (:8765). Só é montada quando o
 * utilizador abre este separador, para não consumir comunicação sem necessidade.
 */

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

export function LegacySimulator() {
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
    <div className="flex min-h-screen flex-col bg-slate-950">
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

      <main className="flex-1 overflow-auto p-4">
        <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-4">
          <div className="col-span-12 space-y-4 lg:col-span-3">
            <CPUStatus state={state} />
            <SimulatorConfigPanel config={simulatorConfig} onConfigChange={updateConfig} />
            <InputPanel state={state} tags={simulatorConfig.inputTags} />
            <MemoryPanel state={state} />
          </div>

          <div className="col-span-12 space-y-4 lg:col-span-6">
            <ProcessAnimation state={state} />
            <LadderDiagram state={state} />
          </div>

          <div className="col-span-12 space-y-4 lg:col-span-3">
            <OutputPanel state={state} tags={simulatorConfig.outputTags} />
            <ConnectionPanel connectionStatus={connectionStatus} config={simulatorConfig} />
            <EventLog events={events} />
            <Legend />
          </div>
        </div>
      </main>

      <footer className="flex flex-col gap-1 border-t border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="min-w-0 break-all">
          {simulatorConfig.profileName} &middot; Local bridge: {simulatorConfig.bridgeEndpoint}
        </span>
        <span className="shrink-0">
          Scan: {simulatorConfig.scanIntervalMs}ms &middot; KM1: {state.relayK1 ? 'ON' : 'OFF'} &middot; KM2:{' '}
          {state.relayK2 ? 'ON' : 'OFF'} &middot; Source: {state.source}
        </span>
      </footer>
    </div>
  );
}
