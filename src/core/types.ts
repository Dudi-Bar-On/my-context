export type Tier = 'normative' | 'rationale';
export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';
export type Severity = 'hard' | 'soft';
export type Origin = 'human' | 'agent' | 'ingest';
export type Layer = 'project' | 'global';

/**
 * What an agent's edit to an item's *content* (title, body, observations,
 * tags) does: apply immediately, or become a revision a human must promote.
 * Per-category config, resolved on `ResolvedCategory` (config.ts).
 */
export type AgentEdits = 'allow' | 'review';

/**
 * What an item with *no scope* means: injects everywhere, is refused at
 * capture until a scope is given, or is never JIT-injected at all.
 * Per-category config, resolved on `ResolvedCategory` (config.ts).
 */
export type ScopePolicy = 'global' | 'required' | 'inert';

export interface Observation {
  category: string;
  text: string;
  tags: string[];
  context: string | null;
}

export interface Relation {
  type: string;
  target: string;
}

export interface Item {
  id: string;
  type: string;
  title: string;
  status: Status;
  severity: Severity;
  always: boolean;
  scope: string[];
  tags: string[];
  origin: Origin;
  sourceFile: string | null;
  sourceAnchor: string | null;
  sourceChecksum: string | null;
  validFrom: string | null;
  validUntil: string | null;
  checksum: string;
  /** Category-specific fields, e.g. kind, directive, likelihood, impact. */
  extra: Record<string, string>;
  /** Prose between the title heading and the first `##` section. */
  body: string;
  observations: Observation[];
  relations: Relation[];
  layer: Layer;
  /** POSIX, relative to the layer root. */
  filePath: string;
}
