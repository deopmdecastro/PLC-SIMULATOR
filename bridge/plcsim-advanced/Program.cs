// Helper HTTP que liga o gateway local (bridge/plc_gateway.cjs) à API oficial
// do SIMATIC S7-PLCSIM Advanced.
//
// Cobertura: Windows apenas (a API é .NET). S7-1500 / ET 200SP.
// Documentação: Siemens Industry Online Support, ID 109826197 (Function Manual API)
//               e ID 109773484 (V3.0 DLL import functions).
//
// Este ficheiro é um ESQUELETO HONESTAMENTE INCOMPLETO: o servidor HTTP e o
// contrato estão prontos, mas as chamadas à API da Siemens estão marcadas com
// `TODO(API)` de propósito. Não inventamos assinaturas de API — siga o Function
// Manual (secção 2.2 "Using the API") para as completar.

using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

// using Siemens.Simatic.Simulation.Runtime;  // TODO(API): descomentar após
// adicionar a referência à DLL:
//   C:\Program Files (x86)\Common Files\Siemens\PLCSIMADV\API\<versão>\Siemens.Simatic.Simulation.Runtime.dll

namespace PlcSimAdvanced.Helper
{
    internal sealed class ItemRequest
    {
        [JsonPropertyName("address")] public string? Address { get; set; }
        [JsonPropertyName("dataType")] public string? DataType { get; set; }
        [JsonPropertyName("value")] public JsonElement Value { get; set; }
    }

    internal sealed class ConnectRequest
    {
        [JsonPropertyName("instanceName")] public string? InstanceName { get; set; }
        [JsonPropertyName("ip")] public string? Ip { get; set; }
        [JsonPropertyName("timeoutMs")] public int TimeoutMs { get; set; } = 3000;
    }

    internal static class Program
    {
        private const string Prefix = "http://127.0.0.1:8770/";

        // TODO(API): substituir por IRemoteRuntimeManager / IInstance, obtidos via
        // IRemoteRuntimeManager.CreateInterface(...) conforme o Function Manual.
        private static string? _connectedInstance;
        private static bool _connected;

        private static int Main()
        {
            using var listener = new HttpListener();
            listener.Prefixes.Add(Prefix);
            try
            {
                listener.Start();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[helper] Não foi possível abrir {Prefix}: {ex.Message}");
                return 1;
            }

            Console.WriteLine($"[helper] PLCSIM Advanced helper a escutar em {Prefix}");
            Console.WriteLine("[helper] Aviso: chamadas à API Siemens ainda não implementadas — ver TODO(API).");

            while (true)
            {
                var context = listener.GetContext();
                try
                {
                    Route(context);
                }
                catch (Exception ex)
                {
                    Respond(context, 400, new { error = ex.Message });
                }
            }
        }

        private static void Route(HttpListenerContext context)
        {
            var path = context.Request.Url?.AbsolutePath ?? "/";
            var method = context.Request.HttpMethod;

            switch (method, path)
            {
                case ("POST", "/connect"):
                    Connect(context);
                    return;
                case ("POST", "/disconnect"):
                    _connected = false;
                    _connectedInstance = null;
                    Respond(context, 200, new { ok = true });
                    return;
                case ("GET", "/discover"):
                    Discover(context);
                    return;
                case ("POST", "/read"):
                    Read(context);
                    return;
                case ("POST", "/write"):
                    Write(context);
                    return;
                case ("POST", "/cpu/run"):
                    Respond(context, 200, new { ok = true, mode = "RUN" });
                    return;
                case ("POST", "/cpu/stop"):
                    Respond(context, 200, new { ok = true, mode = "STOP" });
                    return;
                case ("GET", "/status"):
                    Respond(context, 200, new
                    {
                        ok = _connected,
                        mode = _connected ? "RUN" : "UNKNOWN",
                        cycleTimeMs = (double?)null,
                        meta = new { instance = _connectedInstance }
                    });
                    return;
                default:
                    Respond(context, 404, new { error = $"Sem rota para {method} {path}" });
                    return;
            }
        }

        private static void Connect(HttpListenerContext context)
        {
            var body = ReadJson<ConnectRequest>(context) ?? new ConnectRequest();

            // TODO(API): com a DLL da Siemens referenciada:
            //   1) obter o gestor de runtime;
            //   2) registar/obter a instância pelo nome (`body.InstanceName`);
            //   3) associar o adaptador/IP (`body.Ip`);
            //   4) ler o modo de operação e o tempo de ciclo;
            //   5) ligar a lista de tags.
            // Ver Function Manual 109826197, secção 2.2.
            if (string.IsNullOrWhiteSpace(body.InstanceName))
            {
                Respond(context, 400, new { error = "instanceName é obrigatório." });
                return;
            }

            _connectedInstance = body.InstanceName;
            _connected = false;

            Respond(context, 501, new
            {
                error = "Helper .NET presente mas a API Siemens ainda não está ligada (TODO(API)). " +
                        "Siga o Function Manual 109826197 para implementar o Connect.",
                instanceName = body.InstanceName,
                platform = "windows"
            });
        }

        private static void Discover(HttpListenerContext context)
        {
            // TODO(API): enumerar as instâncias registadas no runtime e devolver
            // id/label/address/cpu/detail/reachable por cada uma.
            Respond(context, 200, new
            {
                items = Array.Empty<object>(),
                note = "Deteção de instâncias ainda não implementada (TODO(API))."
            });
        }

        private static void Read(HttpListenerContext context)
        {
            if (!_connected)
            {
                Respond(context, 400, new { error = "Sem instância ligada." });
                return;
            }

            // TODO(API): para cada endereço, ler o valor (ReadBool/ReadInt/ReadFloat
            // ou a lista de tags) e devolver { address, value, quality }.
            Respond(context, 501, new { error = "Leitura ainda não implementada (TODO(API))." });
        }

        private static void Write(HttpListenerContext context)
        {
            if (!_connected)
            {
                Respond(context, 400, new { error = "Sem instância ligada." });
                return;
            }

            // TODO(API): escrever o valor no endereço indicado.
            Respond(context, 501, new { error = "Escrita ainda não implementada (TODO(API))." });
        }

        /* --------------------------- utilitários HTTP --------------------------- */

        private static T? ReadJson<T>(HttpListenerContext context)
        {
            using var reader = new System.IO.StreamReader(context.Request.InputStream, Encoding.UTF8);
            var raw = reader.ReadToEnd();
            if (string.IsNullOrWhiteSpace(raw)) return default;
            return JsonSerializer.Deserialize<T>(raw);
        }

        private static void Respond(HttpListenerContext context, int status, object payload)
        {
            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
            context.Response.ContentLength64 = bytes.Length;
            context.Response.OutputStream.Write(bytes, 0, bytes.Length);
            context.Response.OutputStream.Close();
        }
    }
}
