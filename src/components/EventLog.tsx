import { ScrollText } from 'lucide-react';

interface EventLogProps {
  events: { id: number; eventType: string; source: string; createdAt: string }[];
}

export function EventLog({ events }: EventLogProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Event Log</h3>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
        {events.length === 0 ? (
          <p className="text-[10px] text-slate-500 text-center py-4">No events recorded yet</p>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 bg-slate-900/50 rounded px-2 py-1.5 text-[10px]">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                ev.source === 'tia-portal' ? 'bg-orange-400' : 'bg-cyan-400'
              }`} />
              <span className="text-slate-300 font-mono">{ev.eventType}</span>
              <span className={`font-semibold ${ev.source === 'tia-portal' ? 'text-orange-400' : 'text-cyan-400'}`}>
                {ev.source}
              </span>
              <span className="text-slate-500 ml-auto">
                {new Date(ev.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
