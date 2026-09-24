/**
 * Sistema de projetos de simulação + editor da tabela de variáveis.
 *
 * Cada projeto guarda configuração de PLC, variáveis, componentes, mapeamentos,
 * etapas e definições — permitindo fechar e reabrir a aplicação sem perder a
 * montagem (persistência em localStorage).
 */

import { useMemo, useState } from 'react';
import { Copy, Download, FolderOpen, Plus, Trash2, Upload } from 'lucide-react';
import type { PLCDataType, PLCVariableCategory, PLCVariableDefinition } from '@/plc';
import { isValidAddress, parseAddress } from '@/plc';
import type { SimulationProject } from '@/simulation/scene';
import { projectToMappingJson } from '@/config/defaultProject';

interface ProjectsPanelProps {
  project: SimulationProject;
  projects: SimulationProject[];
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: () => void;
  onExportProject: () => string;
  onImportProject: (text: string) => void;
  onUpdateProject: (patch: Partial<SimulationProject>) => void;
  onSetVariables: (variables: PLCVariableDefinition[]) => void;
  onResetVariables: () => void;
}

const CATEGORIES: PLCVariableCategory[] = [
  'INPUTS',
  'OUTPUTS',
  'MEMORY',
  'DB',
  'ANALOG',
  'TIMERS',
  'COUNTERS',
  'STEPS',
  'SYSTEM',
];

const DATA_TYPES: PLCDataType[] = ['BOOL', 'BYTE', 'WORD', 'DWORD', 'INT', 'DINT', 'REAL'];

export function ProjectsPanel({
  project,
  projects,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onImportProject,
  onUpdateProject,
  onSetVariables,
  onResetVariables,
}: ProjectsPanelProps) {
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [showMapping, setShowMapping] = useState(false);

  const mapping = useMemo(() => JSON.stringify(projectToMappingJson(project), null, 2), [project]);

  const updateVariable = (id: string, patch: Partial<PLCVariableDefinition>) => {
    onSetVariables(project.variables.map((variable) => (variable.id === id ? { ...variable, ...patch } : variable)));
  };

  const addVariable = () => {
    const id = `var-${Date.now().toString(36)}`;
    onSetVariables([
      ...project.variables,
      {
        id,
        address: 'M20.0',
        name: 'NOVA_VAR',
        dataType: 'BOOL',
        category: 'MEMORY',
        writable: true,
      },
    ]);
  };

  const removeVariable = (id: string) => onSetVariables(project.variables.filter((variable) => variable.id !== id));

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Lista de projetos */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-4 xl:col-span-4">
        <div className="mb-3 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Simulation projects</h3>
        </div>

        <div className="space-y-1.5">
          {projects.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectProject(item.id)}
              className={`flex w-full items-start gap-2 rounded border p-2 text-left transition ${
                item.id === project.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[11px] font-semibold ${item.id === project.id ? 'text-white' : 'text-slate-300'}`}>
                  {item.name}
                </div>
                <div className="truncate text-[9px] text-slate-500">
                  {item.components.length} componentes · {item.variables.length} variáveis · {item.plc.providerId}
                </div>
              </div>
              {projects.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteProject(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onDeleteProject(item.id);
                  }}
                  className="rounded p-1 text-slate-500 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nome do novo projeto"
            className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={() => {
              onCreateProject(newName.trim() || 'Novo projeto');
              setNewName('');
            }}
            className="flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-cyan-500"
          >
            <Plus className="h-3 w-3" /> Criar
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDuplicateProject}
            className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-600"
          >
            <Copy className="h-3 w-3" /> Duplicar
          </button>
          <button
            type="button"
            onClick={() => download(onExportProject(), `${project.name.replace(/\s+/g, '-').toLowerCase()}.json`)}
            className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-600"
          >
            <Download className="h-3 w-3" /> Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => download(mapping, `${project.name.replace(/\s+/g, '-').toLowerCase()}-mapping.json`)}
            className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-600"
          >
            <Download className="h-3 w-3" /> Exportar mapeamento
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={3}
            placeholder="Cole aqui o JSON de um projeto para importar…"
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-100 outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={() => {
              if (importText.trim()) {
                onImportProject(importText);
                setImportText('');
              }
            }}
            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-100 transition hover:bg-slate-600"
          >
            <Upload className="h-3 w-3" /> Importar projeto
          </button>
        </div>
      </section>

      {/* Propriedades do projeto + tabela de variáveis */}
      <section className="space-y-4 xl:col-span-8">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-300">Propriedades do projeto</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nome</span>
              <input
                value={project.name}
                onChange={(event) => onUpdateProject({ name: event.target.value })}
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Descrição</span>
              <input
                value={project.description || ''}
                onChange={(event) => onUpdateProject({ description: event.target.value })}
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={project.settings.showGrid}
                onChange={(event) => onUpdateProject({ settings: { ...project.settings, showGrid: event.target.checked } })}
                className="accent-cyan-500"
              />
              Mostrar grelha
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={project.settings.autostart}
                onChange={(event) => onUpdateProject({ settings: { ...project.settings, autostart: event.target.checked } })}
                className="accent-cyan-500"
              />
              Ligar automaticamente ao abrir
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={project.settings.highlightChanges}
                onChange={(event) =>
                  onUpdateProject({ settings: { ...project.settings, highlightChanges: event.target.checked } })
                }
                className="accent-cyan-500"
              />
              Destacar alterações
            </label>
          </div>
          <p className="mt-2 font-mono text-[9px] text-slate-500">
            criado {new Date(project.createdAt).toLocaleString()} · atualizado {new Date(project.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Tabela de variáveis</h3>
            <span className="text-[10px] text-slate-500">{project.variables.length} variável(is)</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={addVariable}
                className="flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-cyan-500"
              >
                <Plus className="h-3 w-3" /> Variável
              </button>
              <button
                type="button"
                onClick={onResetVariables}
                className="rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-amber-600 hover:text-amber-300"
              >
                Repor por omissão
              </button>
            </div>
          </div>

          <div className="custom-scrollbar max-h-[420px] overflow-auto">
            <table className="w-full min-w-max text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-900 text-[9px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-1.5">Endereço</th>
                  <th className="px-2 py-1.5">Nome</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Categoria</th>
                  <th className="px-2 py-1.5">Escrita</th>
                  <th className="px-2 py-1.5">Comentário</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {project.variables.map((variable) => {
                  const parsed = parseAddress(variable.address);
                  const valid = isValidAddress(variable.address);
                  return (
                    <tr key={variable.id} className="border-b border-slate-700/60">
                      <td className="px-2 py-1">
                        <input
                          value={variable.address}
                          onChange={(event) => updateVariable(variable.id, { address: event.target.value.toUpperCase() })}
                          className={`w-28 rounded border bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] outline-none ${
                            valid ? 'border-slate-600 text-cyan-300 focus:border-cyan-500' : 'border-amber-600 text-amber-300'
                          }`}
                        />
                        <div className="font-mono text-[8px] text-slate-500">
                          {parsed ? `${parsed.area}${parsed.dbNumber !== null ? `:${parsed.dbNumber}` : ''}` : 'inválido'}
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={variable.name}
                          onChange={(event) => updateVariable(variable.id, { name: event.target.value })}
                          className="w-32 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-100 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={variable.dataType}
                          onChange={(event) => updateVariable(variable.id, { dataType: event.target.value as PLCDataType })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-cyan-500"
                        >
                          {DATA_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={variable.category}
                          onChange={(event) => updateVariable(variable.id, { category: event.target.value as PLCVariableCategory })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-100 outline-none focus:border-cyan-500"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={variable.writable}
                          onChange={(event) => updateVariable(variable.id, { writable: event.target.checked })}
                          className="accent-cyan-500"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={variable.comment || ''}
                          onChange={(event) => updateVariable(variable.id, { comment: event.target.value })}
                          className="w-56 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => removeVariable(variable.id)}
                          className="rounded p-1 text-slate-500 transition hover:text-red-400"
                          aria-label={`Remover ${variable.address}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <button
            type="button"
            onClick={() => setShowMapping((current) => !current)}
            className="text-xs font-bold uppercase tracking-wide text-slate-300"
          >
            {showMapping ? '▾' : '▸'} Mapeamento exportado (JSON)
          </button>
          {showMapping && (
            <pre className="mt-2 max-h-64 overflow-auto rounded border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300">
              {mapping}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
