/**
 * Persistência de projetos de simulação.
 *
 * Guarda tudo o que o utilizador montou — configuração de PLC, variáveis,
 * componentes, mapeamentos, etapas e definições — para que possa fechar a
 * aplicação e voltar a encontrar a mesma montagem.
 */

import type { SimulationProject } from '@/simulation/scene';
import { createDefaultProject, DEFAULT_COMPONENTS, DEFAULT_VARIABLES } from './defaultProject';

const STORAGE_KEY = 'plc-simulator.projects.v1';
const ACTIVE_KEY = 'plc-simulator.active-project.v1';

export interface ProjectsState {
  projects: SimulationProject[];
  activeId: string;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeProject(input: Partial<SimulationProject>): SimulationProject {
  const base = createDefaultProject(input.name || 'Projeto de simulação');
  return {
    ...base,
    ...input,
    id: input.id || base.id,
    plc: { ...base.plc, ...(input.plc || {}) },
    variables: input.variables?.length ? input.variables : DEFAULT_VARIABLES,
    components: input.components ?? DEFAULT_COMPONENTS,
    steps: input.steps?.length ? input.steps : base.steps,
    settings: { ...base.settings, ...(input.settings || {}) },
    stepsVariableAddress: input.stepsVariableAddress || base.stepsVariableAddress,
    createdAt: input.createdAt || base.createdAt,
    updatedAt: input.updatedAt || base.updatedAt,
  };
}

export function loadProjectsState(): ProjectsState {
  const storage = safeStorage();
  if (!storage) {
    const project = createDefaultProject();
    return { projects: [project], activeId: project.id };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    const activeId = storage.getItem(ACTIVE_KEY);
    if (!raw) {
      const project = createDefaultProject();
      storage.setItem(STORAGE_KEY, JSON.stringify([project]));
      storage.setItem(ACTIVE_KEY, project.id);
      return { projects: [project], activeId: project.id };
    }
    const parsed = JSON.parse(raw) as Partial<SimulationProject>[];
    const projects = (Array.isArray(parsed) ? parsed : []).map(normalizeProject);
    if (projects.length === 0) {
      const project = createDefaultProject();
      return { projects: [project], activeId: project.id };
    }
    const resolvedActive = projects.some((project) => project.id === activeId) ? activeId! : projects[0].id;
    return { projects, activeId: resolvedActive };
  } catch {
    const project = createDefaultProject();
    return { projects: [project], activeId: project.id };
  }
}

export function persistProjectsState(state: ProjectsState): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
    storage.setItem(ACTIVE_KEY, state.activeId);
  } catch {
    /* quota excedida ou modo privado — a aplicação continua a funcionar em memória */
  }
}

export function exportProjectJson(project: SimulationProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectJson(text: string): SimulationProject {
  const parsed = JSON.parse(text) as Partial<SimulationProject>;
  return normalizeProject({ ...parsed, id: `project-${Date.now()}` });
}

export function duplicateProject(project: SimulationProject): SimulationProject {
  return normalizeProject({
    ...project,
    id: `project-${Date.now()}`,
    name: `${project.name} (cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
