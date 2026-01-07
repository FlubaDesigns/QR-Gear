export type NexusDomain = 'email' | 'auth' | 'payments' | 'forms' | 'storage' | 'general';

export type ProblemSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ModuleStatus = 'active' | 'deprecated' | 'experimental' | 'disabled';

export type RecipeStatus = 'proven' | 'experimental' | 'failed' | 'learning';

export type AttemptOutcome = 'success' | 'partial' | 'failure' | 'timeout' | 'error';

export interface ProblemSignature {
  id: string;
  domain: NexusDomain;
  goal: string;
  contextFingerprint: string;
  constraints: ProblemConstraint[];
  telemetryTrail: TelemetryEntry[];
  severity: ProblemSeverity;
  detectedAt: Date;
  source: string;
}

export interface ProblemConstraint {
  type: 'requires' | 'excludes' | 'prefers';
  key: string;
  value: string | boolean | number;
  reason?: string;
}

export interface TelemetryEntry {
  timestamp: Date;
  event: string;
  data: Record<string, unknown>;
  source: string;
}

export interface CapabilityModule {
  id: string;
  name: string;
  domain: NexusDomain;
  version: string;
  description: string;
  preconditions: ModuleCondition[];
  postconditions: ModuleCondition[];
  inputSchema: Record<string, SchemaField>;
  outputSchema: Record<string, SchemaField>;
  cost: ModuleCost;
  trustScore: number;
  status: ModuleStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  provenance: ModuleProvenance;
}

export interface ModuleCondition {
  type: 'state' | 'capability' | 'resource' | 'config';
  key: string;
  operator: 'exists' | 'equals' | 'contains' | 'gt' | 'lt' | 'truthy';
  value?: unknown;
  description: string;
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ModuleCost {
  time: 'instant' | 'fast' | 'medium' | 'slow';
  resources: 'minimal' | 'low' | 'medium' | 'high';
  sideEffects: boolean;
  reversible: boolean;
}

export interface ModuleProvenance {
  origin: 'builtin' | 'learned' | 'imported' | 'generated';
  learnedFrom?: string;
  successCount: number;
  failureCount: number;
  lastUsed?: Date;
}

export interface SolutionRecipe {
  id: string;
  name: string;
  problemMatch: ProblemMatcher;
  steps: RecipeStep[];
  successCriteria: SuccessCriterion[];
  status: RecipeStatus;
  confidence: number;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
  lineage: RecipeLineage;
}

export interface ProblemMatcher {
  domain: NexusDomain;
  goalPattern: string;
  requiredConstraints: string[];
  contextPatterns: string[];
}

export interface RecipeStep {
  order: number;
  moduleId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  optional: boolean;
  fallbackModuleId?: string;
  timeout: number;
}

export interface SuccessCriterion {
  type: 'output' | 'state' | 'validation';
  key: string;
  operator: 'exists' | 'equals' | 'truthy' | 'passes';
  value?: unknown;
  weight: number;
}

export interface RecipeLineage {
  parentRecipeId?: string;
  learnedFromAttempts: string[];
  generatedBy: 'discovery' | 'manual' | 'merge' | 'mutation';
  generation: number;
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[];
  edges: ModuleGraphEdge[];
  version: string;
  lastUpdated: Date;
}

export interface ModuleGraphNode {
  moduleId: string;
  domain: NexusDomain;
  capabilities: string[];
  semanticVector?: number[];
}

export interface ModuleGraphEdge {
  fromModuleId: string;
  toModuleId: string;
  relationship: 'provides_input' | 'enhances' | 'alternative' | 'requires';
  weight: number;
}

export interface ExecutionContext {
  problemId: string;
  recipeId: string;
  stepIndex: number;
  inputs: Record<string, unknown>;
  state: Record<string, unknown>;
  telemetry: TelemetryEntry[];
  startedAt: Date;
  timeout: number;
}

export interface ExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  stateChanges: Record<string, unknown>;
  telemetry: TelemetryEntry[];
  duration: number;
  error?: string;
}

export interface LearningAttempt {
  id: string;
  problemSignature: ProblemSignature;
  recipeId?: string;
  modulesTriedIds: string[];
  outcome: AttemptOutcome;
  score: AttemptScore;
  telemetry: TelemetryEntry[];
  startedAt: Date;
  completedAt: Date;
  notes?: string;
}

export interface AttemptScore {
  effectiveness: number;
  efficiency: number;
  safety: number;
  confidence: number;
  overall: number;
}

export interface DiscoveryConfig {
  maxDepth: number;
  maxAttempts: number;
  minConfidenceThreshold: number;
  timeout: number;
  allowExperimental: boolean;
  preferredModules: string[];
  excludedModules: string[];
}
