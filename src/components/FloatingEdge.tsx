import {
  BaseEdge,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import { isNeutralColor } from "../lib/colors";
import { DEFAULT_EDGE } from "../lib/mapModel";
import type { MindEdge, MindNode } from "../types";

function box(n: InternalNode<MindNode>) {
  const { x, y } = n.internals.positionAbsolute;
  const width = n.measured.width ?? 0;
  const height = n.measured.height ?? 0;
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

/**
 * Lien « flottant » : il s'accroche au côté du nœud qui fait face à l'autre nœud,
 * quelle que soit la poignée utilisée pour le créer. Il reste donc propre
 * quand on déplace les nœuds.
 */
function edgeEndpoints(source: InternalNode<MindNode>, target: InternalNode<MindNode>) {
  const s = box(source);
  const t = box(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  // Comme dans une carte mentale classique, on relie par les côtés dès que les nœuds
  // sont séparés horizontalement ; sinon (nœuds empilés), par le haut / le bas.
  const horizontalGap = s.x + s.width < t.x || t.x + t.width < s.x;
  const horizontal = horizontalGap || Math.abs(dx) / (s.width + t.width || 1) >= Math.abs(dy) / (s.height + t.height || 1);

  if (horizontal) {
    const toRight = dx >= 0;
    return {
      sx: toRight ? s.x + s.width : s.x,
      sy: s.cy,
      tx: toRight ? t.x : t.x + t.width,
      ty: t.cy,
      sourcePosition: toRight ? Position.Right : Position.Left,
      targetPosition: toRight ? Position.Left : Position.Right,
    };
  }
  const down = dy >= 0;
  return {
    sx: s.cx,
    sy: down ? s.y + s.height : s.y,
    tx: t.cx,
    ty: down ? t.y : t.y + t.height,
    sourcePosition: down ? Position.Bottom : Position.Top,
    targetPosition: down ? Position.Top : Position.Bottom,
  };
}

export function FloatingEdge({ id, source, target, data, selected }: EdgeProps<MindEdge>) {
  const sourceNode = useInternalNode<MindNode>(source);
  const targetNode = useInternalNode<MindNode>(target);
  if (!sourceNode || !targetNode) return null;

  const { path: kind, dashed, arrow } = data ?? DEFAULT_EDGE;
  const p = edgeEndpoints(sourceNode, targetNode);
  const params = {
    sourceX: p.sx,
    sourceY: p.sy,
    sourcePosition: p.sourcePosition,
    targetX: p.tx,
    targetY: p.ty,
    targetPosition: p.targetPosition,
  };
  const [path] =
    kind === "straight"
      ? getStraightPath(params)
      : kind === "step"
        ? getSmoothStepPath({ ...params, borderRadius: 14 })
        : getBezierPath(params);

  // Le lien prend la couleur de la branche (celle du nœud cible) si elle est assez marquée.
  const branchColor = targetNode.data.bgColor;
  const color = selected ? "var(--mm-edge-selected)" : isNeutralColor(branchColor) ? "var(--mm-edge)" : branchColor;
  const markerId = `mm-arrow-${id}`;

  return (
    <>
      {arrow && (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="14"
            markerHeight="14"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" style={{ fill: color }} />
          </marker>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={arrow ? `url(#${markerId})` : undefined}
        interactionWidth={18}
        style={{
          stroke: color,
          strokeWidth: selected ? 3.5 : 2.25,
          strokeDasharray: dashed ? "7 6" : undefined,
          strokeLinecap: "round",
          opacity: selected ? 1 : 0.85,
        }}
      />
    </>
  );
}
