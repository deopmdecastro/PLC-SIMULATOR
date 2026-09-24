/**
 * Ícones dos componentes — mapa tipo → componente lucide.
 * Mantido separado do catálogo para que a lógica de simulação continue sem React.
 */

import {
  AlignEndHorizontal,
  ArrowRightLeft,
  BellRing,
  CircuitBoard,
  CircleDot,
  Database,
  Fan,
  Flame,
  GitMerge,
  Lightbulb,
  OctagonAlert,
  Radar,
  RectangleHorizontal,
  ScanEye,
  SlidersHorizontal,
  SquareStack,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  TrafficCone,
  Volume2,
  Warehouse,
  Waypoints,
  Wind,
  Package,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AlignEndHorizontal,
  ArrowRightLeft,
  BellRing,
  CircuitBoard,
  CircleDot,
  Database,
  Fan,
  Flame,
  GitMerge,
  Lightbulb,
  OctagonAlert,
  Radar,
  RectangleHorizontal,
  ScanEye,
  SlidersHorizontal,
  SquareStack,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  TrafficCone,
  Volume2,
  Warehouse,
  Waypoints,
  Wind,
};

export function iconForComponent(icon: string): LucideIcon {
  return ICONS[icon] ?? Package;
}

export { ICONS as COMPONENT_ICONS };
