import { Info } from 'lucide-react';

export function Legend() {
  const items = [
    { color: 'bg-emerald-500', label: 'Energized / Active (Input, Run, Motor)' },
    { color: 'bg-cyan-500', label: 'Output Active (Q0.x coil energized)' },
    { color: 'bg-orange-500', label: 'Memory Bit / Marker Active (M0.x)' },
    { color: 'bg-amber-500', label: 'Warning / Fault / Standby' },
    { color: 'bg-red-500', label: 'Fault / Stop / Error' },
    { color: 'bg-slate-700', label: 'Inactive / Off' },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Legend</h3>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
            <span className="text-[10px] text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
