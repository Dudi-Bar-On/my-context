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

/**
 * One line of a `## Steps` section.
 *
 * The field is on `Item` rather than on one category, because `parseItem` is
 * handed a file and a layer and never a `Config` — it cannot know what type
 * it is reading until it has read it. `procedure` is the category the
 * product documents, seeds and commands around steps (spec §6o); nothing
 * refuses them elsewhere.
 *
 * `checked` exists because Markdown is the source of truth and a person may
 * tick a box in the file by hand; it round-trips so that doing so is not
 * destroyed by the next write. **Nothing in this product ever sets it.**
 * Progress made through `mycontext procedure step` is recorded in the audit
 * log and never in the item — spec §6m.3, which §6o attaches to `procedure`
 * — so the file on disk does not move when somebody makes progress,
 * `checksum` stays stable, and `UPDATE_FIELD_POLICY` (trust.ts) is never
 * asked to classify a third kind of field.
 */
export interface Step {
  text: string;
  checked: boolean;
}

export interface Item {
  id: string;
  type: string;
  title: string;
  status: Status;
  severity: Severity;
  always: boolean;
  /**
   * Membership of the CONTINUITY tier — what the next session needs in order
   * not to start over, as opposed to what governs the work.
   *
   * It mirrors `always` exactly and deliberately
   * (`DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be`): a
   * boolean on the item that routes it to one tier, defaulting false,
   * validated at capture, and visible on every surface that shows `always`.
   * It is NOT a hardcoded id in `select` — a rule invisible from every screen
   * — nor a category (categories already carry a governance tier, and
   * overloading one axis with two is how both stop meaning anything) nor a tag
   * (tags are projected and unvalidated).
   *
   * **Written to the frontmatter only when true**, unlike `always`, and
   * absent from `computeItemChecksum` unless true, for the reason `steps`
   * is conditional there: every item in every corpus predates this field, and
   * an unconditional key would move every recorded checksum at once.
   */
  continuity: boolean;
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
  /**
   * The `## Steps` section, in file order. Create-only: absent from
   * `UpdateInput` exactly as `observations` is, so a step is corrected by
   * editing the Markdown and running `mycontext repair`.
   */
  steps: Step[];
  observations: Observation[];
  relations: Relation[];
  layer: Layer;
  /** POSIX, relative to the layer root. */
  filePath: string;
}
