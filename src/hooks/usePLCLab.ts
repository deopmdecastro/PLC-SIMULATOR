/**
 * usePLCLab — liga a camada de comunicação PLC (não-React) ao React.
 *
 * A UI nunca chama providers diretamente: fala com o PLCConnectionManager
 * através deste hook, que expõe um snapshot imutável por varrimento.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PLCConnectionManager,
  type PLCDiagnosticEvent,
  type PLCDiscoveryResult,
  type PLCProviderConfig,
  type PLCSnapshot,
  type PLCValue,
  type PLCVariableDefinition,
  type PLCVariableValue,
} from '@/plc';
import type { ComponentRuntimeState, SimulationComponent, SimulationProject } from '@/simulation/scene';
import { resolveComponentState } from '@/simulation/scene';
import {
  createDefaultProject,
  DEFAULT_COMPONENTS,
  DEFAULT_VARIABLES,
} from '@/config/defaultProject';
import {
  duplicateProject,
  exportProjectJson,
  importProjectJson,
  loadProjectsState,
  persistProjectsState,
} from '@/config/projectsStore';

const EMPTY_VALUES: Record<string, PLCVariableValue> = {};

export interface PLCLabApi {
  project: SimulationProject;
  projects: SimulationProject[];
  snapshot: PLCSnapshot | null;
  values: Record<string, PLCVariableValue>;
  diagnostics: PLCDiagnosticEvent[];
  discovery: PLCDiscoveryResult[];
  connected: boolean;
  busy: boolean;
  lastError: string | null;

  /* comunicação */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  autoDiscover: () => Promise<void>;
  updatePlcConfig: (patch: Partial<PLCProviderConfig>) => Promise<void>;
  setCpuMode: (action: 'run' | 'stop') => Promise<void>;

  /* variáveis */
  writeVariable: (address: string, value: PLCValue) => Promise<void>;
  toggleVariable: (definition: PLCVariableDefinition) => Promise<void>;
  setAnalogVariable: (definition: PLCVariableDefinition, value: number) => Promise<void>;
  pulseVariable: (address: string, active: boolean, durationMs?: number) => Promise<void>;
  variableByAddress: (address: string | undefined) => PLCVariableDefinition | undefined;
  componentState: (component: SimulationComponent) => ComponentRuntimeState;

  /* projeto */
  updateProject: (patch: Partial<SimulationProject>) => void;
  setVariables: (variables: PLCVariableDefinition[]) => void;
  setComponents: (components: SimulationComponent[]) => void;
  addComponent: (component: SimulationComponent) => void;
  updateComponent: (id: string, patch: Partial<SimulationComponent>) => void;
  removeComponent: (id: string) => void;
  selectProject: (id: string) => void;
  createProject: (name: string) => void;
  deleteProject: (id: string) => void;
  duplicateActiveProject: () => void;
  exportActiveProject: () => string;
  importProject: (text: string) => void;
  resetComponents: () => void;
  resetVariables: () => void;

  /* diagnóstico */
  clearDiagnostics: () => void;
  logUser: (level: PLCDiagnosticEvent['level'], message: string, detail?: string) => void;
}

export function usePLCLab(): PLCLabApi {
  const [state, setState] = useState(() => loadProjectsState());
  const [snapshot, setSnapshot] = useState<PLCSnapshot | null>(null);
  const [discovery, setDiscovery] = useState<PLCDiscoveryResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const project = useMemo(
    () => state.projects.find((item) => item.id === state.activeId) ?? state.projects[0] ?? createDefaultProject(),
    [state],
  );

  const managerRef = useRef<PLCConnectionManager | null>(null);

  /* -------------------------- ciclo de vida do manager -------------------------- */
  useEffect(() => {
    const manager = new PLCConnectionManager(project.plc);
    managerRef.current = manager;
    const unsubscribe = manager.subscribe((next) => setSnapshot(next));
    manager.setVariableDefinitions(project.variables);
    return () => {
      unsubscribe();
      manager.dispose();
      managerRef.current = null;
    };
    // O manager é recriado apenas quando muda o provider (não a cada varrimento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.plc.providerId, project.plc.ip, project.plc.rack, project.plc.slot, project.plc.instanceName]);

  /* As variáveis podem mudar sem recriar a ligação. */
  useEffect(() => {
    managerRef.current?.setVariableDefinitions(project.variables);
  }, [project.variables]);

  useEffect(() => {
    persistProjectsState(state);
  }, [state]);

  const mutateProject = useCallback((updater: (current: SimulationProject) => SimulationProject) => {
    setState((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === current.activeId ? { ...updater(item), updatedAt: new Date().toISOString() } : item,
      ),
    }));
  }, []);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setLastError(null);
    try {
      return await action();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  /* -------------------------------- comunicação -------------------------------- */
  const connect = useCallback(
    () =>
      run(async () => {
        const manager = managerRef.current;
        if (!manager) return;
        await manager.connect();
      }) as Promise<void>,
    [run],
  );

  const disconnect = useCallback(
    () =>
      run(async () => {
        await managerRef.current?.disconnect();
      }) as Promise<void>,
    [run],
  );

  const autoDiscover = useCallback(
    () =>
      run(async () => {
        const manager = managerRef.current;
        if (!manager) return;
        const items = await manager.discover();
        setDiscovery(items);
      }) as Promise<void>,
    [run],
  );

  const updatePlcConfig = useCallback(
    (patch: Partial<PLCProviderConfig>) =>
      run(async () => {
        mutateProject((current) => ({ ...current, plc: { ...current.plc, ...patch } }));
        await managerRef.current?.applyConfig(patch);
      }) as Promise<void>,
    [mutateProject, run],
  );

  const setCpuMode = useCallback(
    (action: 'run' | 'stop') =>
      run(async () => {
        await managerRef.current?.setCpuMode(action);
      }) as Promise<void>,
    [run],
  );

  /* --------------------------------- variáveis --------------------------------- */
  const writeVariable = useCallback(
    (address: string, value: PLCValue) =>
      run(async () => {
        await managerRef.current?.writeAddress(address, value);
      }) as Promise<void>,
    [run],
  );

  const variableByAddress = useCallback(
    (address: string | undefined) =>
      address
        ? project.variables.find((item) => item.address.toUpperCase() === address.trim().toUpperCase())
        : undefined,
    [project.variables],
  );

  const toggleVariable = useCallback(
    async (definition: PLCVariableDefinition) => {
      const current = snapshot?.values[definition.id]?.value;
      const next = typeof current === 'number' ? (current !== 0 ? 0 : 1) : !current;
      await writeVariable(definition.address, next);
    },
    [snapshot, writeVariable],
  );

  const setAnalogVariable = useCallback(
    async (definition: PLCVariableDefinition, value: number) => {
      const clamped = Math.max(definition.min ?? 0, Math.min(definition.max ?? 27648, value));
      await writeVariable(definition.address, clamped);
    },
    [writeVariable],
  );

  const pulseVariable = useCallback(
    async (address: string, active: boolean, durationMs = 300) => {
      const definition = variableByAddress(address);
      if (!definition) {
        setLastError(`Endereço ${address} não está mapeado no projeto atual`);
        return;
      }
      await writeVariable(address, active);
      if (active && durationMs > 0) {
        window.setTimeout(() => {
          void managerRef.current?.writeValue(definition, false).catch(() => undefined);
        }, durationMs);
      }
    },
    [variableByAddress, writeVariable],
  );

  const values = snapshot?.values ?? EMPTY_VALUES;

  const componentState = useCallback(
    (component: SimulationComponent) => resolveComponentState(component, values, project.variables),
    [project.variables, values],
  );

  /* ---------------------------------- projeto ---------------------------------- */
  const updateProject = useCallback(
    (patch: Partial<SimulationProject>) => mutateProject((current) => ({ ...current, ...patch })),
    [mutateProject],
  );

  const setVariables = useCallback(
    (variables: PLCVariableDefinition[]) => mutateProject((current) => ({ ...current, variables })),
    [mutateProject],
  );

  const setComponents = useCallback(
    (components: SimulationComponent[]) => mutateProject((current) => ({ ...current, components })),
    [mutateProject],
  );

  const addComponent = useCallback(
    (component: SimulationComponent) =>
      mutateProject((current) => ({ ...current, components: [...current.components, component] })),
    [mutateProject],
  );

  const updateComponent = useCallback(
    (id: string, patch: Partial<SimulationComponent>) =>
      mutateProject((current) => ({
        ...current,
        components: current.components.map((component) =>
          component.id === id ? { ...component, ...patch } : component,
        ),
      })),
    [mutateProject],
  );

  const removeComponent = useCallback(
    (id: string) =>
      mutateProject((current) => ({
        ...current,
        components: current.components.filter((component) => component.id !== id),
      })),
    [mutateProject],
  );

  const selectProject = useCallback((id: string) => setState((current) => ({ ...current, activeId: id })), []);

  const createProject = useCallback((name: string) => {
    const project = createDefaultProject(name || 'Novo projeto');
    setState((current) => ({ projects: [...current.projects, project], activeId: project.id }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((current) => {
      const projects = current.projects.filter((item) => item.id !== id);
      if (projects.length === 0) {
        const fallback = createDefaultProject();
        return { projects: [fallback], activeId: fallback.id };
      }
      return { projects, activeId: current.activeId === id ? projects[0].id : current.activeId };
    });
  }, []);

  const duplicateActiveProject = useCallback(() => {
    setState((current) => {
      const source = current.projects.find((item) => item.id === current.activeId);
      if (!source) return current;
      const copy = duplicateProject(source);
      return { projects: [...current.projects, copy], activeId: copy.id };
    });
  }, []);

  const exportActiveProject = useCallback(() => exportProjectJson(project), [project]);

  const importProject = useCallback((text: string) => {
    try {
      const imported = importProjectJson(text);
      setState((current) => ({ projects: [...current.projects, imported], activeId: imported.id }));
    } catch (error) {
      setLastError(`JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  const resetComponents = useCallback(
    () => mutateProject((current) => ({ ...current, components: DEFAULT_COMPONENTS.map((item) => ({ ...item })) })),
    [mutateProject],
  );

  const resetVariables = useCallback(
    () => mutateProject((current) => ({ ...current, variables: DEFAULT_VARIABLES.map((item) => ({ ...item })) })),
    [mutateProject],
  );

  /* -------------------------------- diagnóstico -------------------------------- */
  const clearDiagnostics = useCallback(() => managerRef.current?.clearDiagnostics(), []);

  const logUser = useCallback(
    (level: PLCDiagnosticEvent['level'], message: string, detail?: string) =>
      managerRef.current?.logUser(level, message, detail),
    [],
  );

  return {
    project,
    projects: state.projects,
    snapshot,
    values,
    diagnostics: snapshot?.diagnostics ?? [],
    discovery,
    connected: snapshot?.info.status === 'connected',
    busy,
    lastError,

    connect,
    disconnect,
    autoDiscover,
    updatePlcConfig,
    setCpuMode,

    writeVariable,
    toggleVariable,
    setAnalogVariable,
    pulseVariable,
    variableByAddress,
    componentState,

    updateProject,
    setVariables,
    setComponents,
    addComponent,
    updateComponent,
    removeComponent,
    selectProject,
    createProject,
    deleteProject,
    duplicateActiveProject,
    exportActiveProject,
    importProject,
    resetComponents,
    resetVariables,

    clearDiagnostics,
    logUser,
  };
}
