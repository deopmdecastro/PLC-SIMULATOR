#!/usr/bin/env python3
"""
S7-1200 PLC Simulator - TIA Portal Bridge Script
=================================================

This script connects TIA Portal / S7-PLCSIM to the web-based PLC simulator
through the Supabase Edge Function bridge.

PREREQUISITES:
    pip install requests

USAGE:
    1. Start the web simulator (it runs automatically in your browser)
    2. Run this script:  python tia_bridge.py
    3. The script will poll the simulator state and allow TIA Portal
       to read/write PLC variables in real-time.

INTEGRATION WITH TIA PORTAL:
    - In TIA Portal, create a VBScript or C# script that calls this bridge
    - Use the Open Communication (OPC UA) or S7 Communication API
    - Map PLC tags to the JSON fields in the bridge API

API ENDPOINTS:
    GET  /state       - Read current PLC state
    PUT  /update      - Write PLC state from TIA Portal
    GET  /events      - Read event log
    GET  /health      - Health check

PLC TAG MAPPING:
    I0.0 (Start)     -> start_pressed (bool)
    I0.1 (Stop NF)   -> stop_held (bool, inverted: True = pressed)
    I0.2 (Auto)      -> auto_mode (bool)
    Q0.0 (Motor)     -> outputs.bits[7] (bool)
    Q0.1 (Standby)   -> outputs.bits[6] (bool)
    Q0.2 (Stopped)   -> outputs.bits[5] (bool)
    Q0.3 (Auto LED)  -> outputs.bits[4] (bool)
    M0.0             -> memory_bits.M0_0 (bool)
    M0.1             -> memory_bits.M0_1 (bool)
    MW100            -> mw100 (int)
"""

import requests
import json
import time
import sys
import threading
from datetime import datetime

# =============================================================================
# CONFIGURATION - Replace these with your Supabase project values
# =============================================================================
# Found in your project .env file:
#   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
#
# The BRIDGE_URL is your Supabase URL + /functions/v1/tia-bridge
# =============================================================================

BRIDGE_URL = "REPLACE_WITH_YOUR_SUPABASE_URL/functions/v1/tia-bridge"
ANON_KEY  = "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY"

HEADERS = {
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
}

POLL_INTERVAL = 0.5  # seconds


class PLCBridge:
    """Bidirectional bridge between TIA Portal and the web PLC simulator."""

    def __init__(self):
        self.running = False
        self.last_state = None
        self.lock = threading.Lock()

    def read_state(self):
        """Read the current PLC state from the web simulator."""
        try:
            resp = requests.get(f"{BRIDGE_URL}/state", headers=HEADERS, timeout=5)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to read state: {e}")
            return None

    def write_state(self, updates):
        """Write PLC state changes from TIA Portal to the web simulator."""
        try:
            payload = {**updates, "source": "tia-portal"}
            resp = requests.put(
                f"{BRIDGE_URL}/update",
                headers=HEADERS,
                json=payload,
                timeout=5
            )
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to write state: {e}")
            return None

    def press_start(self, duration=0.3):
        """Simulate pressing the Start button (I0.0) momentarily."""
        print("[TIA->SIM] Pressing START (I0.0)...")
        self.write_state({"start_pressed": True})
        time.sleep(duration)
        self.write_state({"start_pressed": False})

    def press_stop(self, duration=0.5):
        """Simulate pressing the Stop button (I0.1) momentarily."""
        print("[TIA->SIM] Pressing STOP (I0.1)...")
        self.write_state({"stop_held": True})
        time.sleep(duration)
        self.write_state({"stop_held": False})

    def set_auto_mode(self, auto=True):
        """Set Auto/Manual mode (I0.2)."""
        print(f"[TIA->SIM] Setting AUTO mode = {auto}")
        self.write_state({"auto_mode": auto})

    def set_run(self, run=True):
        """Set CPU to RUN or STOP."""
        print(f"[TIA->SIM] Setting CPU {'RUN' if run else 'STOP'}")
        self.write_state({"run": run})

    def reset_faults(self):
        """Reset all fault indicators."""
        print("[TIA->SIM] Resetting faults")
        self.write_state({"sf": False, "bf": False})

    def poll_loop(self):
        """Continuously poll PLC state and display changes."""
        print("[BRIDGE] Starting poll loop...")
        self.running = True
        while self.running:
            state = self.read_state()
            if state and state != self.last_state:
                with self.lock:
                    self.last_state = state
                self._display_state(state)
            time.sleep(POLL_INTERVAL)

    def _display_state(self, state):
        """Pretty-print the PLC state."""
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        run = "RUN" if state.get("run") else "STOP"
        auto = "AUTO" if state.get("auto_mode") else "MANUAL"
        latch = state.get("latch", False)
        cycles = state.get("cycles", 0)
        source = state.get("source", "?")

        inputs = state.get("inputs", {}).get("bits", [])
        outputs = state.get("outputs", {}).get("bits", [])

        i0_0 = inputs[7] if len(inputs) > 7 else False
        i0_1 = not state.get("stop_held", False)
        i0_2 = state.get("auto_mode", False)

        q0_0 = outputs[7] if len(outputs) > 7 else False
        q0_1 = outputs[6] if len(outputs) > 6 else False
        q0_2 = outputs[5] if len(outputs) > 5 else False
        q0_3 = outputs[4] if len(outputs) > 4 else False

        print(f"\n[{ts}] CPU={run} | {auto} | Source={source}")
        print(f"  Inputs:  I0.0={int(i0_0)} I0.1(NF)={int(i0_1)} I0.2={int(i0_2)}")
        print(f"  Outputs: Q0.0={int(q0_0)} Q0.1={int(q0_1)} Q0.2={int(q0_2)} Q0.3={int(q0_3)}")
        print(f"  Latch={int(latch)} | Cycles={cycles} | MW100={state.get('mw100', 0)}")

    def health_check(self):
        """Check if the bridge is reachable."""
        try:
            resp = requests.get(f"{BRIDGE_URL}/health", headers=HEADERS, timeout=5)
            if resp.ok:
                print(f"[OK] Bridge is healthy: {resp.json()}")
                return True
            else:
                print(f"[FAIL] Bridge returned {resp.status_code}")
                return False
        except Exception as e:
            print(f"[FAIL] Cannot reach bridge: {e}")
            return False


def interactive_menu(bridge):
    """Interactive command menu for testing."""
    print("\n" + "=" * 60)
    print("  S7-1200 PLC Simulator - TIA Portal Bridge")
    print("=" * 60)

    if not bridge.health_check():
        print("\n[ERROR] Cannot reach the bridge. Check BRIDGE_URL and ANON_KEY.")
        print("Make sure the web simulator is running and the edge function is deployed.")
        return

    # Start polling in background
    poll_thread = threading.Thread(target=bridge.poll_loop, daemon=True)
    poll_thread.start()

    while True:
        print("\n--- Commands ---")
        print("  1. Press START (I0.0)")
        print("  2. Press STOP  (I0.1)")
        print("  3. Toggle AUTO/MANUAL")
        print("  4. CPU RUN")
        print("  5. CPU STOP")
        print("  6. Reset Faults")
        print("  7. Read State (once)")
        print("  8. Quit")
        print("  (polling runs in background)")

        choice = input("\nChoice: ").strip()

        if choice == "1":
            bridge.press_start()
        elif choice == "2":
            bridge.press_stop()
        elif choice == "3":
            current = bridge.last_state or {}
            bridge.set_auto_mode(not current.get("auto_mode", False))
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
            print("Goodbye!")
            break
        else:
            print("Invalid choice")
        time.sleep(0.1)


if __name__ == "__main__":
    if "REPLACE_WITH" in BRIDGE_URL or "REPLACE_WITH" in ANON_KEY:
        print("=" * 60)
        print("  CONFIGURATION REQUIRED")
        print("=" * 60)
        print()
        print("Before running this script, you need to set:")
        print()
        print("  BRIDGE_URL = Your Supabase URL + /functions/v1/tia-bridge")
        print("  ANON_KEY  = Your Supabase anon key")
        print()
        print("These values are found in your project's .env file:")
        print("  VITE_SUPABASE_URL     -> use this + /functions/v1/tia-bridge")
        print("  VITE_SUPABASE_ANON_KEY -> use this as the ANON_KEY")
        print()
        print("Example:")
        print('  BRIDGE_URL = "https://abcdefgh.supabase.co/functions/v1/tia-bridge"')
        print('  ANON_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6..."')
        sys.exit(1)

    bridge = PLCBridge()
    try:
        interactive_menu(bridge)
    except KeyboardInterrupt:
        bridge.running = False
        print("\nInterrupted. Goodbye!")
