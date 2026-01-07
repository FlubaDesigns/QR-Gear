import type {
  ProblemSignature,
  CapabilityModule,
  SolutionRecipe,
  ExecutionContext,
  ExecutionResult,
  LearningAttempt,
  DiscoveryConfig,
  ModuleGraph,
  TelemetryEntry,
  NexusDomain,
} from './types';

export interface IModuleExecutor {
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  validate(inputs: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }>;
  selfTest(): Promise<{ passed: boolean; details: string }>;
}

export interface IModuleRegistry {
  register(module: CapabilityModule, executor: IModuleExecutor): Promise<void>;
  unregister(moduleId: string): Promise<void>;
  getModule(moduleId: string): Promise<CapabilityModule | null>;
  getExecutor(moduleId: string): IModuleExecutor | null;
  listModules(domain?: NexusDomain): Promise<CapabilityModule[]>;
  findByCapability(capability: string): Promise<CapabilityModule[]>;
  findByPrecondition(condition: string): Promise<CapabilityModule[]>;
}

export interface IRecipeRepository {
  save(recipe: SolutionRecipe): Promise<void>;
  get(recipeId: string): Promise<SolutionRecipe | null>;
  findByProblem(problem: ProblemSignature): Promise<SolutionRecipe[]>;
  listByDomain(domain: NexusDomain): Promise<SolutionRecipe[]>;
  updateStats(recipeId: string, success: boolean): Promise<void>;
  deprecate(recipeId: string): Promise<void>;
}

export interface ILearningRepository {
  recordAttempt(attempt: LearningAttempt): Promise<void>;
  getAttempt(attemptId: string): Promise<LearningAttempt | null>;
  getAttemptsForProblem(problemId: string): Promise<LearningAttempt[]>;
  getRecentAttempts(limit: number): Promise<LearningAttempt[]>;
  getSuccessfulPatterns(domain: NexusDomain): Promise<{ moduleSequence: string[]; count: number }[]>;
}

export interface IModuleGraphRepository {
  getGraph(): Promise<ModuleGraph>;
  updateNode(node: ModuleGraph['nodes'][0]): Promise<void>;
  addEdge(edge: ModuleGraph['edges'][0]): Promise<void>;
  removeEdge(fromId: string, toId: string): Promise<void>;
  findPaths(fromModuleId: string, toModuleId: string, maxHops: number): Promise<string[][]>;
  getRelatedModules(moduleId: string): Promise<CapabilityModule[]>;
}

export interface IProblemDetector {
  domain: NexusDomain;
  name: string;
  detect(context: Record<string, unknown>): Promise<ProblemSignature[]>;
  priority: number;
}

export interface IRecipeScorer {
  score(
    problem: ProblemSignature,
    recipe: SolutionRecipe,
    result: ExecutionResult
  ): Promise<{ score: number; breakdown: Record<string, number> }>;
}

export interface INexusOrchestrator {
  detect(context: Record<string, unknown>): Promise<ProblemSignature[]>;
  
  match(problem: ProblemSignature): Promise<SolutionRecipe | null>;
  
  discover(problem: ProblemSignature, config?: Partial<DiscoveryConfig>): Promise<SolutionRecipe | null>;
  
  execute(recipe: SolutionRecipe, inputs: Record<string, unknown>): Promise<ExecutionResult>;
  
  learn(problem: ProblemSignature, recipe: SolutionRecipe, result: ExecutionResult): Promise<void>;
  
  solve(
    context: Record<string, unknown>,
    config?: Partial<DiscoveryConfig>
  ): Promise<{ problem: ProblemSignature; recipe: SolutionRecipe; result: ExecutionResult } | null>;
}

export interface ITelemetryCollector {
  emit(entry: Omit<TelemetryEntry, 'timestamp'>): void;
  getRecent(count: number): TelemetryEntry[];
  flush(): Promise<void>;
  subscribe(handler: (entry: TelemetryEntry) => void): () => void;
}

export interface IDiscoveryEngine {
  discover(
    problem: ProblemSignature,
    availableModules: CapabilityModule[],
    config: DiscoveryConfig
  ): AsyncGenerator<{
    candidate: SolutionRecipe;
    score: number;
    iteration: number;
  }>;
  
  stop(): void;
}

export interface ISandboxExecutor {
  run(
    recipe: SolutionRecipe,
    inputs: Record<string, unknown>,
    timeout: number
  ): Promise<{
    result: ExecutionResult;
    isolated: boolean;
    rollbackable: boolean;
  }>;
  
  rollback(executionId: string): Promise<boolean>;
}
