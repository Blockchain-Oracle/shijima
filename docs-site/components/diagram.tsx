'use client';

import { ArrowRight } from 'lucide-react';
import { diagrams, type DiagramName } from '@/lib/diagrams';
import type { Diagram as DiagramData, DiagramEdge, DiagramNode, EdgeKind, Point } from '@/lib/diagram-types';
import { DiagramFrame, ink, Swatch, SvgLogo } from './diagram-parts';

const kindWords: Record<EdgeKind, string> = {
  action: 'Does or writes',
  read: 'Reads or only asks',
  money: 'Money moves',
  never: 'Can never happen',
};

function route(edge: DiagramEdge, nodes: Map<string, DiagramNode>): Point[] {
  if (edge.points) return edge.points;
  const a = nodes.get(edge.from);
  const b = nodes.get(edge.to);
  if (!a || !b) return [];
  const ac: Point = [a.x + a.w / 2, a.y + a.h / 2];
  const bc: Point = [b.x + b.w / 2, b.y + b.h / 2];
  const dx = bc[0] - ac[0];
  const dy = bc[1] - ac[1];
  if (Math.abs(dx) > Math.abs(dy)) {
    const start: Point = [dx > 0 ? a.x + a.w : a.x, ac[1]];
    const end: Point = [dx > 0 ? b.x : b.x + b.w, bc[1]];
    const mx = (start[0] + end[0]) / 2;
    return start[1] === end[1] ? [start, end] : [start, [mx, start[1]], [mx, end[1]], end];
  }
  const start: Point = [ac[0], dy > 0 ? a.y + a.h : a.y];
  const end: Point = [bc[0], dy > 0 ? b.y : b.y + b.h];
  const my = (start[1] + end[1]) / 2;
  return start[0] === end[0] ? [start, end] : [start, [start[0], my], [end[0], my], end];
}

function labelPoint(points: Point[]): Point {
  let best: [Point, Point] = [points[0], points[1] ?? points[0]];
  let length = -1;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (l > length) {
      length = l;
      best = [points[i - 1], points[i]];
    }
  }
  return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
}

const stroke = (kind: EdgeKind) =>
  kind === 'read' ? ink.muted : kind === 'never' ? ink.danger : ink.accent;

function Picture({ diagram, prefix }: { diagram: DiagramData; prefix: string }) {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const kinds: EdgeKind[] = ['action', 'read', 'money', 'never'];
  return (
    <svg viewBox={`0 0 ${diagram.width} ${diagram.height}`} width="100%" role="img" aria-label={diagram.title} className="diagram-svg">
      <defs>
        {kinds.map((kind) =>
          kind === 'never' ? (
            <marker key={kind} id={`${prefix}-${kind}`} viewBox="0 0 12 12" refX="6" refY="6" markerWidth="11" markerHeight="11" orient="auto">
              <path d="M2 2 10 10 M10 2 2 10" style={{ stroke: stroke(kind), strokeWidth: 2.2, fill: 'none' }} />
            </marker>
          ) : (
            <marker key={kind} id={`${prefix}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" style={{ fill: stroke(kind) }} />
            </marker>
          ),
        )}
      </defs>
      {diagram.groups?.map((group) => (
        <g key={group.label}>
          <rect x={group.x} y={group.y} width={group.w} height={group.h} rx={16} style={{ fill: ink.wash, fillOpacity: 0.55, stroke: ink.line, strokeDasharray: '5 5' }} />
          <text x={group.x + 16} y={group.y + 24} className="diagram-group">{group.label.toUpperCase()}</text>
        </g>
      ))}
      {diagram.edges.map((edge, index) => {
        const kind = edge.kind ?? 'action';
        const points = route(edge, nodes);
        return (
          <path
            key={`p${index}`}
            d={points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')}
            style={{
              fill: 'none',
              stroke: stroke(kind),
              strokeWidth: kind === 'money' ? 2.6 : 1.7,
              strokeDasharray: kind === 'read' ? '5 5' : kind === 'never' ? '3 5' : undefined,
              strokeLinejoin: 'round',
            }}
            markerEnd={`url(#${prefix}-${kind})`}
          />
        );
      })}
      {diagram.nodes.map((node) => {
        const accent = node.tone === 'accent';
        const textX = node.x + (node.logo ? 46 : 16);
        const lines = node.sub ?? [];
        const top = node.y + node.h / 2 - ((lines.length ? 19 + lines.length * 16 : 16) / 2) + 14;
        return (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={12}
              style={{
                fill: accent ? 'color-mix(in srgb, var(--diagram-accent) 9%, var(--diagram-surface))' : ink.surface,
                stroke: accent ? ink.accent : ink.line,
                strokeWidth: accent ? 1.6 : 1,
                strokeDasharray: node.tone === 'quiet' ? '4 4' : undefined,
              }}
            />
            {node.logo && <SvgLogo name={node.logo} x={node.x + 14} y={node.y + node.h / 2 - 12} size={24} />}
            <text x={textX} y={top} className="diagram-title">{node.title}</text>
            {lines.map((line, i) => (
              <text key={line} x={textX} y={top + 19 + i * 16} className="diagram-sub">{line}</text>
            ))}
          </g>
        );
      })}
      {diagram.edges.map((edge, index) => {
        if (!edge.label) return null;
        const [x, y] = edge.labelAt ?? labelPoint(route(edge, nodes));
        const width = edge.label.length * 6.6 + 14;
        return (
          <g key={`l${index}`} transform={`translate(${x},${y})`}>
            <rect x={-width / 2} y={-10} width={width} height={20} rx={5} style={{ fill: 'var(--diagram-label)' }} />
            <text textAnchor="middle" y={4} className={`diagram-edge diagram-edge-${edge.kind ?? 'action'}`}>{edge.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A diagram drawn as one SVG, so text scales with the picture. On a phone it scrolls sideways inside its frame. */
export function Diagram({ name }: { name: DiagramName }) {
  const diagram: DiagramData = diagrams[name];
  const titles = new Map(diagram.nodes.map((node) => [node.id, node.title]));
  const used = [...new Set(diagram.edges.map((edge) => edge.kind ?? 'action'))];
  return (
    <DiagramFrame
      kicker={diagram.kicker}
      title={diagram.title}
      subtitle={diagram.subtitle}
      note={diagram.note}
      minWidth={660}
      legend={used.map((kind) => (
        <span key={kind} className="legend-item">
          <Swatch kind={kind} /> {kindWords[kind]}
        </span>
      ))}
      text={
        <ol>
          {diagram.edges.map((edge, index) => (
            <li key={index}>
              <strong>{titles.get(edge.from)}</strong> <ArrowRight size={13} aria-label="to" /> <strong>{titles.get(edge.to)}</strong>
              {edge.label ? `: ${edge.label}` : ''} <span className="text-kind">({kindWords[edge.kind ?? 'action'].toLowerCase()})</span>
            </li>
          ))}
        </ol>
      }
    >
      {(prefix) => <Picture diagram={diagram} prefix={prefix} />}
    </DiagramFrame>
  );
}
