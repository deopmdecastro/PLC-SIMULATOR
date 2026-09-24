Objective: Redesign the existing React/Tailwind `LadderDiagram` component so MAIN / OB1 networks look closer to Siemens TIA Portal LAD networks while staying inside the existing simulator UI.

Audience: PLC students using a S7-1200 simulator side-by-side with TIA Portal.

Aesthetic direction: Dense engineering workstation UI, not marketing. Use the existing dark app shell, but make each network resemble a TIA LAD rung: left/right vertical power rails, horizontal wires, contact symbols with two vertical bars, NC diagonal slash, coils drawn as paired parentheses, small address labels above or below, energized paths highlighted in cyan/green. Avoid decorative cards inside cards.

Content structure: Keep the existing five networks:
1. Master Enable / Permissive: CPU RUN, I0.1 NC, SF NC, BF NC -> M0.0
2. Auto Mode: M0.0, I0.2 -> M0.1 and Q0.3
3. Motor Memory / Seal-in: M0.0 and parallel I0.0/M0.2 branch -> M0.2 and Q0.0
4. Standby / Stopped Outputs: M0.0, M0.1, Q0.0 NC -> Q0.1 and Q0.2
5. Rising Edge Counter: Q0.0 and previous state -> M10.0 / MW100

Technical constraints:
- Work in `src/components/LadderDiagram.tsx`.
- Keep imports from `@/types/plc` and `@/lib/tiaMainProgram`.
- Do not change PLC state shape, bridge API, or scan logic.
- Use existing Tailwind setup. No new dependencies.
- The component must remain responsive and avoid text overflow.
- Keep symbols readable at desktop widths similar to the provided screenshot.

Output path: `src/components/LadderDiagram.tsx`.
