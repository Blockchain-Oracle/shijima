'use client';

import { ArrowRight } from 'lucide-react';
import { sequences, type SequenceName } from '@/lib/sequences';
import type { Sequence as SequenceData } from '@/lib/diagram-types';
import { DiagramFrame, ink, Swatch, SvgLogo } from './diagram-parts';

const COL = 122;
const HEAD = 64;
const TOP = 24;
const FIRST_ROW = TOP + HEAD + 44;
const ROW = 40;

function Picture({ data, prefix }: { data: SequenceData; prefix: string }) {
  const column = new Map(data.actors.map((actor, i) => [actor.id, i * COL + COL / 2]));
  const width = data.actors.length * COL;
  const rowY = (i: number) => FIRST_ROW + i * ROW;
  const height = rowY(data.steps.length - 1) + 40;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={data.title} className="diagram-svg">
      <defs>
        <marker id={`${prefix}-call`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 10 5 0 10Z" style={{ fill: ink.accent }} />
        </marker>
        <marker id={`${prefix}-reply`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 10 5 0 10Z" style={{ fill: ink.muted }} />
        </marker>
      </defs>
      {data.frames?.map((frame) => {
        const y = rowY(frame.first) - 30;
        const h = rowY(frame.last) - y + 16;
        return (
          <g key={frame.label}>
            <rect x={6} y={y} width={width - 12} height={h} rx={12} style={{ fill: ink.wash, fillOpacity: 0.5, stroke: ink.line, strokeDasharray: '5 5' }} />
            <text x={20} y={y + 18} className="diagram-group">{frame.label.toUpperCase()}</text>
          </g>
        );
      })}
      {data.actors.map((actor, i) => {
        const cx = i * COL + COL / 2;
        const boxW = COL - 18;
        return (
          <g key={actor.id}>
            <line x1={cx} x2={cx} y1={TOP + HEAD} y2={height - 12} style={{ stroke: ink.line, strokeDasharray: '3 5' }} />
            <rect x={cx - boxW / 2} y={TOP} width={boxW} height={HEAD} rx={11} style={{ fill: ink.surface, stroke: ink.line }} />
            {actor.logo && <SvgLogo name={actor.logo} x={cx - 9} y={TOP + 8} size={18} />}
            <text x={cx} y={TOP + (actor.logo ? 42 : 30)} textAnchor="middle" className="diagram-title diagram-title-small">{actor.label}</text>
            {actor.sub && <text x={cx} y={TOP + (actor.logo ? 56 : 46)} textAnchor="middle" className="diagram-sub">{actor.sub}</text>}
          </g>
        );
      })}
      {data.steps.map((step, i) => {
        const y = rowY(i);
        const x1 = column.get(step.from) ?? 0;
        const x2 = column.get(step.to) ?? 0;
        const reply = step.kind === 'reply';
        const number = String(i + 1);
        if (x1 === x2) {
          const labelWidth = step.label.length * 6.5 + 30;
          return (
            <g key={i}>
              <path d={`M${x1},${y - 10} h30 v16 h-26`} style={{ fill: 'none', stroke: ink.accent, strokeWidth: 1.6 }} markerEnd={`url(#${prefix}-call)`} />
              <rect x={x1 + 38} y={y - 12} width={labelWidth} height={20} rx={5} style={{ fill: 'var(--diagram-label)' }} />
              <text x={x1 + 44} y={y + 2} className="diagram-edge">
                <tspan className="diagram-step">{number}</tspan> {step.label}
              </text>
            </g>
          );
        }
        const mid = (x1 + x2) / 2;
        const labelWidth = step.label.length * 6.5 + 30;
        return (
          <g key={i}>
            <line
              x1={x1}
              x2={x2 + (x2 > x1 ? -2 : 2)}
              y1={y + 8}
              y2={y + 8}
              style={{ stroke: reply ? ink.muted : ink.accent, strokeWidth: 1.6, strokeDasharray: reply ? '5 4' : undefined }}
              markerEnd={`url(#${prefix}-${reply ? 'reply' : 'call'})`}
            />
            <rect x={mid - labelWidth / 2} y={y - 12} width={labelWidth} height={18} rx={5} style={{ fill: 'var(--diagram-label)' }} />
            <text x={mid} y={y + 1} textAnchor="middle" className={`diagram-edge ${reply ? 'diagram-edge-read' : ''}`}>
              <tspan className="diagram-step">{number}</tspan> {step.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A sequence diagram: who talks to whom, in order, numbered to match the text beside it. */
export function Sequence({ name }: { name: SequenceName }) {
  const data: SequenceData = sequences[name];
  const labels = new Map(data.actors.map((actor) => [actor.id, actor.label]));
  return (
    <DiagramFrame
      kicker={data.kicker}
      title={data.title}
      subtitle={data.subtitle}
      note={data.note}
      minWidth={data.actors.length * 118}
      legend={
        <>
          <span className="legend-item"><Swatch kind="action" /> A call or a write</span>
          <span className="legend-item"><Swatch kind="reply" /> An answer</span>
        </>
      }
      text={
        <ol>
          {data.steps.map((step, i) => (
            <li key={i}>
              <strong>{labels.get(step.from)}</strong>
              {step.from !== step.to && (
                <>
                  {' '}
                  <ArrowRight size={13} aria-label="to" /> <strong>{labels.get(step.to)}</strong>
                </>
              )}
              : {step.label}
            </li>
          ))}
        </ol>
      }
    >
      {(prefix) => <Picture data={data} prefix={prefix} />}
    </DiagramFrame>
  );
}
