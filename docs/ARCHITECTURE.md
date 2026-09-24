# PLC-SIMULATOR — Arquitetura Técnica

Documento de referência da transformação do projeto de uma aplicação **estática** num
**laboratório PLC interativo** integrado com TIA Portal / PLCSIM.

---

## 1. Análise do projeto existente

### Stack

| Camada | Tecnologia | Ficheiro |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 5 | `src/main.tsx`, `src/App.tsx` |
| Estilo | Tailwind CSS 3 | `tailwind.config.js`, `src/index.css` |
| Ícones | lucide-react | componentes |
| Backend local (legacy) | Node HTTP (CommonJS) | `local_bridge_server.cjs` |
| Backend local (TIA) | Python 3 (urllib) | `tia_bridge.py` |
| Backend cloud | Supabase Edge Function (Deno) + Postgres | `supabase/functions/tia-bridge/index.ts`, `supabase/migrations/*.sql` |
| Simulação de lógica | TypeScript puro | `src/lib/tiaMainProgram.ts`, `src/lib/plcEngine.ts` |

### Ponto de entrada e fluxo de dados atual

```
App.tsx
 └── usePLCSync()                    ← hook único de sincronização
      ├── localBridgeClient          ← fetch para /api (proxy Vite → :8765)
      │     ├── GET  /state
      │     ├── PUT  /update
      │     ├── GET  /events
      │     ├── GET  /config  (PUT /config)
      │     └── GET  /health
      └── scanCycle()                ← scan local (fallback quando o bridge não escreve)
           └── executeMainProgram()  ← OB1 do Ex6 (G0 / MW100, KM1, KM2)
```

### Componentes de interface existentes

| Componente | Estado atual |
|---|---|
| `TitleBar` | estático (mostra RUN/STOP, G0, sync) |
| `Toolbar` | **dinâmico** (START_D, START_E, STOP_NF, FR_NF, reset) |
| `CPUStatus` | dinâmico (RUN/STOP/SF/BF) |
| `IOPanels` (`InputPanel`/`OutputPanel`) | leitura dinâmica, 8 bits fixos, **sem escrita** na tabela |
| `MemoryPanel` | dinâmico, 4 bits fixos + MW100 |
| `LadderDiagram` | dinâmico, específico do Ex6 |
| `ProcessAnimation` | dinâmico mas **hardcoded** ao Ex6 (conveyor + motor) |
| `ConnectionPanel` | estático (documentação de endpoints) |
| `EventLog` | dinâmico, lê `/events` |
| `Legend` | estático |
| `SimulatorConfigPanel` | dinâmico (tags I/O, scan, bridge URL) |

### O que é estático vs. o que precisa ser dinâmico

* **Estático por omissão:** conjunto de variáveis (8 entradas / 8 saídas fixas), cena 2D,
  lista de timers/counters/DBs (não existe), diagnóstico, projetos.
* **Já dinâmico:** valor dos 8+8 bits, MB/MW pontuais, ladder, log de eventos, escrita de
  4 sinais fixos via toolbar.
* **Nada foi removido.** A vista legacy (`usePLCSync` + painéis Ex6) continua intacta e
  acessível no separador **“Ex6 (legacy)”**.

---

## 2. Rota de integração com TIA Portal / PLCSIM — evidência técnica

> Nenhuma API foi inventada. Abaixo, o que cada rota realmente oferece.

| Rota | O que é | Limites reais | Usada no projeto |
|---|---|---|---|
| **S7-PLCSIM Advanced Runtime API** | API .NET oficial (`Siemens.Simatic.Simulation.Runtime`), DLL registada em `C:\Program Files (x86)\Common Files\Siemens\PLCSIMADV\API\` | **Windows only**, .NET, só S7-1500 / ET 200SP. Não corre em Linux/Docker | provider `plcsim-advanced` (via helper .NET) |
| **PLCSIM clássico (S7-300/400)** | Simulador sem API pública; a integração externa faz-se com **NetToPLCsim**, que expõe um servidor de comunicação S7 na rede | Requer NetToPLCsim; sem API gerida | coberto pelo provider S7 (via NetToPLCsim) |
| **Protocolo S7 (ISO-on-TCP / RFC1006)** | snap7 / nodes7 falam diretamente com a CPU | S7-1200/1500 exigem **PUT/GET ativado** e **DBs com acesso otimizado desativado** para endereçamento absoluto. IEC timers/counters vivem em DBs de instância | provider `s7` (nodes7 no gateway local) |
| **Softbus / TCP-IP do PLCSIM Advanced** | Comunicação local entre instância virtual e TIA Portal / clientes | Instância na mesma máquina (softbus) ou rede via *PLCSIM Virtual Ethernet Adapter* (TCP/IP) | documentado em `docs/TIA_SETUP.md` |

Fontes:

* Siemens Industry Online Support — *SIMATIC S7-PLCSIM Advanced Function Manual (API)*.
  <https://support.industry.siemens.com/cs/document/109826197>
* python-snap7 — *TIA Portal Configuration* (PUT/GET + desativar acesso otimizado).
  <https://python-snap7.readthedocs.io/en/latest/tia-portal-config.html>
* Factory I/O — *Setting up S7-PLCSIM Advanced V3.0* (softbus vs. Virtual Ethernet Adapter).
  <https://docs.factoryio.com/tutorials/siemens/setting-up-s7-plcsim-advanced-V3/>
* Siemens SiePortal — *PLCSIM / NetToPLCsim* (S7-300/400 via NetToPLCsim).
  <https://sieportal.siemens.com/en-ww/support/forum/posts/plcsim-nettoplcsim/248492>

**Nunca inventar dados quando não há PLC.** Todos os providers devolvem qualidade
`unknown` / erro explícito, e a UI mostra `PLC DESCONECTADO`.

---

## 3. Arquitetura alvo (implementada)

```
PLC-SIMULATOR
│
├── UI (src/components/lab/)
│   ├── PLCLab.tsx .............. shell com separadores
│   ├── Dashboard .............. estado PLC, contadores de I/O, latência
│   ├── VariablePanels.tsx ..... INPUTS / OUTPUTS / MEMORY / DB / ANALOG (tabelas + escrita)
│   ├── ProcessPanels.tsx ...... TIMERS / COUNTERS / SEQUENCE (STEPS)
│   ├── SimulationEditor.tsx ... biblioteca + canvas 2D + propriedades
│   ├── DiagnosticsPanel.tsx ... diagnóstico de comunicação + event log
│   └── ProjectsPanel.tsx ...... projetos de simulação (guardar/abrir)
│
├── Simulation Engine (src/simulation/)
│   ├── catalog.ts ............. biblioteca de componentes + animações
│   └── scene.ts ............... tipos de cena, bindings e helpers de estado
│
├── PLC Communication (src/plc/)
│   ├── types.ts ............... PLCProvider, PLCVariable*, PLCConnectionInfo
│   ├── address.ts ............. parser I/Q/M/DB/MW/MD/T/C + endianness helpers
│   ├── connectionManager.ts ... discovery, connect, retry/backoff, poll, latência
│   ├── diagnostics.ts ......... bus de eventos com ring buffer
│   └── providers/
│       ├── mockProvider.ts .... Mock PLC (OB1 do processo demo, 100% offline)
│       ├── gatewayClient.ts ... cliente HTTP do gateway local
│       ├── s7Provider.ts ...... protocolo S7 (nodes7) via gateway
│       ├── plcsimAdvancedProvider.ts ... API .NET (Windows) via gateway
│       └── index.ts ........... registry + factory
│
├── Variable System (src/config/)
│   ├── defaultProject.ts ...... definições de variáveis, cena demo, passos
│   └── projectsStore.ts ....... persistência de projetos (localStorage)
│
└── Gateway + Test/Mock (bridge/)
    ├── plc_gateway.cjs ........ gateway local (:8766) — providers mock/s7/plcsim
    ├── mock_plc.cjs ........... réplica do PLC mock em Node (para testes de rede)
    └── plcsim-advanced/ ....... helper .NET (Windows) para o Runtime API
```

### Interface de provider (abstração pedida no ponto 5)

```ts
interface PLCProvider {
  readonly id: string;            // 'mock' | 's7' | 'plcsim-advanced'
  readonly label: string;
  readonly platform: 'any' | 'windows';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionInfo(): PLCConnectionInfo;
  read(definitions: PLCVariableDefinition[]): Promise<PLCVariableValue[]>;
  write(definition: PLCVariableDefinition, value: PLCValue): Promise<void>;
  discover(): Promise<PLCDiscoveryResult[]>;
  start(): Promise<void>;   // RUN
  stop(): Promise<void>;    // STOP
  dispose(): void;
}
```

Todos os providers partilham o mesmo `PLCVariableDefinition`, portanto a UI, o
mapeamento de componentes e o sistema de projetos são **independentes do protocolo**.

---

## 4. Fases (ponto 30) — estado

| Fase | Descrição | Estado |
|---|---|---|
| 1 | Análise do projeto atual | ✅ este documento |
| 2 | Camada de comunicação PLC | ✅ `src/plc/*` + `bridge/plc_gateway.cjs` |
| 3 | Deteção de PLCSIM | ✅ `discover()` em todos os providers + painel de diagnóstico |
| 4 | Estabelecer conexão | ✅ `connectionManager` (retry + backoff + estado) |
| 5 | Ler variáveis | ✅ leitura agrupada por área |
| 6 | Monitor de inputs/outputs | ✅ `VariablePanels.tsx` |
| 7 | Escrita de inputs | ✅ clique/toggle nas tabelas + componentes 2D |
| 8 | Sistema de componentes | ✅ `simulation/catalog.ts` |
| 9 | Editor 2D | ✅ `SimulationEditor.tsx` (drag & drop, mover, apagar) |
| 10 | Mapeamento componente ↔ variável | ✅ painel de propriedades |
| 11 | Animações | ✅ motor, conveyor, cilindro, válvula, lâmpada, buzzer, tanque |
| 12 | Timers/counters/memórias/DBs | ✅ `ProcessPanels.tsx` |
| 13 | Sistema de projetos | ✅ `projectsStore.ts` + `ProjectsPanel.tsx` |
| 14 | Diagnóstico e logs | ✅ `diagnostics.ts` + `DiagnosticsPanel.tsx` |
| 15 | Performance | ✅ poll agrupado, debounce de escrita, backoff, update incremental |

---

## 5. Como correr

```bash
npm install
npm run dev             # frontend :5173
npm run gateway         # gateway PLC :8766 (mock / s7 / plcsim)
npm run bridge          # bridge legacy :8765 (compatibilidade Ex6)
```

Testes locais (Linux/macOS): usar o provider **Mock PLC**, que executa o programa
demo (OB1 estendido) sem TIA Portal. Para PLCSIM real: ver `docs/TIA_SETUP.md`.
