import { useEffect, useRef, useCallback, useState } from 'react';
import type { ConnectionStatus, PLCEvent, PLCSimulatorConfig, PLCState } from '@/types/plc';
import { DEFAULT_CONFIG, DEFAULT_STATE } from '@/types/plc';
import { scanCycle } from '@/lib/plcEngine';
import { localBridgeClient } from '@/lib/localBridgeClient';

interface UsePLCSyncOptions {
  scanIntervalMs?: number;
  onRemoteUpdate?: (state: PLCState) => void;
}

function isNewer(remote: PLCState, local: PLCState) {
  return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime();
}

export function usePLCSync({ scanIntervalMs, onRemoteUpdate }: UsePLCSyncOptions = {}) {
  const [state, setState] = useState<PLCState>(DEFAULT_STATE);
  const [config, setConfig] = useState<PLCSimulatorConfig>({
    ...DEFAULT_CONFIG,
    scanIntervalMs: scanIntervalMs ?? DEFAULT_CONFIG.scanIntervalMs,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<PLCEvent[]>([]);

  const stateRef = useRef(state);
  const configRef = useRef(config);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlight = useRef(false);

  stateRef.current = state;
  configRef.current = config;

  const pushState = useCallback(async (next: PLCState) => {
    try {
      await localBridgeClient.updateState(next);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('error');
    }
  }, []);

  const commitState = useCallback((updater: (prev: PLCState) => PLCState) => {
    setState((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      void pushState(next);
      return next;
    });
  }, [pushState]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setConnectionStatus('connecting');
      try {
        await localBridgeClient.health();
        const [remoteConfig, remoteState, remoteEvents] = await Promise.all([
          localBridgeClient.getConfig(),
          localBridgeClient.getState(),
          localBridgeClient.getEvents(),
        ]);

        if (cancelled) return;
        const nextConfig = {
          ...remoteConfig,
          scanIntervalMs: scanIntervalMs ?? remoteConfig.scanIntervalMs,
        };
        setConfig(nextConfig);
        setState(remoteState);
        setEvents(remoteEvents);
        setConnectionStatus('connected');
      } catch {
        if (!cancelled) setConnectionStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanIntervalMs]);

  useEffect(() => {
    if (scanRef.current) clearInterval(scanRef.current);

    scanRef.current = setInterval(async () => {
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        const remote = await localBridgeClient.getState();
        const current = stateRef.current;
        const remoteIsNewer = isNewer(remote, current);

        if (remote.source === 'tia-portal') {
          if (remoteIsNewer || current.source !== 'tia-portal') {
            onRemoteUpdate?.(remote);
          }
          stateRef.current = remote;
          setState(remote);
          setConnectionStatus('connected');
          return;
        }

        const next = scanCycle(remoteIsNewer ? remote : current);
        stateRef.current = next;
        setState(next);
        await localBridgeClient.updateState(next);
        setConnectionStatus('connected');
      } catch {
        const next = scanCycle(stateRef.current);
        stateRef.current = next;
        setState(next);
        setConnectionStatus('error');
      } finally {
        inFlight.current = false;
      }
    }, Math.max(100, config.scanIntervalMs));

    return () => {
      if (scanRef.current) clearInterval(scanRef.current);
    };
  }, [config.scanIntervalMs, onRemoteUpdate]);

  useEffect(() => {
    if (eventRef.current) clearInterval(eventRef.current);

    eventRef.current = setInterval(async () => {
      try {
        setEvents(await localBridgeClient.getEvents());
      } catch {
        // The scan loop owns the visible connection state.
      }
    }, 1500);

    return () => {
      if (eventRef.current) clearInterval(eventRef.current);
    };
  }, []);

  const updateConfig = useCallback(async (next: PLCSimulatorConfig) => {
    const normalized = {
      ...next,
      scanIntervalMs: Math.max(100, Number(next.scanIntervalMs) || DEFAULT_CONFIG.scanIntervalMs),
    };
    setConfig(normalized);
    try {
      const saved = await localBridgeClient.updateConfig(normalized);
      setConfig(saved);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('error');
    }
  }, []);

  const toggleRun = useCallback(() => {
    commitState((prev) => ({ ...prev, run: !prev.run, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, [commitState]);

  const pulseStartD = useCallback(() => {
    commitState((prev) => ({ ...prev, startPressed: true, source: 'simulator', updatedAt: new Date().toISOString() }));
    setTimeout(() => {
      commitState((prev) => ({ ...prev, startPressed: false, source: 'simulator', updatedAt: new Date().toISOString() }));
    }, 300);
  }, [commitState]);

  const pulseStartE = useCallback(() => {
    commitState((prev) => ({ ...prev, startEPressed: true, source: 'simulator', updatedAt: new Date().toISOString() }));
    setTimeout(() => {
      commitState((prev) => ({ ...prev, startEPressed: false, source: 'simulator', updatedAt: new Date().toISOString() }));
    }, 300);
  }, [commitState]);

  const setStopNf = useCallback((closed: boolean) => {
    commitState((prev) => ({
      ...prev,
      stopNfClosed: closed,
      stopHeld: !closed,
      source: 'simulator',
      updatedAt: new Date().toISOString(),
    }));
  }, [commitState]);

  const setFrNf = useCallback((closed: boolean) => {
    commitState((prev) => ({ ...prev, frNfClosed: closed, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, [commitState]);

  const resetFaults = useCallback(() => {
    commitState((prev) => ({ ...prev, sf: false, bf: false, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, [commitState]);

  const resetCycles = useCallback(() => {
    commitState((prev) => ({ ...prev, cycles: 1, mw100: 1, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, [commitState]);

  const forceState = useCallback((partial: Partial<PLCState>) => {
    commitState((prev) => ({ ...prev, ...partial, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, [commitState]);

  return {
    state,
    config,
    connectionStatus,
    events,
    toggleRun,
    pulseStartD,
    pulseStartE,
    setStopNf,
    setFrNf,
    resetFaults,
    resetCycles,
    forceState,
    updateConfig,
  };
}
