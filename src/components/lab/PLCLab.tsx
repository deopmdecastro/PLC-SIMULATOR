/**
 * PLC Lab — shell do laboratório interativo.
 *
 * Reúne Dashboard, Simulação 2D, Monitor de variáveis, Processo
 * (timers/counters/steps), Diagnóstico e Projetos. A aba "Ex6 (legacy)"
 * preserva a interface original da aplicação.
 */

import { useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  Folder,
  Gauge,
  Layers,
  ListOrdered,
  Table2,
} from 'lucide-react';
import type { PLCVariableDefinition, PLCValue } from '@/plc';
import type { SimulationComponent } from '@/simulation/scene';
import { usePLCLab } from '@/hooks/usePLCLab';
import { Dashboard } from './Dashboard';
import { SimulationEditor } from './SimulationEditor';
import { VariablePanels } from './VariablePanels';
import { ProcessPanels } from './ProcessPanels';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ProjectsPanel } from './ProjectsPanel';

type LabTab = 'dashboard' | 'simulation' | 'variables' | 'process' | 'diagnostics' | 'projects';

const TABS: { id: LabTab; label: string; icon: typeof Gauge }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'simulation', label: 'Simulação 2D', icon: Layers },
  { id: 'variables', label: 'Variáveis', icon: Table2 },
  { id: 'process', label: 'Timers / Steps', icon: ListOrdered },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
  { id: 'projects', label: 'Projetos', icon: Folder },
];

const EMPTY_INFO: import('@/plc').PLCConnectionInfo = {
  status: 'disconnected',
  providerId: 'mock',
  providerLabel: '—',
  plcName: '—',
  cpu: '—',
  ip: '—',
  rack: 0,
  slot: 0,
  mode: 'UNKNOWN',
  cycleTimeMs: null,
  latencyMs: null,
  lastUpdate: null,
  readCount: 0,
  writeCount: 0,
  errorCount: 0,
  message: '',
};

export function PLCLab() {
  const lab = usePLCLab();
  const [tab, setTab] = useState<LabTab>('dashboard');

  const info = lab.snapshot?.info ?? EMPTY_INFO;
  const connected = info.status === 'connected';

  /** Etapa ativa lida da variável configurada (ex.: MW100). */
  const activeStep = useMemo(() => {
    const variable = lab.project.variables.find(
      (item) => item.address.toUpperCase() === lab.project.stepsVariableAddress.toUpperCase(),
    );
    if (!variable) return null;
    const value = lab.values[variable.id]?.value;
    return typeof value === 'number' ? Math.round(value) : null;
  }, [lab.project.stepsVariableAddress, lab.project.variables, lab.values]);

  const handleWrite = (address: string, value: boolean | number) => {
    void lab.writeVariable(address, value as PLCValue);
  };

  const handleToggle = (definition: PLCVariableDefinition) => {
    void lab.toggleVariable(definition);
  };

  const handleFocusAddress = (address: string) => {
    setTab('simulation');
    lab.logUser('info', `Foco no endereço ${address}`, 'Abra as propriedades do componente associado para editar o mapeamento.');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-cyan-400" />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">PLC-SIMULATOR · LABORATÓRIO</h1>
            <p className="text-[10px] text-slate-400">
              HMI/SCADA + simulação 2D · TIA Portal / PLCSIM
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? 'animate-pulse bg-emerald-400' : info.status === 'connecting' ? 'bg-amber-400' : 'bg-red-500'
              }`}
            />
            <span className={connected ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
              {connected ? 'PLC CONECTADO' : info.status === 'connecting' ? 'CONECTANDO' : 'PLC DESCONECTADO'}
            </span>
          </span>
          <span className="text-slate-400">
            Modo: <span className={info.mode === 'RUN' ? 'font-mono text-emerald-400' : 'font-mono text-amber-400'}>{info.mode}</span>
          </span>
          <span className="text-slate-400">
            Ciclo: <span className="font-mono text-cyan-300">{lab.project.plc.scanIntervalMs} ms</span>
          </span>
          <span className="text-slate-400">
            Etapa: <span className="font-mono text-cyan-300">{activeStep ?? '—'}</span>
          </span>
          {lab.busy && <span className="text-amber-400">a comunicar…</span>}
        </div>
      </header>

      {/* Separadores */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-700 bg-slate-900/60 px-3 py-2 sm:px-4">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition ${
                tab === item.id
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[1800px]">
          {tab === 'dashboard' && (
            <Dashboard
              info={info}
              values={lab.values}
              variables={lab.project.variables}
              project={lab.project}
              diagnostics={lab.diagnostics}
              onSetCpuMode={(action) => void lab.setCpuMode(action)}
              onConnect={() => void lab.connect()}
              onDiscover={() => void lab.autoDiscover()}
              busy={lab.busy}
            />
          )}

          {tab === 'simulation' && (
            <SimulationEditor
              project={lab.project}
              values={lab.values}
              variables={lab.project.variables}
              onAddComponent={(component: SimulationComponent) => lab.addComponent(component)}
              onUpdateComponent={lab.updateComponent}
              onRemoveComponent={lab.removeComponent}
              onWrite={handleWrite}
              onPulse={(address, active) => void lab.pulseVariable(address, active)}
              onSaveProject={() => lab.logUser('success', 'Projeto guardado', lab.project.name)}
            />
          )}

          {tab === 'variables' && (
            <VariablePanels
              variables={lab.project.variables}
              values={lab.values}
              onToggle={handleToggle}
              onWriteAnalog={(definition, value) => void lab.setAnalogVariable(definition, value)}
              onFocusAddress={handleFocusAddress}
            />
          )}

          {tab === 'process' && (
            <ProcessPanels
              project={lab.project}
              variables={lab.project.variables}
              values={lab.values}
              activeStep={activeStep}
              onSetStepsVariable={(address) => lab.updateProject({ stepsVariableAddress: address })}
              onUpdateStepLabel={(step, label) =>
                lab.updateProject({
                  steps: lab.project.steps.map((item) => (item.step === step ? { ...item, label } : item)),
                })
              }
              onAddStep={() => {
                const next = lab.project.steps.reduce((max, item) => Math.max(max, item.step), -1) + 1;
                lab.updateProject({
                  steps: [...lab.project.steps, { step: next, label: `STEP ${next}`, description: 'Etapa nova' }],
                });
              }}
              onRemoveStep={(step) =>
                lab.updateProject({ steps: lab.project.steps.filter((item) => item.step !== step) })
              }
            />
          )}

          {tab === 'diagnostics' && (
            <DiagnosticsPanel
              project={lab.project}
              info={info}
              diagnostics={lab.diagnostics}
              discovery={lab.discovery}
              lastError={lab.lastError}
              busy={lab.busy}
              onUpdatePlcConfig={(patch) => void lab.updatePlcConfig(patch)}
              onConnect={() => void lab.connect()}
              onDisconnect={() => void lab.disconnect()}
              onDiscover={() => void lab.autoDiscover()}
              onClear={lab.clearDiagnostics}
            />
          )}

          {tab === 'projects' && (
            <ProjectsPanel
              project={lab.project}
              projects={lab.projects}
              onSelectProject={lab.selectProject}
              onCreateProject={lab.createProject}
              onDeleteProject={lab.deleteProject}
              onDuplicateProject={lab.duplicateActiveProject}
              onExportProject={lab.exportActiveProject}
              onImportProject={lab.importProject}
              onUpdateProject={lab.updateProject}
              onSetVariables={lab.setVariables}
              onResetVariables={lab.resetVariables}
            />
          )}
        </div>
      </main>

      <footer className="flex flex-col gap-1 border-t border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="min-w-0 break-all">
          {lab.project.name} · provider: {info.providerLabel} · gateway: {lab.project.plc.gatewayUrl}
        </span>
        <span className="shrink-0">
          {lab.project.components.length} componentes · {lab.project.variables.length} variáveis · latência{' '}
          {info.latencyMs !== null ? `${info.latencyMs.toFixed(1)} ms` : '—'}
        </span>
      </footer>
    </div>
  );
}
