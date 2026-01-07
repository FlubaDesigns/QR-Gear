"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DISCOVERY_CONFIG = void 0;
exports.generateId = generateId;
exports.createContextFingerprint = createContextFingerprint;
exports.matchProblemToRecipe = matchProblemToRecipe;
exports.calculateAttemptScore = calculateAttemptScore;
exports.createTelemetryEntry = createTelemetryEntry;
exports.moduleCanSatisfy = moduleCanSatisfy;
exports.validateModulePreconditions = validateModulePreconditions;
exports.sortModulesByCost = sortModulesByCost;
exports.groupModulesByDomain = groupModulesByDomain;
const crypto_1 = require("crypto");
function generateId(prefix = 'nx') {
    const timestamp = Date.now().toString(36);
    const random = (0, crypto_1.randomBytes)(4).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
}
function createContextFingerprint(context) {
    const keys = Object.keys(context).sort();
    const values = keys.map(k => `${k}:${typeof context[k]}`);
    return values.join('|');
}
function matchProblemToRecipe(problem, recipe) {
    const matcher = recipe.problemMatch;
    if (matcher.domain !== problem.domain) {
        return { matches: false, score: 0 };
    }
    const goalRegex = new RegExp(matcher.goalPattern, 'i');
    if (!goalRegex.test(problem.goal)) {
        return { matches: false, score: 0 };
    }
    const problemConstraintKeys = problem.constraints.map(c => c.key);
    const hasRequiredConstraints = matcher.requiredConstraints.every(rc => problemConstraintKeys.includes(rc));
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
function calculateAttemptScore(result, recipe, expectedDuration = 5000) {
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
function createTelemetryEntry(event, data, source) {
    return {
        timestamp: new Date(),
        event,
        data,
        source,
    };
}
function moduleCanSatisfy(module, requiredCapability) {
    return module.tags.some(tag => tag.toLowerCase().includes(requiredCapability.toLowerCase()));
}
function validateModulePreconditions(module, state) {
    const unmet = [];
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
function sortModulesByCost(modules) {
    const costOrder = { instant: 0, fast: 1, medium: 2, slow: 3 };
    return [...modules].sort((a, b) => {
        const timeDiff = costOrder[a.cost.time] - costOrder[b.cost.time];
        if (timeDiff !== 0)
            return timeDiff;
        return b.trustScore - a.trustScore;
    });
}
function groupModulesByDomain(modules) {
    const grouped = {
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
exports.DEFAULT_DISCOVERY_CONFIG = {
    maxDepth: 5,
    maxAttempts: 20,
    minConfidenceThreshold: 0.6,
    timeout: 30000,
    allowExperimental: false,
    preferredModules: [],
    excludedModules: [],
};
//# sourceMappingURL=utils.js.map