# Ligar o PLC-SIMULATOR a um PLC real simulado (TIA Portal / PLCSIM)

Três cenários possíveis. Escolha um no separador **Diagnóstico → Provider**.

---

## Cenário A — S7-PLCSIM Advanced (S7-1500/1200) · rota oficial

Recomendado quando tem **S7-PLCSIM Advanced** instalado (Windows).

### 1. No TIA Portal

1. Projeto → **Propriedades** → separador **Proteção** → marcar
   **“Apoiar simulação durante a compilação dos blocos”**.
2. CPU → **Propriedades** → **Proteção e segurança** → **Mecanismos de ligação** →
   marcar **“Permitir acesso com comunicação PUT/GET de parceiro remoto”**
   ([python-snap7 docs](https://python-snap7.readthedocs.io/en/latest/tia-portal-config.html)).
3. Para cada **DB** que quer ler em endereçamento absoluto: clique direito → **Propriedades**
   → separador **Atributos** → **desmarcar “Acesso otimizado ao bloco”**.
   ⚠️ Isto reinicializa o DB (perde valores) — faça antes da colocação em serviço.
4. **Compilar** → **Descarregar para dispositivo** → **Iniciar módulo**.

### 2. No painel de controlo do PLCSIM Advanced

1. Dar um **nome de instância** (ex.: `plcsim-plc-simulator`).
2. Escolher o modo de operação:
   * **Softbus (local)** — mesma máquina do TIA Portal;
   * **TCP/IP** — comunicação distribuída, requer o **PLCSIM Virtual Ethernet Adapter**.
     ([Factory I/O](https://docs.factoryio.com/tutorials/siemens/setting-up-s7-plcsim-advanced-V3/))
3. Definir o **IP** da instância (ex.: `192.168.0.1`).
4. **Start** e depois **RUN**.

### 3. No PLC-SIMULATOR

| Campo | Valor |
|---|---|
| Provider | `PLCSIM Advanced (API .NET)` |
| IP | o IP da instância (`192.168.0.1`) |
| Rack / Slot | `0` / `1` (S7-1500) |
| Instance name | o nome dado no painel do PLCSIM Advanced |
| Gateway | `http://127.0.0.1:8766/plc-api` |

O gateway faz *proxy* para o helper .NET em `bridge/plcsim-advanced/`
(`Siemens.Simatic.Simulation.Runtime.dll`). **Só corre em Windows.**

---

## Cenário B — PLCSIM clássico + NetToPLCsim (S7-300/400 ou S7-1200/1500 com PUT/GET)

O PLCSIM clássico **não tem API pública**; a integração externa é feita com
**NetToPLCsim**, que expõe um servidor de comunicação S7 na interface de rede
([SiePortal](https://sieportal.siemens.com/en-ww/support/forum/posts/plcsim-nettoplcsim/248492)).

1. Iniciar o PLCSIM clássico com o projeto descarregado e em **RUN**.
2. Iniciar o **NetToPLCsim** → **Add station** → IP local da máquina → IP do PLC
   virtual + rack/slot → **Start**.
3. No PLC-SIMULATOR escolher o provider **S7 (protocolo S7 / PUT-GET)** com:
   * IP = IP local configurado no NetToPLCsim,
   * Rack = `0`, Slot = `2` (S7-300/400) — confirme na configuração de hardware.

---

## Cenário C — Mock PLC (sem TIA Portal)

Provider **Mock PLC (offline/demo)**: executa em TypeScript um programa OB1 demo
(motor D/E com KM1/KM2 + cilindro, válvula, conveyor, sensores, timers, counters e DBs).
Serve para testar toda a interface, o editor 2D e o mapeamento sem hardware.

---

## Rack / Slot de referência

| CPU | Rack | Slot |
|---|---|---|
| S7-1500 | 0 | 1 |
| S7-1200 | 0 | 1 |
| S7-300 | 0 | 2 |
| S7-400 | 0 | 2 |

## Portas

| Porta | Serviço |
|---|---|
| 5173 | Frontend Vite |
| 8765 | Bridge legacy Ex6 (`local_bridge_server.cjs`) |
| 8766 | Gateway PLC (`bridge/plc_gateway.cjs`) |
| 8770 | Helper .NET PLCSIM Advanced (Windows) |
| 102 | Protocolo S7 (ISO-on-TCP) do PLC/NetToPLCsim |

## Resolução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `CLI : function refused by CPU` | PUT/GET desativado | ativar PUT/GET na CPU |
| Leitura de DB devolve zeros | DB com acesso otimizado | desativar acesso otimizado no DB |
| `PLCSIM não encontrado` | instância não iniciada | iniciar instância no painel do PLCSIM Advanced |
| Timeout de ligação | falta o Virtual Ethernet Adapter | usar softbus ou instalar o adaptador |
| Erro de comunicação 0x… | endereço inexistente | confirmar endereço na tabela de tags |
| Valores “unknown” | PLC em STOP | colocar a CPU em RUN |
