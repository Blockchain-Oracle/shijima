import type { LogoName } from '@/components/logo';

export type Point = [number, number];
export type Side = 'left' | 'right' | 'top' | 'bottom';

export type DiagramNode = {
  id: string;
  title: string;
  /** Lines under the title. */
  sub?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  logo?: LogoName;
  tone?: 'accent' | 'quiet';
};

/** action: something is done or written · read: looked at, never changed · money: funds move · never: refused. */
export type EdgeKind = 'action' | 'read' | 'money' | 'never';

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  kind?: EdgeKind;
  /** Explicit route. Without it the edge runs from one side's middle to the other, with one bend. */
  points?: Point[];
  labelAt?: Point;
};

export type DiagramGroup = { label: string; x: number; y: number; w: number; h: number };

export type Diagram = {
  kicker: string;
  title: string;
  subtitle: string;
  note: string;
  width: number;
  height: number;
  groups?: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type SequenceActor = { id: string; label: string; sub?: string; logo?: LogoName };
export type SequenceStep = {
  from: string;
  to: string;
  label: string;
  /** reply: a dashed return arrow. */
  kind?: 'call' | 'reply';
};
export type SequenceFrame = { label: string; first: number; last: number };

export type Sequence = {
  kicker: string;
  title: string;
  subtitle: string;
  note: string;
  actors: SequenceActor[];
  steps: SequenceStep[];
  frames?: SequenceFrame[];
};
