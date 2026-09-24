import { useState } from 'react';
import { FlaskConical, MonitorPlay } from 'lucide-react';
import { PLCLab } from '@/components/lab/PLCLab';
import { LegacySimulator } from '@/components/LegacySimulator';

type Workspace = 'lab' | 'legacy';

/**
 * A aplicação tem duas áreas:
 *   - PLC Lab (novo): laboratório interativo com comunicação PLC, monitor de
 *     variáveis, simulação 2D, timers/counters/steps, diagnóstico e projetos;
 *   - Ex6 (legacy): a interface original do simulador, intacta e funcional.
 */
function App() {
  const [workspace, setWorkspace] = useState<Workspace>('lab');

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Comutador de área de trabalho */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Área de trabalho</span>
        <button
          type="button"
          onClick={() => setWorkspace('lab')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-bold transition ${
            workspace === 'lab' ? 'bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-600' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <FlaskConical className="h-3 w-3" />
          PLC Lab
        </button>
        <button
          type="button"
          onClick={() => setWorkspace('legacy')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-bold transition ${
            workspace === 'legacy' ? 'bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-600' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MonitorPlay className="h-3 w-3" />
          Ex6 (legacy)
        </button>
      </div>

      {workspace === 'lab' ? <PLCLab /> : <LegacySimulator />}
    </div>
  );
}

export default App;
