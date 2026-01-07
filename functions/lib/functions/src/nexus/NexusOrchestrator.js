"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NexusOrchestrator = void 0;
const utils_1 = require("../../../shared/nexus/utils");
class NexusOrchestrator {
    constructor(moduleRegistry, recipeRepository, learningRepository) {
        this.detectors = [];
        this.telemetry = [];
        this.moduleRegistry = moduleRegistry;
        this.recipeRepository = recipeRepository;
        this.learningRepository = learningRepository;
    }
    registerDetector(detector) {
        this.detectors.push(detector);
        this.detectors.sort((a, b) => b.priority - a.priority);
    }
    async detect(context) {
        const problems = [];
        for (const detector of this.detectors) {
            try {
                const detected = await detector.detect(context);
                problems.push(...detected);
                this.emitTelemetry('detector.run', {
                    detector: detector.name,
                    domain: detector.domain,
                    problemsFound: detected.length,
                });
            }
            catch (error) {
                this.emitTelemetry('detector.error', {
                    detector: detector.name,
                    error: error.message,
                });
            }
        }
        return problems.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }
    async match(problem) {
        const candidates = await this.recipeRepository.findByProblem(problem);
        if (candidates.length === 0) {
            this.emitTelemetry('match.none', { problemId: problem.id, domain: problem.domain });
            return null;
        }
        let bestMatch = null;
        for (const recipe of candidates) {
            const { matches, score } = (0, utils_1.matchProblemToRecipe)(problem, recipe);
            if (matches && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { recipe, score };
            }
        }
        if (bestMatch) {
            this.emitTelemetry('match.found', {
                problemId: problem.id,
                recipeId: bestMatch.recipe.id,
                score: bestMatch.score,
            });
        }
        return bestMatch?.recipe || null;
    }
    async discover(problem, config) {
        const fullConfig = { ...utils_1.DEFAULT_DISCOVERY_CONFIG, ...config };
        const availableModules = await this.moduleRegistry.listModules(problem.domain);
        const sortedModules = (0, utils_1.sortModulesByCost)(availableModules);
        if (sortedModules.length === 0) {
            this.emitTelemetry('discover.no_modules', { domain: problem.domain });
            return null;
        }
        this.emitTelemetry('discover.start', {
            problemId: problem.id,
            availableModules: sortedModules.length,
            config: fullConfig,
        });
        let attempts = 0;
        let bestRecipe = null;
        let bestScore = 0;
        const candidateSequences = this.generateModuleSequences(sortedModules, fullConfig.maxDepth, fullConfig.preferredModules, fullConfig.excludedModules);
        for (const sequence of candidateSequences) {
            if (attempts >= fullConfig.maxAttempts)
                break;
            const recipe = this.createRecipeFromSequence(problem, sequence);
            try {
                const result = await this.executeWithTimeout(recipe, {}, fullConfig.timeout);
                const score = (0, utils_1.calculateAttemptScore)(result, recipe);
                this.emitTelemetry('discover.attempt', {
                    attemptNumber: attempts + 1,
                    moduleSequence: sequence.map(m => m.id),
                    success: result.success,
                    score: score.overall,
                });
                if (result.success && score.overall > bestScore) {
                    bestScore = score.overall;
                    bestRecipe = recipe;
                    recipe.confidence = score.overall;
                    recipe.status = score.overall >= fullConfig.minConfidenceThreshold ? 'experimental' : 'learning';
                }
                if (score.overall >= fullConfig.minConfidenceThreshold) {
                    break;
                }
                attempts++;
            }
            catch (error) {
                this.emitTelemetry('discover.attempt.error', {
                    attemptNumber: attempts + 1,
                    moduleSequence: sequence.map(m => m.id),
                    error: error.message,
                });
                attempts++;
            }
        }
        if (bestRecipe) {
            await this.recipeRepository.save(bestRecipe);
            this.emitTelemetry('discover.success', {
                problemId: problem.id,
                recipeId: bestRecipe.id,
                confidence: bestScore,
                attempts,
            });
        }
        else {
            this.emitTelemetry('discover.failed', {
                problemId: problem.id,
                attempts,
            });
        }
        return bestRecipe;
    }
    async execute(recipe, inputs) {
        const startTime = Date.now();
        const state = { ...inputs };
        const allTelemetry = [];
        this.emitTelemetry('execute.start', {
            recipeId: recipe.id,
            stepCount: recipe.steps.length,
        });
        for (const step of recipe.steps.sort((a, b) => a.order - b.order)) {
            const module = await this.moduleRegistry.getModule(step.moduleId);
            if (!module) {
                if (step.optional)
                    continue;
                return {
                    success: false,
                    outputs: {},
                    stateChanges: {},
                    telemetry: allTelemetry,
                    duration: Date.now() - startTime,
                    error: `Module not found: ${step.moduleId}`,
                };
            }
            const preconditionCheck = (0, utils_1.validateModulePreconditions)(module, state);
            if (!preconditionCheck.valid) {
                if (step.optional)
                    continue;
                if (step.fallbackModuleId) {
                    const fallbackResult = await this.executeStep(step.fallbackModuleId, state, step.timeout);
                    if (!fallbackResult.success) {
                        return {
                            ...fallbackResult,
                            duration: Date.now() - startTime,
                        };
                    }
                    Object.assign(state, fallbackResult.stateChanges);
                    allTelemetry.push(...fallbackResult.telemetry);
                    continue;
                }
                return {
                    success: false,
                    outputs: {},
                    stateChanges: {},
                    telemetry: allTelemetry,
                    duration: Date.now() - startTime,
                    error: `Preconditions not met: ${preconditionCheck.unmet.join(', ')}`,
                };
            }
            const stepResult = await this.executeStep(step.moduleId, state, step.timeout);
            allTelemetry.push(...stepResult.telemetry);
            if (!stepResult.success && !step.optional) {
                return {
                    ...stepResult,
                    duration: Date.now() - startTime,
                };
            }
            Object.assign(state, stepResult.stateChanges);
            for (const [outputKey, stateKey] of Object.entries(step.outputMapping)) {
                if (stepResult.outputs[outputKey] !== undefined) {
                    state[stateKey] = stepResult.outputs[outputKey];
                }
            }
        }
        this.emitTelemetry('execute.complete', {
            recipeId: recipe.id,
            duration: Date.now() - startTime,
            success: true,
        });
        return {
            success: true,
            outputs: state,
            stateChanges: state,
            telemetry: allTelemetry,
            duration: Date.now() - startTime,
        };
    }
    async learn(problem, recipe, result) {
        const score = (0, utils_1.calculateAttemptScore)(result, recipe);
        const attempt = {
            id: (0, utils_1.generateId)('attempt'),
            problemSignature: problem,
            recipeId: recipe.id,
            modulesTriedIds: recipe.steps.map(s => s.moduleId),
            outcome: result.success ? 'success' : result.error ? 'error' : 'failure',
            score,
            telemetry: result.telemetry,
            startedAt: new Date(Date.now() - result.duration),
            completedAt: new Date(),
        };
        await this.learningRepository.recordAttempt(attempt);
        await this.recipeRepository.updateStats(recipe.id, result.success);
        if (result.success && score.overall >= 0.8 && recipe.status === 'experimental') {
            const updatedRecipe = { ...recipe, status: 'proven' };
            await this.recipeRepository.save(updatedRecipe);
            this.emitTelemetry('learn.promoted', { recipeId: recipe.id });
        }
        if (!result.success && score.overall < 0.3 && recipe.usageCount > 5) {
            await this.recipeRepository.deprecate(recipe.id);
            this.emitTelemetry('learn.deprecated', { recipeId: recipe.id });
        }
        this.emitTelemetry('learn.recorded', {
            attemptId: attempt.id,
            recipeId: recipe.id,
            outcome: attempt.outcome,
            score: score.overall,
        });
    }
    async solve(context, config) {
        const problems = await this.detect(context);
        if (problems.length === 0) {
            this.emitTelemetry('solve.no_problems', { context: Object.keys(context) });
            return null;
        }
        const problem = problems[0];
        let recipe = await this.match(problem);
        if (!recipe) {
            recipe = await this.discover(problem, config);
        }
        if (!recipe) {
            this.emitTelemetry('solve.no_solution', { problemId: problem.id });
            return null;
        }
        const result = await this.execute(recipe, context);
        await this.learn(problem, recipe, result);
        return { problem, recipe, result };
    }
    async executeStep(moduleId, state, timeout) {
        const executor = this.moduleRegistry.getExecutor(moduleId);
        if (!executor) {
            return {
                success: false,
                outputs: {},
                stateChanges: {},
                telemetry: [],
                duration: 0,
                error: `No executor registered for module: ${moduleId}`,
            };
        }
        const context = {
            problemId: '',
            recipeId: '',
            stepIndex: 0,
            inputs: state,
            state,
            telemetry: [],
            startedAt: new Date(),
            timeout,
        };
        try {
            const result = await Promise.race([
                executor.execute(context),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), timeout)),
            ]);
            return result;
        }
        catch (error) {
            return {
                success: false,
                outputs: {},
                stateChanges: {},
                telemetry: [],
                duration: timeout,
                error: error.message,
            };
        }
    }
    async executeWithTimeout(recipe, inputs, timeout) {
        return Promise.race([
            this.execute(recipe, inputs),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Recipe execution timeout')), timeout)),
        ]);
    }
    generateModuleSequences(modules, maxDepth, preferred, excluded) {
        const filtered = modules.filter(m => !excluded.includes(m.id));
        const preferredFirst = [
            ...filtered.filter(m => preferred.includes(m.id)),
            ...filtered.filter(m => !preferred.includes(m.id)),
        ];
        const sequences = [];
        for (let depth = 1; depth <= Math.min(maxDepth, preferredFirst.length); depth++) {
            const combos = this.combinations(preferredFirst, depth);
            sequences.push(...combos);
        }
        return sequences.slice(0, 50);
    }
    combinations(arr, size) {
        if (size === 0)
            return [[]];
        if (arr.length === 0)
            return [];
        const [first, ...rest] = arr;
        const withFirst = this.combinations(rest, size - 1).map(c => [first, ...c]);
        const withoutFirst = this.combinations(rest, size);
        return [...withFirst, ...withoutFirst];
    }
    createRecipeFromSequence(problem, modules) {
        return {
            id: (0, utils_1.generateId)('recipe'),
            name: `Auto: ${problem.goal.slice(0, 50)}`,
            problemMatch: {
                domain: problem.domain,
                goalPattern: problem.goal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                requiredConstraints: problem.constraints.map(c => c.key),
                contextPatterns: [],
            },
            steps: modules.map((module, index) => ({
                order: index,
                moduleId: module.id,
                inputMapping: {},
                outputMapping: {},
                optional: false,
                timeout: 5000,
            })),
            successCriteria: [
                { type: 'output', key: 'success', operator: 'truthy', weight: 1 },
            ],
            status: 'learning',
            confidence: 0,
            usageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lineage: {
                learnedFromAttempts: [],
                generatedBy: 'discovery',
                generation: 1,
            },
        };
    }
    emitTelemetry(event, data) {
        const entry = (0, utils_1.createTelemetryEntry)(event, data, 'NexusOrchestrator');
        this.telemetry.push(entry);
        if (this.telemetry.length > 500) {
            this.telemetry = this.telemetry.slice(-250);
        }
        console.log(`[Nexus] ${event}`, data);
    }
    getTelemetry() {
        return [...this.telemetry];
    }
}
exports.NexusOrchestrator = NexusOrchestrator;
//# sourceMappingURL=NexusOrchestrator.js.map