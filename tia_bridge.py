#!/usr/bin/env python3
"""
Local TIA Portal bridge for the reusable PLC simulator.

Default endpoint:
    http://127.0.0.1:8765

Run:
    python tia_bridge.py
    python tia_bridge.py --endpoint http://127.0.0.1:8765 --poll 0.5

Environment variables:
    PLC_BRIDGE_URL
    PLC_BRIDGE_TOKEN

REST endpoints used:
    GET  /state
    PUT  /update
    GET  /events
    GET  /health

Typical tag mapping:
    START_D  I0.0   -> start_pressed
    START_E  I0.1   -> start_e_pressed
    STOP_NF  I0.2   -> stop_nf_closed
    FR_NF    I0.3   -> fr_nf_closed
    KM1      Q0.0   -> outputs.bits[7]
    KM2      Q0.1   -> outputs.bits[6]
    G0       MW100  -> mw100
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


class PLCBridge:
    """Bidirectional bridge between TIA Portal scripts and the simulator API."""

    def __init__(self, endpoint: str, poll_interval: float, token: str | None = None):
        self.endpoint = endpoint.rstrip("/") + "/"
        self.poll_interval = poll_interval
        self.token = token
        self.running = False
        self.last_state: dict[str, Any] | None = None
        self.lock = threading.Lock()

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            urljoin(self.endpoint, path.lstrip("/")),
            data=body,
            headers=self._headers(),
            method=method,
        )

        with urlopen(request, timeout=5) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}

    def read_state(self) -> dict[str, Any] | None:
        try:
            return self._request("GET", "/state")
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"[ERROR] Failed to read state: {error}")
            return None

    def write_state(self, updates: dict[str, Any]) -> dict[str, Any] | None:
        try:
            payload = {**updates, "source": "tia-portal"}
            return self._request("PUT", "/update", payload)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"[ERROR] Failed to write state: {error}")
            return None

    def write_tags(self, tags: dict[str, Any]) -> dict[str, Any] | None:
        """Write TIA-style address values, for example {"I0.0": True, "Q0.0": True}."""
        return self.write_state({"tags": tags})

    def press_start(self, duration: float = 0.3) -> None:
        print("[TIA->SIM] Pressing START_D (I0.0)")
        self.write_state({"start_pressed": True})
        time.sleep(duration)
        self.write_state({"start_pressed": False})

    def press_start_e(self, duration: float = 0.3) -> None:
        print("[TIA->SIM] Pressing START_E (I0.1)")
        self.write_state({"start_e_pressed": True})
        time.sleep(duration)
        self.write_state({"start_e_pressed": False})

    def press_stop(self, duration: float = 0.5) -> None:
        print("[TIA->SIM] Opening STOP_NF (I0.2)")
        self.write_state({"stop_nf_closed": False, "stop_held": True})
        time.sleep(duration)
        self.write_state({"stop_nf_closed": True, "stop_held": False})

    def set_auto_mode(self, auto: bool = True) -> None:
        print(f"[TIA->SIM] Setting AUTO mode = {auto}")
        self.write_state({"auto_mode": auto})

    def set_run(self, run: bool = True) -> None:
        print(f"[TIA->SIM] Setting CPU {'RUN' if run else 'STOP'}")
        self.write_state({"run": run})

    def reset_faults(self) -> None:
        print("[TIA->SIM] Resetting faults")
        self.write_state({"sf": False, "bf": False})

    def poll_loop(self) -> None:
        print("[BRIDGE] Polling simulator state")
        self.running = True
        while self.running:
            state = self.read_state()
            if state and state != self.last_state:
                with self.lock:
                    self.last_state = state
                self._display_state(state)
            time.sleep(self.poll_interval)

    def _display_state(self, state: dict[str, Any]) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        run = "RUN" if state.get("run") else "STOP"
        latch = state.get("latch", False)
        cycles = state.get("cycles", 0)
        source = state.get("source", "?")

        inputs = (state.get("inputs") or {}).get("bits", [])
        outputs = (state.get("outputs") or {}).get("bits", [])

        i0_0 = inputs[7] if len(inputs) > 7 else False
        i0_1 = inputs[6] if len(inputs) > 6 else state.get("start_e_pressed", False)
        i0_2 = inputs[5] if len(inputs) > 5 else state.get("stop_nf_closed", False)
        i0_3 = inputs[4] if len(inputs) > 4 else state.get("fr_nf_closed", False)

        q0_0 = outputs[7] if len(outputs) > 7 else False
        q0_1 = outputs[6] if len(outputs) > 6 else False
        q0_2 = outputs[5] if len(outputs) > 5 else False
        q0_3 = outputs[4] if len(outputs) > 4 else False

        print(f"\n[{timestamp}] CPU={run} | Source={source}")
        print(f"  Inputs:  START_D I0.0={int(i0_0)} START_E I0.1={int(i0_1)} STOP_NF I0.2={int(i0_2)} FR_NF I0.3={int(i0_3)}")
        print(f"  Outputs: KM1 Q0.0={int(q0_0)} KM2 Q0.1={int(q0_1)} Q0.2={int(q0_2)} Q0.3={int(q0_3)}")
        memory = state.get("memory_bits") or {}
        print(
            "  Memory:  "
            f"M0.0={int(bool(memory.get('M0_0', False)))} "
            f"M0.1={int(bool(memory.get('M0_1', False)))} "
            f"M0.2={int(bool(memory.get('M0_2', False)))} "
            f"M10.0={int(bool(memory.get('M10_0', False)))}"
        )
        print(f"  Latch={int(latch)} | Cycles={cycles} | MW100={state.get('mw100', 0)}")

    def health_check(self) -> bool:
        try:
            health = self._request("GET", "/health")
            print(f"[OK] Bridge healthy: {health}")
            return True
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"[FAIL] Cannot reach bridge at {self.endpoint}: {error}")
            return False


def interactive_menu(bridge: PLCBridge) -> None:
    print("\n" + "=" * 64)
    print("  Reusable PLC Simulator - TIA Portal Bridge")
    print("=" * 64)
    print(f"Endpoint: {bridge.endpoint}")

    if not bridge.health_check():
        print("\nStart the local bridge first:")
        print("  npm run bridge")
        return

    poll_thread = threading.Thread(target=bridge.poll_loop, daemon=True)
    poll_thread.start()

    while True:
        print("\n--- Commands ---")
        print("  1. Press START_D (I0.0)")
        print("  2. Press STOP_NF (I0.2)")
        print("  3. Press START_E (I0.1)")
        print("  4. CPU RUN")
        print("  5. CPU STOP")
        print("  6. Reset Faults")
        print("  7. Read State once")
        print("  8. Quit")

        choice = input("\nChoice: ").strip()

        if choice == "1":
            bridge.press_start()
        elif choice == "2":
            bridge.press_stop()
        elif choice == "3":
            bridge.press_start_e()
        elif choice == "4":
            bridge.set_run(True)
        elif choice == "5":
            bridge.set_run(False)
        elif choice == "6":
            bridge.reset_faults()
        elif choice == "7":
            state = bridge.read_state()
            if state:
                bridge._display_state(state)
        elif choice == "8":
            bridge.running = False
            print("Goodbye.")
            break
        else:
            print("Invalid choice")

        time.sleep(0.1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TIA Portal bridge for the local PLC simulator")
    parser.add_argument(
        "--endpoint",
        default=os.getenv("PLC_BRIDGE_URL", "http://127.0.0.1:8765"),
        help="Bridge endpoint URL. Default: %(default)s",
    )
    parser.add_argument(
        "--poll",
        type=float,
        default=float(os.getenv("PLC_BRIDGE_POLL", "0.5")),
        help="Polling interval in seconds. Default: %(default)s",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("PLC_BRIDGE_TOKEN"),
        help="Optional bearer token for secured bridge endpoints.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    bridge = PLCBridge(args.endpoint, args.poll, args.token)
    try:
        interactive_menu(bridge)
    except KeyboardInterrupt:
        bridge.running = False
        print("\nInterrupted.")
        sys.exit(0)
