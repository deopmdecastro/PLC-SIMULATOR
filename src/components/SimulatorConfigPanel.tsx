import { Link2, RotateCcw, Settings2, Tags, Timer } from 'lucide-react';
import { DEFAULT_SIMULATOR_CONFIG } from '@/types/plc';
import type { SimulatorConfig } from '@/types/plc';

interface SimulatorConfigPanelProps {
  config: SimulatorConfig;
  onConfigChange: (config: SimulatorConfig) => void;
}

type TagGroup = 'inputTags' | 'outputTags';

const inputBaseClass =
  'w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[11px] text-slate-200 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/60';

function clampScanInterval(value: number) {
  return Math.min(5000, Math.max(100, value));
}

function tagToLabel(tag: { address: string; label: string }) {
  return `${tag.address} ${tag.label}`.trim();
}

export function SimulatorConfigPanel({ config, onConfigChange }: SimulatorConfigPanelProps) {
  const updateConfig = (patch: Partial<SimulatorConfig>) => {
    onConfigChange({ ...config, ...patch });
  };

  const updateTag = (group: TagGroup, index: number, label: string) => {
    const nextTags = config[group].map((tag, tagIndex) =>
      tagIndex === index ? { ...tag, label } : tag,
    );
    const labelsGroup = group === 'inputTags' ? 'inputLabels' : 'outputLabels';
    updateConfig({
      [group]: nextTags,
      [labelsGroup]: nextTags.map(tagToLabel),
    } as Partial<SimulatorConfig>);
  };

  const renderTagRows = (group: TagGroup, activeCount: number) => (
    <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {config[group].map((tag, index) => (
        <label key={tag.address} className="grid grid-cols-[3rem_1fr] items-center gap-2">
          <span
            className={`font-mono text-[10px] font-bold ${
              index < activeCount ? 'text-cyan-300' : 'text-slate-500'
            }`}
          >
            {tag.address}
          </span>
          <input
            value={tag.label}
            onChange={(event) => updateTag(group, index, event.target.value)}
            className={inputBaseClass}
            aria-label={`${tag.address} label`}
          />
        </label>
      ))}
    </div>
  );

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-cyan-400" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">
          Simulator Config
        </h3>
        <button
          type="button"
          onClick={() => onConfigChange(DEFAULT_SIMULATOR_CONFIG)}
          className="ml-auto rounded border border-slate-700 bg-slate-900/70 p-1.5 text-slate-400 transition hover:border-cyan-700 hover:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          aria-label="Reset simulator configuration"
          title="Reset configuration"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Profile</span>
            <input
              value={config.profileName}
              onChange={(event) => updateConfig({ profileName: event.target.value })}
              className={inputBaseClass}
              aria-label="Reusable simulator profile name"
            />
          </label>

          <label className="space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-400">
              <Link2 className="h-3 w-3 text-slate-500" />
              Local Bridge
            </span>
            <input
              value={config.bridgeEndpoint}
              onChange={(event) => updateConfig({ bridgeEndpoint: event.target.value })}
              className={`${inputBaseClass} font-mono`}
              aria-label="Bridge endpoint URL"
            />
          </label>

          <label className="space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-400">
              <Timer className="h-3 w-3 text-slate-500" />
              Scan Interval
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                max={5000}
                step={50}
                value={config.scanIntervalMs}
                onChange={(event) =>
                  updateConfig({ scanIntervalMs: clampScanInterval(Number(event.target.value) || 100) })
                }
                className={`${inputBaseClass} font-mono`}
                aria-label="Scan interval in milliseconds"
              />
              <span className="w-8 text-[10px] font-semibold text-slate-500">ms</span>
            </div>
          </label>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Tags className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase text-slate-400">Input Tags</span>
          </div>
          {renderTagRows('inputTags', 4)}
        </div>

        <div className="border-t border-slate-700 pt-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Tags className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-semibold uppercase text-slate-400">Output Tags</span>
          </div>
          {renderTagRows('outputTags', 2)}
        </div>
      </div>
    </section>
  );
}
