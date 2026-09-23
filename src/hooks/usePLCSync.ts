import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { PLCState } from '@/types/plc';
import { DEFAULT_STATE } from '@/types/plc';
import { scanCycle } from '@/lib/plcEngine';
import type { ConnectionStatus } from '@/types/plc';

interface UsePLCSyncOptions {
  scanIntervalMs: number;
  onRemoteUpdate?: (state: PLCState) => void;
}

/** DB row shape -> PLCState */
function rowToState(row: Record<string, unknown>): PLCState {
  const inputs = row.inputs as { bits: boolean[] } | null;
  const outputs = row.outputs as { bits: boolean[] } | null;
  const mb = row.memory_bits as Record<string, boolean> | null;
  return {
    run: row.run as boolean,
    sf: row.sf as boolean,
    bf: row.bf as boolean,
    inputs: inputs?.bits ?? DEFAULT_STATE.inputs,
    outputs: outputs?.bits ?? DEFAULT_STATE.outputs,
    memoryBits: {
      M0_0: mb?.M0_0 ?? false,
      M0_1: mb?.M0_1 ?? false,
      M0_2: mb?.M0_2 ?? false,
      M10_0: mb?.M10_0 ?? false,
    },
    mw100: row.mw100 as number,
    cycles: row.cycles as number,
    autoMode: row.auto_mode as boolean,
    startPressed: row.start_pressed as boolean,
    stopHeld: row.stop_held as boolean,
    latch: row.latch as boolean,
    relayK1: row.relay_k1 as boolean,
    relayK2: row.relay_k2 as boolean,
    source: (row.source as 'simulator' | 'tia-portal') ?? 'simulator',
    updatedAt: row.updated_at as string,
  };
}

/** PLCState -> DB row shape */
function stateToRow(s: PLCState) {
  return {
    run: s.run,
    sf: s.sf,
    bf: s.bf,
    inputs: { bits: s.inputs },
    outputs: { bits: s.outputs },
    memory_bits: s.memoryBits,
    mw100: s.mw100,
    cycles: s.cycles,
    auto_mode: s.autoMode,
    start_pressed: s.startPressed,
    stop_held: s.stopHeld,
    latch: s.latch,
    relay_k1: s.relayK1,
    relay_k2: s.relayK2,
    source: s.source,
    updated_at: s.updatedAt,
  };
}

export function usePLCSync({ scanIntervalMs, onRemoteUpdate }: UsePLCSyncOptions) {
  const [state, setState] = useState<PLCState>(DEFAULT_STATE);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<{ id: number; eventType: string; source: string; createdAt: string }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressRemote = useRef(false);

  // Load initial state from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConnectionStatus('connecting');
      const { data, error } = await supabase
        .from('plc_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setConnectionStatus('error');
        return;
      }
      if (data) {
        const s = rowToState(data as unknown as Record<string, unknown>);
        setState(s);
      }
      setConnectionStatus('connected');
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('plc-state-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plc_state' },
        (payload) => {
          if (suppressRemote.current) return;
          const s = rowToState(payload.new as Record<string, unknown>);
          setState(s);
          onRemoteUpdate?.(s);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plc_events' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setEvents((prev) =>
            [
              {
                id: row.id as number,
                eventType: row.event_type as string,
                source: row.source as string,
                createdAt: row.created_at as string,
              },
              ...prev,
            ].slice(0, 50),
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onRemoteUpdate]);

  // Scan cycle loop
  useEffect(() => {
    if (scanRef.current) clearInterval(scanRef.current);
    scanRef.current = setInterval(() => {
      setState((prev) => {
        const next = scanCycle(prev);
        return next;
      });
    }, scanIntervalMs);
    return () => {
      if (scanRef.current) clearInterval(scanRef.current);
    };
  }, [scanIntervalMs]);

  // Persist to DB (throttled)
  const lastPush = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastPush.current < 300) return;
    lastPush.current = now;
    suppressRemote.current = true;
    const row = stateToRow(state);
    supabase
      .from('plc_state')
      .update(row)
      .eq('id', 1)
      .then(() => { suppressRemote.current = false; });
  }, [state]);

  // Manual control functions
  const toggleRun = useCallback(() => {
    setState((prev) => ({ ...prev, run: !prev.run, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  const toggleAuto = useCallback(() => {
    setState((prev) => ({ ...prev, autoMode: !prev.autoMode, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  const pulseStart = useCallback(() => {
    setState((prev) => ({ ...prev, startPressed: true, source: 'simulator', updatedAt: new Date().toISOString() }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, startPressed: false, source: 'simulator', updatedAt: new Date().toISOString() }));
    }, 300);
  }, []);

  const setStop = useCallback((held: boolean) => {
    setState((prev) => ({ ...prev, stopHeld: held, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  const resetFaults = useCallback(() => {
    setState((prev) => ({ ...prev, sf: false, bf: false, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  const resetCycles = useCallback(() => {
    setState((prev) => ({ ...prev, cycles: 0, mw100: 0, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  const forceState = useCallback((partial: Partial<PLCState>) => {
    setState((prev) => ({ ...prev, ...partial, source: 'simulator', updatedAt: new Date().toISOString() }));
  }, []);

  return {
    state,
    connectionStatus,
    events,
    toggleRun,
    toggleAuto,
    pulseStart,
    setStop,
    resetFaults,
    resetCycles,
    forceState,
  };
}
