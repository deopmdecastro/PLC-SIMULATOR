#!/usr/bin/env node
/**
 * Gateway local de comunicação PLC — porta 8766, prefixo /plc-api.
 *
 * Porque existe: o navegador não fala S7comm nem carrega DLLs .NET. Este
 * processo corre no PC onde estão o TIA Portal / PLCSIM / NetToPLCsim e expõe
 * uma API HTTP simples que o frontend consome.
 *
 * Providers:
 *   mock             — PLC simulado em processo (sem dependências)
 *   s7               — S7comm via ISO-on-TCP (opcional: `npm i nodes7`)
 *   plcsim-advanced  — proxy para o helper .NET (:8770, Windows)
 *
 * Arranque:  npm run gateway
 * Variáveis: PLC_GATEWAY_PORT, PLC_GATEWAY_HOST
 *
 * Nenhum valor é inventado: quando a leitura falha, devolve quality "bad" e o
 * erro em texto. O frontend mostra exatamente o que recebe.
 */

'use strict';

const http = require('node:http');
const { MockPLC, STEP_LABELS, normalizeAddress } = require('./mock_plc.cjs');

const HOST = process.env.PLC_GATEWAY_HOST || '127.0.0.1';
const PORT = Number(process.env.PLC_GATEWAY_PORT || 8766);
const PLCSIM_HELPER_URL = process.env.PLCSIM_HELPER_URL || 'http://127.0.0.1:8770';
const API_PREFIX = '/plc-api';

/* ------------------------------------------------------------------ */
/* Estado                                                             */
/* ------------------------------------------------------------------ */

const mock = new MockPLC();

let active = {
  provider: 'mock',
  ip: '',
  rack: 0,
  slot: 1,
  instanceName: '',
  connected: false,
  mode: 'RUN',
  message: '',
  cycleTimeMs: 2.1,
  timeoutMs: 3000,
  connectedAt: null,
  changes: [],
};

let nodes7 = null;
let nodes7Conn = null;
let nodes7Ready = false;

function log(...args) {
  console.log(`[${new Date().toISOString()}] [gateway]`, ...args);
}

/**
 * Traduz um endereço STEP 7 (TIA) para o formato de etiqueta do nodes7.
 * Devolve null quando o endereço não é traduzível — nunca é inventado um valor.
 * NOTA: a sintaxe de etiquetas do nodes7 deve ser confirmada na documentação da
 * biblioteca antes de usar em produção (não foi testada neste ambiente Linux).
 */
function toNodes7Tag(address) {
  const value = normalizeAddress(address);
  const db = /^DB(\d+)\.DB([XBWD])(\d+)(?:\.(\d+))?$/.exec(value);
  if (db) {
    const size = { X: 'X', B: 'BYTE', W: 'INT', D: 'DINT' }[db[2]];
    const byte = Number(db[3]);
    if (db[2] === 'X') return `DB${db[1]},X${byte}.${Number(db[4] || 0)}`;
    return `DB${db[1]},${size}${byte}`;
  }
  if (/^[IQM]\d+\.\d+$/.test(value)) return value;
  if (/^[IQM][BWD]\d+$/.test(value)) return value;
  return null;
}

function loadNodes7() {
  if (nodes7 !== null) return nodes7;
  try {
    // Dependência opcional: só é necessária para o provider S7 real.
    nodes7 = require('nodes7');
    log('nodes7 disponível — provider S7 ativo');
  } catch {
    nodes7 = false;
    log('nodes7 não instalado — provider S7 responde com erro explícito. Instalar com: npm i nodes7');
  }
  return nodes7;
}

/* ------------------------------------------------------------------ */
/* Helpers HTTP                                                       */
/* ------------------------------------------------------------------ */

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error('Corpo do pedido demasiado grande'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`JSON inválido: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

async function fetchHelper(path, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${PLCSIM_HELPER_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error || `Helper .NET devolveu ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Providers                                                          */
/* ------------------------------------------------------------------ */

const providers = {
  mock: {
    async connect(cfg) {
      mock.run = true;
      return {
        mode: 'RUN',
        cycleTimeMs: mock.cycleTimeMs,
        message: 'Mock PLC em execução (programa OB1 demo)',
      };
    },
    async disconnect() {
      return { ok: true };
    },
    async discover() {
      return [
        {
          id: 'mock:demo',
          label: 'MOCK-PLC-DEMO',
          address: 'local',
          cpu: 'S7-1500 (simulado)',
          detail: 'Programa OB1 demo — sequência de 7 etapas',
          reachable: true,
        },
      ];
    },
    async read(items) {
      const started = Date.now();
      const result = mock.scan();
      return {
        items: items.map((item) => {
          const key = normalizeAddress(item.address);
          if (!mock.values.has(key)) {
            return { address: item.address, value: null, quality: 'unknown', error: 'Endereço inexistente no PLC mock' };
          }
          return { address: item.address, value: mock.values.get(key), quality: 'good' };
        }),
        latencyMs: Date.now() - started,
        changed: result.changed,
        step: result.step,
      };
    },
    async write(body) {
      const key = normalizeAddress(body.address);
      if (!mock.values.has(key)) {
        throw new Error(`Endereço ${body.address} não existe no PLC mock`);
      }
      const value = typeof body.value === 'boolean' ? body.value : Number(body.value);
      mock.values.set(key, value);
      return { ok: true };
    },
    async cpu(action) {
      mock.run = action === 'run';
      return { ok: true, mode: mock.run ? 'RUN' : 'STOP' };
    },
    async status() {
      return { ok: true, mode: mock.run ? 'RUN' : 'STOP', cycleTimeMs: mock.cycleTimeMs, meta: { step: mock.getStep(), stepLabel: STEP_LABELS[mock.getStep()] } };
    },
  },

  s7: {
    async connect(cfg) {
      const lib = loadNodes7();
      if (!lib) {
        throw new Error(
          'nodes7 não está instalado neste PC. Instale com "npm i nodes7" para usar o protocolo S7 (ou use o provider Mock / PLCSIM Advanced).',
        );
      }
      nodes7Conn = new lib();
      nodes7Ready = false;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout ao ligar a ${cfg.ip}:${102}`)), cfg.timeoutMs || 3000);
        nodes7Conn.initiateConnection(
          { host: cfg.ip, port: 102, rack: cfg.rack ?? 0, slot: cfg.slot ?? 1 },
          (error) => {
            clearTimeout(timer);
            if (error) reject(new Error(`Falha de ligação S7: ${error}`));
            else resolve();
          },
        );
      });
      nodes7Ready = true;
      return {
        mode: 'RUN',
        cycleTimeMs: null,
        message: `S7comm estabelecido com ${cfg.ip} (rack ${cfg.rack}/${cfg.slot})`,
      };
    },
    async disconnect() {
      if (nodes7Conn && nodes7Ready) {
        try {
          nodes7Conn.dropConnection();
        } catch {
          /* ignorar */
        }
      }
      nodes7Ready = false;
      nodes7Conn = null;
      return { ok: true };
    },
    async discover() {
      const lib = loadNodes7();
      if (!lib) {
        return [
          {
            id: 's7:dependency-missing',
            label: 'nodes7 não instalado',
            address: 'npm i nodes7',
            detail: 'A descoberta S7 requer a biblioteca nodes7 no PC do gateway.',
            reachable: false,
          },
        ];
      }
      return [
        {
          id: 's7:configured',
          label: `Endereço configurado (${active.ip || 'sem IP'})`,
          address: active.ip || '—',
          detail: 'O protocolo S7 não tem multicast de descoberta; a ligação é feita ao IP indicado.',
          reachable: Boolean(active.ip),
        },
      ];
    },
    async read(items) {
      if (!nodes7Ready || !nodes7Conn) throw new Error('Sem ligação S7 ativa');
      const started = Date.now();
      const tags = items.map((item) => toNodes7Tag(item.address));
      const invalidIndex = tags.findIndex((tag) => !tag);
      if (invalidIndex >= 0) {
        throw new Error(
          `Endereço não traduzível para o protocolo S7: ${items[invalidIndex].address}. ` +
            'Use I/Q/M com bit ou byte/palavra, ou DBn.DBX/DBB/DBW/DBD com acesso otimizado desativado.',
        );
      }

      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout na leitura S7')), (active.timeoutMs || 3000) + 2000);
        try {
          nodes7Conn.addItems(tags);
          nodes7Conn.readAllItems((bad, values) => {
            clearTimeout(timer);
            const badKeys = bad ? Object.keys(bad) : [];
            if (badKeys.length > 0 && badKeys.length === tags.length) {
              reject(
                new Error(
                  `Leitura recusada pela CPU (${bad[badKeys[0]]}). Verifique PUT/GET ativado e, para DBs, o acesso otimizado desativado.`,
                ),
              );
              return;
            }
            resolve({ bad: bad || {}, values: values || {} });
          });
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });

      return {
        items: items.map((item, index) => {
          const tag = tags[index];
          if (result.bad[tag]) {
            return { address: item.address, value: null, quality: 'bad', error: String(result.bad[tag]) };
          }
          return { address: item.address, value: result.values[tag], quality: 'good' };
        }),
        latencyMs: Date.now() - started,
        changed: [],
      };
    },
    async write(body) {
      if (!nodes7Ready || !nodes7Conn) throw new Error('Sem ligação S7 ativa');
      const tag = toNodes7Tag(body.address);
      if (!tag) throw new Error(`Endereço não traduzível para o protocolo S7: ${body.address}`);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout na escrita S7')), (active.timeoutMs || 3000) + 2000);
        try {
          nodes7Conn.writeItems(tag, body.value, (error) => {
            clearTimeout(timer);
            if (error) reject(new Error(String(error)));
            else resolve();
          });
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
      return { ok: true };
    },
    async cpu() {
      throw new Error('Comando RUN/STOP não é suportado pelo protocolo S7 (usar o TIA Portal ou PLCSIM Advanced).');
    },
    async status() {
      return { ok: nodes7Ready, mode: active.mode, cycleTimeMs: null, meta: { library: nodes7 ? 'nodes7' : 'ausente' } };
    },
  },

  'plcsim-advanced': {
    async connect(cfg) {
      try {
        const result = await fetchHelper('/connect', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: cfg.instanceName,
            ip: cfg.ip,
            timeoutMs: cfg.timeoutMs,
          }),
        });
        return {
          mode: result.mode || 'RUN',
          cycleTimeMs: typeof result.cycleTimeMs === 'number' ? result.cycleTimeMs : null,
          message: result.message || `Instância "${cfg.instanceName}" ligada`,
        };
      } catch (error) {
        throw new Error(
          `Helper .NET do PLCSIM Advanced inacessível em ${PLCSIM_HELPER_URL} (${error.message}). ` +
            'Este provider só funciona em Windows com S7-PLCSIM Advanced instalado — ver docs/TIA_SETUP.md.',
        );
      }
    },
    async disconnect() {
      try {
        await fetchHelper('/disconnect', { method: 'POST', body: '{}' });
      } catch {
        /* ignorar */
      }
      return { ok: true };
    },
    async discover() {
      try {
        const result = await fetchHelper('/discover');
        return result.items || [];
      } catch (error) {
        return [
          {
            id: 'plcsim-advanced:helper-offline',
            label: 'PLCSIM Advanced não encontrado',
            address: PLCSIM_HELPER_URL,
            detail: `${error.message} — requer Windows + S7-PLCSIM Advanced (API Siemens.Simatic.Simulation.Runtime).`,
            reachable: false,
          },
        ];
      }
    },
    async read(items) {
      const result = await fetchHelper('/read', { method: 'POST', body: JSON.stringify({ items }) });
      return { items: result.items || [], latencyMs: result.latencyMs ?? null, changed: [] };
    },
    async write(body) {
      return fetchHelper('/write', { method: 'POST', body: JSON.stringify(body) });
    },
    async cpu(action) {
      return fetchHelper(`/cpu/${action}`, { method: 'POST', body: '{}' });
    },
    async status() {
      try {
        return await fetchHelper('/status');
      } catch (error) {
        return { ok: false, mode: 'UNKNOWN', message: error.message };
      }
    },
  },
};

/* ------------------------------------------------------------------ */
/* Servidor                                                           */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  let path = url.pathname;
  if (path.startsWith(API_PREFIX)) path = path.slice(API_PREFIX.length);
  if (!path) path = '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      sendJson(res, 200, {
        ok: true,
        service: 'plc-gateway',
        version: '1.0.0',
        providers: Object.keys(providers),
        active: { provider: active.provider, connected: active.connected },
        endpoints: [
          'GET  /plc-api/health',
          'POST /plc-api/connect',
          'POST /plc-api/disconnect',
          'GET  /plc-api/discover?provider=',
          'POST /plc-api/read',
          'POST /plc-api/write',
          'POST /plc-api/cpu/run|stop',
          'GET  /plc-api/status?provider=',
        ],
      });
      return;
    }

    if (req.method === 'POST' && path === '/connect') {
      const body = await readBody(req);
      const providerId = body.provider || 'mock';
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      active = { ...active, ...body, provider: providerId, connected: false };
      const info = await handler.connect(active);
      active.connected = true;
      active.mode = info.mode || 'RUN';
      active.cycleTimeMs = info.cycleTimeMs ?? null;
      active.message = info.message || '';
      active.connectedAt = new Date().toISOString();
      log(`Ligado via ${providerId} — ${active.message}`);
      sendJson(res, 200, {
        ok: true,
        info: {
          mode: active.mode,
          cycleTimeMs: active.cycleTimeMs,
          message: active.message,
          provider: providerId,
          ip: active.ip,
          rack: active.rack,
          slot: active.slot,
        },
      });
      return;
    }

    if (req.method === 'POST' && path === '/disconnect') {
      const handler = providers[active.provider];
      if (handler) await handler.disconnect();
      active.connected = false;
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path === '/discover') {
      const providerId = url.searchParams.get('provider') || active.provider;
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      const items = await handler.discover();
      sendJson(res, 200, { provider: providerId, items });
      return;
    }

    if (req.method === 'POST' && path === '/read') {
      const body = await readBody(req);
      const providerId = body.provider || active.provider;
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      if (providerId !== 'mock' && !active.connected) {
        throw new Error(`Sem ligação ativa no provider ${providerId}`);
      }
      const result = await handler.read(body.items || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && path === '/write') {
      const body = await readBody(req);
      const providerId = body.provider || active.provider;
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      const result = await handler.write(body);
      log(`Escrita: ${body.address} ← ${body.value} (${providerId})`);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && (path === '/cpu/run' || path === '/cpu/stop')) {
      const body = await readBody(req);
      const providerId = body.provider || active.provider;
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      const result = await handler.cpu(path.endsWith('run') ? 'run' : 'stop');
      active.mode = result.mode || active.mode;
      log(`CPU → ${active.mode} (${providerId})`);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'GET' && path === '/status') {
      const providerId = url.searchParams.get('provider') || active.provider;
      const handler = providers[providerId];
      if (!handler) throw new Error(`Provider desconhecido: ${providerId}`);
      const result = await handler.status();
      sendJson(res, 200, { ...result, provider: providerId, connected: active.connected });
      return;
    }

    sendJson(res, 404, { error: `Sem rota para ${req.method} ${path}` });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  log(`Gateway PLC a escutar em http://${HOST}:${PORT}${API_PREFIX}`);
  log('Providers: mock (ativo) · s7 (requer nodes7 + IP/rack/slot) · plcsim-advanced (requer Windows + PLCSIM Advanced)');
});
