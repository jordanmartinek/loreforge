import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type NodeObject, type LinkObject } from "react-force-graph-2d";
import { useGraphData, type GraphLink, type GraphNode } from "./useGraphData";
import { GraphFilters } from "./GraphFilters";

const ROLE_COLOR: Record<string, string> = {
  main: "#7c7ff2",
  supporting: "#3ddc97",
  minor: "#6b6b7d",
};

const DIMMED_COLOR = "#33333f";

type FgNode = NodeObject<GraphNode>;
type FgLink = LinkObject<GraphNode, GraphLink>;

export function UniverseGraph() {
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(["character"]));
  const [hoveredNode, setHoveredNode] = useState<FgNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, links, isLoading } = useGraphData(activeTypes);

  const toggleType = useCallback((type: string) => {
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

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading graph…</p>;
  }

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        No nodes yet. Create some characters to see the universe graph come alive.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <GraphFilters activeTypes={activeTypes} onToggle={toggleType} />
        {hoveredNode && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              {hoveredNode.name}
            </span>
            {" · "}
            {hoveredNode.role}
            {hoveredNode.biography ? ` · ${hoveredNode.biography.slice(0, 60)}` : ""}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)]"
      >
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
            const base = ROLE_COLOR[node.role] ?? "#9b9bab";
            if (!highlighted) return base;
            return highlighted.neighborIds.has(node.id) ? base : DIMMED_COLOR;
          }}
          nodeVal={(node: FgNode) => 1 + node.degree}
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
