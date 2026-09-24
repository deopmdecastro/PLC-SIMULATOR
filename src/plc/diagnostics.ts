/**
 * Bus de diagnóstico — ring buffer de eventos de comunicação e de processo.
 */

import type { PLCDiagnosticEvent, PLCDiagnosticLevel } from './types';

const MAX_EVENTS = 400;

export type DiagnosticListener = (events: PLCDiagnosticEvent[]) => void;

export class DiagnosticBus {
  private events: PLCDiagnosticEvent[] = [];
  private listeners = new Set<DiagnosticListener>();
  private counter = 0;

  push(level: PLCDiagnosticLevel, source: string, message: string, detail?: string): void {
    const event: PLCDiagnosticEvent = {
      id: ++this.counter,
      at: new Date().toISOString(),
      level,
      source,
      message,
      detail,
    };
    this.events = [event, ...this.events].slice(0, MAX_EVENTS);
    this.emit();
  }

  /** Registos de alteração de valor (evita inundar o log com o mesmo endereço). */
  value(address: string, name: string, previous: unknown, current: unknown): void {
    const pretty = (v: unknown) => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
    this.push('value', address, `${name} changed → ${pretty(current)}`, `antes: ${pretty(previous)}`);
  }

  log(level: PLCDiagnosticLevel, source: string, message: string, detail?: string): void {
    this.push(level, source, message, detail);
  }

  list(): PLCDiagnosticEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
    this.emit();
  }

  subscribe(listener: DiagnosticListener): () => void {
    this.listeners.add(listener);
    listener(this.events);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.events);
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
