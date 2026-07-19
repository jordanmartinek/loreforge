import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type NodeObject, type LinkObject } from "react-force-graph-2d";
import { useGraphData, type GraphLink, type GraphNode } from "./useGraphData";
import { GraphFilters } from "./GraphFilters";
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_KEYS, ENTITY_TYPE_LABELS } from "../../lib/entityTypes";
import type { EntityTypeKey } from "../../lib/entityTypes";

const DIMMED_COLOR = "#33333f";
const LABEL_TEXT_COLOR = "#eceef3";
const LABEL_TEXT_COLOR_DIMMED = "#55555f";
const LABEL_BACKGROUND_COLOR = "rgba(10, 10, 15, 0.75)";

type FgNode = NodeObject<GraphNode>;
type FgLink = LinkObject<GraphNode, GraphLink>;

/** Matches force-graph's own internal node-radius formula
 * (`Math.sqrt(nodeVal) * nodeRelSize`, see canvas-force-graph.js) so the
 * label drawn in our custom nodeCanvasObject lines up with the actual
 * circle the library renders, rather than guessing at a fixed offset. */
function nodeRadius(node: GraphNode): number {
  return Math.sqrt(Math.max(0, 1 + node.degree)) * 5;
}

export function UniverseGraph() {
  // Every entity type is shown by default (Phase 12 FR1.1/FR2.1) -- the
  // whole point of this expansion is "see everything at a glance" without
  // the user having to opt in per type first, unlike Phase 1 where
  // Character was the only type that existed at all.
  const [activeTypes, setActiveTypes] = useState<Set<EntityTypeKey>>(
    () => new Set(ENTITY_TYPE_KEYS),
  );
  const [hoveredNode, setHoveredNode] = useState<FgNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, links, isLoading, hasAnyEntities } = useGraphData(activeTypes);

  const toggleType = useCallback((type: EntityTypeKey) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // 1-hop neighborhood of the selected node, used to dim everything else
  // (FR5.3). Computed fresh whenever selection or the link set changes.
  const highlighted = useMemo(() => {
    if (!selectedNodeId) return null;
    const neighborIds = new Set<string>([selectedNodeId]);
    const linkIds = new Set<string>();
    for (const link of links) {
      if (link.source === selectedNodeId || link.target === selectedNodeId) {
        neighborIds.add(link.source);
        neighborIds.add(link.target);
        linkIds.add(link.id);
      }
    }
    return { neighborIds, linkIds };
  }, [selectedNodeId, links]);

  const graphData = useMemo(
    () => ({
      nodes,
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links],
  );

  // Draws each node's name as a persistent label beneath it (Phase 12
  // FR1.2), rather than only on hover (Phase 1's original behavior) --
  // this is the core of the "see everything at a glance" ask. Mode
  // "after" lets ForceGraph2D draw its normal circle first, then this
  // paints the text on top -- see force-graph's canvas-force-graph.js
  // paintNodes() for why "after" is the composable choice here (vs.
  // "replace", which would mean re-implementing the circle ourselves).
  const nodeCanvasObject = useCallback(
    (node: FgNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x == null || node.y == null) return;

      const isDimmed = !!highlighted && !highlighted.neighborIds.has(node.id as string);
      const r = nodeRadius(node);
      // Font size shrinks as the user zooms in (globalScale grows) and
      // grows as they zoom out, so labels stay a roughly constant *screen*
      // size rather than scaling 1:1 with the graph -- the standard
      // react-force-graph label pattern.
      const fontSize = Math.max(3, 11 / globalScale);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const label = node.name;
      const textWidth = ctx.measureText(label).width;
      const paddingX = 2;
      const paddingY = 1;
      const labelY = node.y + r + 1;

      // A subtle background box keeps the label legible over other nodes/
      // links in a dense graph, without needing a separate legend/overlay
      // element outside the canvas.
      ctx.fillStyle = LABEL_BACKGROUND_COLOR;
      ctx.fillRect(
        node.x - textWidth / 2 - paddingX,
        labelY,
        textWidth + paddingX * 2,
        fontSize + paddingY * 2,
      );

      ctx.fillStyle = isDimmed ? LABEL_TEXT_COLOR_DIMMED : LABEL_TEXT_COLOR;
      ctx.fillText(label, node.x, labelY + paddingY);
    },
    [highlighted],
  );

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading graph…</p>;
  }

  // "Nothing exists at all" (FR2.4) shows the original empty state, with
  // no filter bar -- there's nothing to filter yet. "Something exists, but
  // the current filter selection hides all of it" is a *different* state:
  // the filter bar must stay visible so the user can turn a type back on,
  // otherwise toggling off the only type with data would make the entire
  // graph view -- including the controls needed to undo that -- vanish.
  if (!hasAnyEntities) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        No nodes yet. Create some characters, locations, or other story elements to see the
        universe graph come alive.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <GraphFilters activeTypes={activeTypes} onToggle={toggleType} />
        {hoveredNode && (
          <div className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              {hoveredNode.name}
            </span>
            {" · "}
            {ENTITY_TYPE_LABELS[hoveredNode.entityType]}
            {hoveredNode.subtitle ? ` · ${hoveredNode.subtitle}` : ""}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)]"
      >
        {nodes.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[var(--color-text-tertiary)]">
            No entities match the active filters. Toggle a type above to show it.
          </p>
        )}
        <ForceGraph2D<GraphNode, GraphLink>
          graphData={graphData}
          nodeId="id"
          nodeLabel={() => ""}
          backgroundColor="transparent"
          linkColor={(link: FgLink) => {
            if (!highlighted) return "#3a3a4a";
            return highlighted.linkIds.has(link.id) ? "#7c7ff2" : "#22222a";
          }}
          linkWidth={(link: FgLink) => 1 + link.strength * 2}
          nodeRelSize={5}
          nodeColor={(node: FgNode) => {
            const base = ENTITY_TYPE_COLORS[node.entityType] ?? "#9b9bab";
            if (!highlighted) return base;
            return highlighted.neighborIds.has(node.id) ? base : DIMMED_COLOR;
          }}
          nodeVal={(node: FgNode) => 1 + node.degree}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "after"}
          onNodeHover={(node) => setHoveredNode(node ?? null)}
          onNodeClick={(node) =>
            setSelectedNodeId((prev) => (prev === node.id ? null : (node.id as string)))
          }
          onBackgroundClick={() => setSelectedNodeId(null)}
          enableNodeDrag
          cooldownTicks={100}
        />
      </div>
    </div>
  );
}
