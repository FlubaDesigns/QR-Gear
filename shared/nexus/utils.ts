import type {
  ProblemSignature,
  CapabilityModule,
  SolutionRecipe,
  TelemetryEntry,
  AttemptScore,
  NexusDomain,
} from './types';
import { randomBytes } from 'crypto';

export function generateId(prefix: string = 'nx'): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

export function createContextFingerprint(context: Record<string, unknown>): string {
  const keys = Object.keys(context).sort();
  const values = keys.map(k => `${k}:${typeof context[k]}`);
  return values.join('|');
}

export function matchProblemToRecipe(
  problem: ProblemSignature,
  recipe: SolutionRecipe
): { matches: boolean; score: number } {
  const matcher = recipe.problemMatch;
  
  if (matcher.domain !== problem.domain) {
    return { matches: false, score: 0 };
  }
  
  const goalRegex = new RegExp(matcher.goalPattern, 'i');
  if (!goalRegex.test(problem.goal)) {
    return { matches: false, score: 0 };
  }
  
  const problemConstraintKeys = problem.constraints.map(c => c.key);
  const hasRequiredConstraints = matcher.requiredConstraints.every(
    rc => problemConstraintKeys.includes(rc)
  );
  if (!hasRequiredConstraints) {
    return { matches: false, score: 0 };
  }
  
  let contextScore = 0;
  for (const pattern of matcher.contextPatterns) {
    if (problem.contextFingerprint.includes(pattern)) {
      contextScore += 1;
    }
  }
  
  const score = contextScore / Math.max(matcher.contextPatterns.length, 1);
  return { matches: true, score: Math.max(0.5, score) };
}

export function calculateAttemptScore(
  result: { success: boolean; duration: number; error?: string },
  recipe: SolutionRecipe,
  expectedDuration: number = 5000
): AttemptScore {
  const effectiveness = result.success ? 1.0 : result.error ? 0.0 : 0.3;
  
  const durationRatio = result.duration / expectedDuration;
  const efficiency = Math.max(0, 1 - Math.min(durationRatio - 1, 1));
  
  const safety = result.error?.includes('critical') ? 0.0 : 
                 result.error ? 0.5 : 1.0;
  
  const confidence = recipe.status === 'proven' ? 0.9 :
                     recipe.status === 'experimental' ? 0.5 :
                     recipe.status === 'learning' ? 0.3 : 0.1;
  
  const overall = (effectiveness * 0.4) + (efficiency * 0.2) + (safety * 0.3) + (confidence * 0.1);
  
  return {
    effectiveness,
    efficiency,
    safety,
    confidence,
    overall,
  };
}

export function createTelemetryEntry(
  event: string,
  data: Record<string, unknown>,
  source: string
): TelemetryEntry {
  return {
    timestamp: new Date(),
    event,
    data,
    source,
  };
}

export function moduleCanSatisfy(
  module: CapabilityModule,
  requiredCapability: string
): boolean {
  return module.tags.some(tag => 
    tag.toLowerCase().includes(requiredCapability.toLowerCase())
  );
}

export function validateModulePreconditions(
  module: CapabilityModule,
  state: Record<string, unknown>
): { valid: boolean; unmet: string[] } {
  const unmet: string[] = [];
  
  for (const condition of module.preconditions) {
    const value = state[condition.key];
    
    switch (condition.operator) {
      case 'exists':
        if (value === undefined || value === null) {
          unmet.push(condition.description);
        }
        break;
      case 'equals':
        if (value !== condition.value) {
          unmet.push(condition.description);
        }
        break;
      case 'truthy':
        if (!value) {
          unmet.push(condition.description);
        }
        break;
      case 'contains':
        if (!String(value).includes(String(condition.value))) {
          unmet.push(condition.description);
        }
        break;
      case 'gt':
        if (typeof value !== 'number' || value <= Number(condition.value)) {
          unmet.push(condition.description);
        }
        break;
      case 'lt':
        if (typeof value !== 'number' || value >= Number(condition.value)) {
          unmet.push(condition.description);
        }
        break;
    }
  }
  
  return { valid: unmet.length === 0, unmet };
}

export function sortModulesByCost(modules: CapabilityModule[]): CapabilityModule[] {
  const costOrder = { instant: 0, fast: 1, medium: 2, slow: 3 };
  return [...modules].sort((a, b) => {
    const timeDiff = costOrder[a.cost.time] - costOrder[b.cost.time];
    if (timeDiff !== 0) return timeDiff;
    return b.trustScore - a.trustScore;
  });
}

export function groupModulesByDomain(
  modules: CapabilityModule[]
): Record<NexusDomain, CapabilityModule[]> {
  const grouped: Record<NexusDomain, CapabilityModule[]> = {
    email: [],
    auth: [],
    payments: [],
    forms: [],
    storage: [],
    general: [],
  };
  
  for (const module of modules) {
    grouped[module.domain].push(module);
  }
  
  return grouped;
}

export const DEFAULT_DISCOVERY_CONFIG = {
  maxDepth: 5,
  maxAttempts: 20,
  minConfidenceThreshold: 0.6,
  timeout: 30000,
  allowExperimental: false,
  preferredModules: [],
  excludedModules: [],
};
