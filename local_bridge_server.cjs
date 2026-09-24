#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.PLC_BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.PLC_BRIDGE_PORT || 8765);
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'plc-state.json');
const CONFIG_FILE = path.join(DATA_DIR, 'plc-config.json');
const EVENTS_FILE = path.join(DATA_DIR, 'plc-events.json');

function now() {
  return new Date().toISOString();
}

const defaultState = {
  id: 1,
  run: true,
  sf: false,
  bf: false,
  inputs: { bits: [false, false, false, false, true, true, false, false] },
  outputs: { bits: [false, false, false, false, false, false, false, false] },
  memory_bits: { M0_0: false, M0_1: false, M0_2: false, M10_0: false },
  mw100: 1,
  cycles: 1,
  auto_mode: false,
  start_pressed: false,
  start_e_pressed: false,
  stop_nf_closed: true,
  fr_nf_closed: true,
  stop_held: false,
  latch: false,
  relay_k1: false,
  relay_k2: false,
  source: 'simulator',
  updated_at: now(),
};

const defaultConfig = {
  profileName: 'Ex6 - Motor D/E com KM1/KM2',
  bridgeEndpoint: `http://${HOST}:${PORT}`,
  scanIntervalMs: 500,
  inputLabels: ['I0.0 START_D', 'I0.1 START_E', 'I0.2 STOP_NF', 'I0.3 FR_NF', 'I0.4', 'I0.5', 'I0.6', 'I0.7'],
  outputLabels: ['Q0.0 KM1', 'Q0.1 KM2', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7'],
  tagMap: {
    start: 'I0.0',
    startLeft: 'I0.1',
    stopNormallyClosed: 'I0.2',
    thermalNormallyClosed: 'I0.3',
    autoMode: '',
    motor: 'Q0.0',
    motorLeft: 'Q0.1',
    cycleCounter: 'MW100',
  },
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) {
    writeJson(file, fallback);
    return fallback;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    return { ...fallback, ...parsed };
  } catch {
    writeJson(file, fallback);
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDataDir();
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readEvents() {
  return readJson(EVENTS_FILE, []);
}

function addEvent(eventType, source, payload) {
  const events = readEvents();
  events.unshift({
    id: Date.now(),
    event_type: eventType,
    source: source || 'simulator',
    payload,
    created_at: now(),
  });
  writeJson(EVENTS_FILE, events.slice(0, 200));
}

function bitIndex(address) {
  const match = /^([IQ])0\.(\d)$/.exec(address);
  if (!match) return null;
  const bit = Number(match[2]);
  if (bit < 0 || bit > 7) return null;
  return 7 - bit;
}

function cloneBits(value, fallback) {
  if (Array.isArray(value)) return [...value];
  if (Array.isArray(value?.bits)) return [...value.bits];
  return [...fallback];
}

function collectTagUpdates(body) {
  return {
    ...(body.tags || {}),
    ...(body.addresses || {}),
    ...(body.variables || {}),
    ...Object.fromEntries(
      Object.entries(body).filter(([key]) => /^(I|Q|M)\d+\.\d+$/.test(key) || /^MW\d+$/.test(key)),
    ),
  };
}

function applyTagUpdate(normalized, current, address, rawValue) {
  const value = Boolean(rawValue);

  if (/^I0\.\d$/.test(address)) {
    const inputs = cloneBits(normalized.inputs, current.inputs?.bits || defaultState.inputs.bits);
    const index = bitIndex(address);
    if (index === null) return;

    inputs[index] = value;
    normalized.inputs = { bits: inputs };

    if (address === 'I0.0') normalized.start_pressed = value;
    if (address === 'I0.1') normalized.start_e_pressed = value;
    if (address === 'I0.2') {
      normalized.stop_nf_closed = value;
      normalized.stop_held = !value;
    }
    if (address === 'I0.3') normalized.fr_nf_closed = value;
    return;
  }

  if (/^Q0\.\d$/.test(address)) {
    const outputs = cloneBits(normalized.outputs, current.outputs?.bits || defaultState.outputs.bits);
    const index = bitIndex(address);
    if (index === null) return;

    outputs[index] = value;
    normalized.outputs = { bits: outputs };

    if (address === 'Q0.0') normalized.relay_k1 = value;
    if (address === 'Q0.1') normalized.relay_k2 = value;
    return;
  }

  if (/^M\d+\.\d+$/.test(address)) {
    const key = address.replace('.', '_');
    normalized.memory_bits = {
      ...(current.memory_bits || defaultState.memory_bits),
      ...(normalized.memory_bits || {}),
      [key]: value,
    };

    if (address === 'M0.2') normalized.latch = value;
    return;
  }

  if (address === 'MW100') {
    const wordValue = Number(rawValue) || 0;
    normalized.mw100 = wordValue;
    if (!Object.prototype.hasOwnProperty.call(normalized, 'cycles')) {
      normalized.cycles = wordValue;
    }
  }
}

function normalizeAddressImages(normalized) {
  const inputs = cloneBits(normalized.inputs, defaultState.inputs.bits);
  const outputs = cloneBits(normalized.outputs, defaultState.outputs.bits);

  if (normalized.inputs) {
    normalized.inputs = { bits: inputs };
    normalized.start_pressed = inputs[7];
    normalized.start_e_pressed = inputs[6];
    normalized.stop_nf_closed = inputs[5];
    normalized.stop_held = !inputs[5];
    normalized.fr_nf_closed = inputs[4];
  }

  if (normalized.outputs) {
    normalized.outputs = { bits: outputs };
    normalized.relay_k1 = outputs[7];
    normalized.relay_k2 = outputs[6];
  }
}

function normalizeUpdate(body) {
  const normalized = { ...body };
  const aliases = {
    autoMode: 'auto_mode',
    startPressed: 'start_pressed',
    startEPressed: 'start_e_pressed',
    stopNfClosed: 'stop_nf_closed',
    frNfClosed: 'fr_nf_closed',
    stopHeld: 'stop_held',
    memoryBits: 'memory_bits',
    relayK1: 'relay_k1',
    relayK2: 'relay_k2',
    updatedAt: 'updated_at',
  };

  for (const [camel, snake] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(normalized, camel)) {
      normalized[snake] = normalized[camel];
      delete normalized[camel];
    }
  }

  if (Array.isArray(normalized.inputs)) normalized.inputs = { bits: normalized.inputs };
  if (Array.isArray(normalized.outputs)) normalized.outputs = { bits: normalized.outputs };

  delete normalized.id;
  return normalized;
}

function normalizeEx6State(state, { explicitOutputs = false, explicitG0 = false } = {}) {
  const inputs = cloneBits(state.inputs, defaultState.inputs.bits);
  const outputs = cloneBits(state.outputs, defaultState.outputs.bits);
  const outputBits = [false, false, false, false, false, false, Boolean(outputs[6]), Boolean(outputs[7])];
  let g0 = Number(state.mw100) || 1;

  if (!explicitOutputs) {
    outputBits[7] = g0 === 5;
    outputBits[6] = g0 === 10;
  } else if (!explicitG0) {
    if (outputBits[7]) g0 = 5;
    else if (outputBits[6]) g0 = 10;
    else g0 = 1;
  }

  state.inputs = { bits: inputs };
  state.outputs = { bits: outputBits };

  state.start_pressed = inputs[7];
  state.start_e_pressed = inputs[6];
  state.stop_nf_closed = inputs[5];
  state.stop_held = !inputs[5];
  state.fr_nf_closed = inputs[4];
  state.auto_mode = false;

  state.mw100 = g0;
  state.cycles = g0;
  state.relay_k1 = outputBits[7];
  state.relay_k2 = outputBits[6];
  state.latch = outputBits[7];
  state.memory_bits = {
    ...(state.memory_bits || defaultState.memory_bits),
    M0_0: outputBits[7],
    M0_1: outputBits[6],
    M0_2: g0 === 1,
    M10_0: Boolean(state.memory_bits?.M10_0),
  };

  return state;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function routePath(reqUrl) {
  const url = new URL(reqUrl, `http://${HOST}:${PORT}`);
  const clean = url.pathname.replace(/^\/api/, '') || '/';
  return { pathName: clean, searchParams: url.searchParams };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const { pathName, searchParams } = routePath(req.url);

  try {
    if (req.method === 'GET' && pathName === '/health') {
      const state = readJson(STATE_FILE, defaultState);
      send(res, 200, {
        ok: true,
        service: 'plc-local-bridge',
        endpoint: `http://${HOST}:${PORT}`,
        updated_at: state.updated_at,
      });
      return;
    }

    if (req.method === 'GET' && pathName === '/state') {
      send(res, 200, readJson(STATE_FILE, defaultState));
      return;
    }

    if (req.method === 'PUT' && pathName === '/update') {
      const current = readJson(STATE_FILE, defaultState);
      const body = await readBody(req);
      const update = normalizeUpdate(body);
      normalizeAddressImages(update);
      const tagUpdates = collectTagUpdates(body);
      const tagAddresses = Object.keys(tagUpdates);
      const explicitOutputImage = Boolean(update.outputs);
      const explicitOutputTags = tagAddresses.some((address) => /^Q0\.\d$/.test(address));
      const explicitG0 = Object.prototype.hasOwnProperty.call(update, 'mw100')
        || Object.prototype.hasOwnProperty.call(update, 'cycles')
        || tagAddresses.includes('MW100');

      if (!update.outputs && explicitOutputTags) {
        update.outputs = { bits: [...defaultState.outputs.bits] };
      }

      for (const [address, value] of Object.entries(tagUpdates)) {
        applyTagUpdate(update, current, address, value);
      }

      delete update.tags;
      delete update.addresses;
      delete update.variables;

      const next = normalizeEx6State({
        ...current,
        ...update,
        source: update.source || current.source || 'simulator',
        updated_at: update.updated_at || now(),
      }, { explicitOutputs: explicitOutputImage || explicitOutputTags, explicitG0 });
      writeJson(STATE_FILE, next);
      addEvent('state_update', next.source, update);
      send(res, 200, next);
      return;
    }

    if (req.method === 'POST' && pathName === '/reset') {
      const next = normalizeEx6State({ ...defaultState, updated_at: now() });
      writeJson(STATE_FILE, next);
      addEvent('state_reset', 'simulator', {});
      send(res, 200, next);
      return;
    }

    if (req.method === 'GET' && pathName === '/events') {
      const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));
      send(res, 200, readEvents().slice(0, limit));
      return;
    }

    if (req.method === 'GET' && pathName === '/config') {
      send(res, 200, readJson(CONFIG_FILE, defaultConfig));
      return;
    }

    if (req.method === 'PUT' && pathName === '/config') {
      const current = readJson(CONFIG_FILE, defaultConfig);
      const update = await readBody(req);
      const next = {
        ...current,
        ...update,
        tagMap: { ...current.tagMap, ...(update.tagMap || {}) },
      };
      writeJson(CONFIG_FILE, next);
      addEvent('config_update', 'simulator', update);
      send(res, 200, next);
      return;
    }

    send(res, 404, { error: `No route for ${req.method} ${pathName}` });
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  ensureDataDir();
  readJson(STATE_FILE, defaultState);
  readJson(CONFIG_FILE, defaultConfig);
  readJson(EVENTS_FILE, []);
  console.log(`[PLC bridge] Listening on http://${HOST}:${PORT}`);
});
