import { useState } from 'react';
import { Plug, Copy, Check, ExternalLink, Code } from 'lucide-react';
import type { ConnectionStatus } from '@/types/plc';

interface ConnectionPanelProps {
  connectionStatus: ConnectionStatus;
}

export function ConnectionPanel({ connectionStatus }: ConnectionPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const bridgeUrl = `${supabaseUrl}/functions/v1/tia-bridge`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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

  const codeSnippet = `// TIA Portal Bridge - Python example
// pip install requests
import requests, json, time

BRIDGE_URL = "${bridgeUrl}"
HEADERS = {
    "Authorization": "Bearer ${anonKey}",
    "Content-Type": "application/json",
}

# Read PLC state
resp = requests.get(f"{BRIDGE_URL}/state", headers=HEADERS)
plc_state = resp.json()
print(f"CPU RUN: {plc_state.get('run')}")
print(f"Outputs: {plc_state.get('outputs')}")

# Write to PLC (e.g. press Start)
requests.put(f"{BRIDGE_URL}/update", headers=HEADERS,
    json={"start_pressed": True, "source": "tia-portal"})
time.sleep(0.3)
requests.put(f"{BRIDGE_URL}/update", headers=HEADERS,
    json={"start_pressed": False})`;

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
            Use this bridge to connect TIA Portal with the simulator. The S7-PLCSIM or TIA Portal script can
            poll <code className="text-cyan-300">GET /state</code> and push changes via
            <code className="text-cyan-300"> PUT /update</code>. All changes sync in real-time through Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
