# Helper .NET — PLCSIM Advanced Runtime API

Este diretório contém o *helper* Windows que liga o gateway local
(`bridge/plc_gateway.cjs`, provider `plcsim-advanced`) à API oficial da Siemens.

## Porque é necessário

A API de simulação da Siemens é uma **biblioteca .NET** e **só existe em
Windows**:

* *SIMATIC S7-PLCSIM Advanced — Function Manual (API)*,
  Siemens Industry Online Support, ID **109826197** —
  <https://support.industry.siemens.com/cs/document/109826197>
* ID **109773484** (V3.0, DLL import functions) —
  <https://support.industry.siemens.com/cs/document/109773484>
* A DLL é instalada em
  `C:\Program Files (x86)\Common Files\Siemens\PLCSIMADV\API\`
  (referido em <https://forum.realvirtual.io/communities/1/topics/949-plcsimadvancedcoupler-missingmethodexception-iremoteruntimemanagercreateinterface-not-found-all-api>)

O servidor de desenvolvimento deste repositório corre em Linux, portanto **este
helper não é executável aqui** — o provider responde com um erro explícito que
diz exatamente isso. Nenhum valor é simulado no lugar da API real.

Cobertura: S7-1500 e ET 200SP (PLCSIM Advanced). Para S7-300/400 usar o
provider **S7** com **NetToPLCsim** (ver `docs/TIA_SETUP.md`).

## Contrato exigido pelo gateway

O helper deve expor HTTP em `http://127.0.0.1:8770`:

| Método | Rota | Pedido | Resposta |
|---|---|---|---|
| POST | `/connect` | `{ instanceName, ip, timeoutMs }` | `{ mode, cycleTimeMs, message }` |
| POST | `/disconnect` | `{}` | `{ ok: true }` |
| GET | `/discover` | — | `{ items: [{ id, label, address, cpu, detail, reachable }] }` |
| POST | `/read` | `{ items: [{ address, dataType }] }` | `{ items: [{ address, value, quality, error? }], latencyMs }` |
| POST | `/write` | `{ address, dataType, value }` | `{ ok: true }` |
| POST | `/cpu/run` · `/cpu/stop` | `{}` | `{ ok: true, mode }` |
| GET | `/status` | — | `{ ok, mode, cycleTimeMs, meta }` |

## Compilar

```powershell
cd bridge\plcsim-advanced
dotnet build -c Release
dotnet run -c Release            # escuta em http://127.0.0.1:8770
```

Requer o **.NET SDK** e o **S7-PLCSIM Advanced** instalado (a API é referenciada
por caminho, não como pacote NuGet).

## Implementar

`Program.cs` define o esqueleto HTTP e marca com `// TODO(API)` os pontos onde
as chamadas à API oficial devem ser escritas, seguindo o Function Manual da
Siemens (ID 109826197). Os nomes usados como âncora
(`IRemoteRuntimeManager`, `CreateInterface`, caminho da pasta `API`) vêm da
documentação/foruns oficiais citados acima; **não são inventados**.
