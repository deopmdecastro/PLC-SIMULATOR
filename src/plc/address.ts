/**
 * Parser e utilitários de endereços STEP 7 (TIA Portal).
 *
 * Suportados:
 *   I0.0  I0.7  IB0  IW64  ID72          (entradas / periferia de entrada)
 *   Q0.0  Q0.7  QB0  QW80  QD84          (saídas / periferia de saída)
 *   M0.0  MB10  MW100  MD50              (memórias / Merker)
 *   DB1.DBX0.0  DB1.DBB1  DB1.DBW2  DB1.DBD4  DB1.DBD20
 *   T1  T1.ET  T1.PT                     (temporizadores — tags derivadas)
 *   C1  C1.PV  C1.PRESET                 (contadores — tags derivadas)
 */

import type { PLCDataType, PLCVariableCategory, PLCValue } from './types';

export type PLCArea = 'inputs' | 'outputs' | 'memory' | 'db' | 'timer' | 'counter' | 'unknown';

export interface ParsedAddress {
  raw: string;
  normalized: string;
  area: PLCArea;
  /** Número do DB quando aplicável. */
  dbNumber: number | null;
  byte: number;
  bit: number | null;
  dataType: PLCDataType;
  /** Sub-campo das tags derivadas (ET/PT/PV/PRESET). */
  field: string | null;
}

const DATA_TYPE_BY_SIZE: Record<string, PLCDataType> = {
  X: 'BOOL',
  B: 'BYTE',
  W: 'WORD',
  D: 'DWORD',
};

export function normalizeAddress(address: string): string {
  return address.trim().toUpperCase().replace(/\s+/g, '');
}

function parseSizeSuffix(size: string | undefined): PLCDataType {
  if (!size) return 'BOOL';
  return DATA_TYPE_BY_SIZE[size.toUpperCase()] ?? 'BOOL';
}

export function parseAddress(address: string): ParsedAddress | null {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  // DB1.DBX0.0 | DB1.DBW2 | DB1.DBD4
  const dbMatch = /^DB(\d+)\.DB([XBWD])(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (dbMatch) {
    return {
      raw: address,
      normalized,
      area: 'db',
      dbNumber: Number(dbMatch[1]),
      byte: Number(dbMatch[3]),
      bit: dbMatch[4] !== undefined ? Number(dbMatch[4]) : null,
      dataType: parseSizeSuffix(dbMatch[2]),
      field: null,
    };
  }

  // Temporizadores / contadores derivados: T1, T1.ET, C1.PV
  const derived = /^([TC])(\d+)\.([A-Z]+)$/.exec(normalized);
  if (derived) {
    return {
      raw: address,
      normalized,
      area: derived[1] === 'T' ? 'timer' : 'counter',
      dbNumber: null,
      byte: Number(derived[2]),
      bit: null,
      dataType: derived[3] === 'ET' || derived[3] === 'PV' || derived[3] === 'PT' || derived[3] === 'PRESET'
        ? 'DINT'
        : 'BOOL',
      field: derived[3],
    };
  }

  const timerCounter = /^([TC])(\d+)$/.exec(normalized);
  if (timerCounter) {
    return {
      raw: address,
      normalized,
      area: timerCounter[1] === 'T' ? 'timer' : 'counter',
      dbNumber: null,
      byte: Number(timerCounter[2]),
      bit: null,
      dataType: 'BOOL',
      field: null,
    };
  }

  // I0.0 / Q0.1 / M0.0
  const bitMatch = /^([IQM])(\d+)\.(\d+)$/.exec(normalized);
  if (bitMatch) {
    const prefix = bitMatch[1];
    return {
      raw: address,
      normalized,
      area: prefix === 'I' ? 'inputs' : prefix === 'Q' ? 'outputs' : 'memory',
      dbNumber: null,
      byte: Number(bitMatch[2]),
      bit: Number(bitMatch[3]),
      dataType: 'BOOL',
      field: null,
    };
  }

  // IB0 / QW80 / MW100 / MD50
  const wordMatch = /^([IQM])([XBWD])(\d+)$/.exec(normalized);
  if (wordMatch) {
    const prefix = wordMatch[1];
    return {
      raw: address,
      normalized,
      area: prefix === 'I' ? 'inputs' : prefix === 'Q' ? 'outputs' : 'memory',
      dbNumber: null,
      byte: Number(wordMatch[3]),
      bit: null,
      dataType: parseSizeSuffix(wordMatch[2]),
      field: null,
    };
  }

  return null;
}

export function isValidAddress(address: string): boolean {
  return parseAddress(address) !== null;
}

export function areaToCategory(area: PLCArea, dataType: PLCDataType): PLCVariableCategory {
  switch (area) {
    case 'inputs':
      return dataType === 'BOOL' || dataType === 'BYTE' ? 'INPUTS' : 'ANALOG';
    case 'outputs':
      return dataType === 'BOOL' || dataType === 'BYTE' ? 'OUTPUTS' : 'ANALOG';
    case 'memory':
      return 'MEMORY';
    case 'db':
      return 'DB';
    case 'timer':
      return 'TIMERS';
    case 'counter':
      return 'COUNTERS';
    default:
      return 'SYSTEM';
  }
}

export function formatValue(value: PLCValue | null, dataType: PLCDataType, unit?: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (dataType === 'REAL') {
    const text = value.toFixed(2);
    return unit ? `${text} ${unit}` : text;
  }
  if (dataType === 'DINT' || dataType === 'INT' || dataType === 'WORD' || dataType === 'DWORD') {
    const text = String(Math.round(value));
    return unit ? `${text} ${unit}` : text;
  }
  return String(value);
}

export function isBitAddress(address: string): boolean {
  const parsed = parseAddress(address);
  if (!parsed) return false;
  return parsed.dataType === 'BOOL' && parsed.field === null;
}

/** Agrupa variáveis por área para reduzir pedidos (poll otimizado). */
export function groupByArea<T extends { address: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const parsed = parseAddress(item.address);
    const key = parsed ? `${parsed.area}${parsed.dbNumber !== null ? `:${parsed.dbNumber}` : ''}` : 'unknown';
    (groups[key] ||= []).push(item);
  }
  return groups;
}

/** Coerção segura do valor vindo de um provider de acordo com o tipo declarado. */
export function coerceValue(dataType: PLCDataType, value: unknown): PLCValue | null {
  if (value === null || value === undefined) return null;
  if (dataType === 'BOOL') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['1', 'TRUE', 'ON'].includes(value.toUpperCase());
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return null;
  if (dataType === 'INT' || dataType === 'WORD') {
    return Math.max(dataType === 'INT' ? -32768 : 0, Math.min(dataType === 'INT' ? 32767 : 65535, Math.round(numeric)));
  }
  return numeric;
}
