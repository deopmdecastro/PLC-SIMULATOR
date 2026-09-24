import { useState } from 'react';
import { Plug, Copy, Check, ExternalLink, Code } from 'lucide-react';
import type { ConnectionStatus, SimulatorConfig } from '@/types/plc';

interface ConnectionPanelProps {
  connectionStatus: ConnectionStatus;
  config: SimulatorConfig;
}

export function ConnectionPanel({ connectionStatus, config }: ConnectionPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const bridgeUrl = config.bridgeEndpoint || 'http://127.0.0.1:8765';

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoints = [
    { method: 'GET', path: '/state', desc: 'Read current PLC state (TIA Portal polls this)' },
    { method: 'PUT', path: '/update', desc: 'Write PLC state from TIA Portal' },
    { method: 'GET', path: '/events?limit=20', desc: 'Read recent event log' },
    { method: 'GET', path: '/health', desc: 'Health check' },
  ];

  const codeSnippet = `# TIA Portal Bridge - local simulator
python tia_bridge.py --endpoint ${bridgeUrl}

# REST example from a TIA script/client:
# GET  ${bridgeUrl}/state
# PUT  ${bridgeUrl}/update
# Body {"source":"tia-portal","tags":{"I0.0":true,"I0.2":true,"I0.3":true,"Q0.0":true,"MW100":1}}`;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Plug className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">TIA Portal Bridge</h3>
        <div className={`ml-auto flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          connectionStatus === 'connected'
            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
            : connectionStatus === 'connecting'
              ? 'bg-amber-900/50 text-amber-400 border border-amber-700'
              : 'bg-red-900/50 text-red-400 border border-red-700'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
          }`} />
          {connectionStatus.toUpperCase()}
        </div>
      </div>

      <div className="space-y-3">
        {/* Bridge URL */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase font-semibold">Bridge Endpoint</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-[10px] text-cyan-300 bg-slate-900/70 rounded px-2 py-1.5 font-mono overflow-x-auto whitespace-nowrap">
              {bridgeUrl}
            </code>
            <button onClick={() => copy(bridgeUrl, 'url')} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
              {copied === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* Endpoints */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase font-semibold">API Endpoints</label>
          <div className="mt-1 space-y-1">
            {endpoints.map((ep) => (
              <div key={ep.path} className="flex items-center gap-2 bg-slate-900/50 rounded px-2 py-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  ep.method === 'GET' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-orange-900/50 text-orange-400'
                }`}>
                  {ep.method}
                </span>
                <code className="text-[10px] text-cyan-300 font-mono">{ep.path}</code>
                <span className="text-[9px] text-slate-500 ml-auto truncate">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code snippet */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Code className="w-3 h-3 text-slate-400" />
            <label className="text-[10px] text-slate-400 uppercase font-semibold">Python Integration Example</label>
          </div>
          <div className="relative">
            <pre className="text-[9px] text-slate-300 bg-slate-950 rounded-lg p-3 overflow-x-auto max-h-48 font-mono leading-relaxed border border-slate-700">
              {codeSnippet}
            </pre>
            <button
              onClick={() => copy(codeSnippet, 'code')}
              className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              {copied === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-300" />}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-cyan-900/20 border border-cyan-800/50 rounded-lg p-2.5">
          <ExternalLink className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-300 leading-relaxed">
            Use this local bridge to connect TIA Portal scripts or external test clients with the simulator. The client can
            poll <code className="text-cyan-300">GET /state</code> and push changes via
            <code className="text-cyan-300"> PUT /update</code>. Start it with <code className="text-cyan-300">npm run bridge</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
