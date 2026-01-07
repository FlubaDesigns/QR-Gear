"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreModuleGraphRepository = exports.FirestoreLearningRepository = exports.FirestoreRecipeRepository = exports.FirestoreModuleRegistry = void 0;
const admin = __importStar(require("firebase-admin"));
const COLLECTIONS = {
    MODULES: 'nexus_modules',
    RECIPES: 'nexus_recipes',
    ATTEMPTS: 'nexus_attempts',
    GRAPH_NODES: 'nexus_graph_nodes',
    GRAPH_EDGES: 'nexus_graph_edges',
};
class FirestoreModuleRegistry {
    constructor(db) {
        this.executors = new Map();
        this.db = db;
    }
    async register(module, executor) {
        await this.db.collection(COLLECTIONS.MODULES).doc(module.id).set({
            ...module,
            createdAt: module.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        this.executors.set(module.id, executor);
    }
    async unregister(moduleId) {
        await this.db.collection(COLLECTIONS.MODULES).doc(moduleId).delete();
        this.executors.delete(moduleId);
    }
    async getModule(moduleId) {
        const doc = await this.db.collection(COLLECTIONS.MODULES).doc(moduleId).get();
        if (!doc.exists)
            return null;
        return this.docToModule(doc);
    }
    getExecutor(moduleId) {
        return this.executors.get(moduleId) || null;
    }
    async listModules(domain) {
        let query = this.db.collection(COLLECTIONS.MODULES);
        if (domain) {
            query = query.where('domain', '==', domain);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => this.docToModule(doc));
    }
    async findByCapability(capability) {
        const snapshot = await this.db.collection(COLLECTIONS.MODULES)
            .where('tags', 'array-contains', capability)
            .get();
        return snapshot.docs.map(doc => this.docToModule(doc));
    }
    async findByPrecondition(condition) {
        const allModules = await this.listModules();
        return allModules.filter(m => m.preconditions.some(pc => pc.key === condition || pc.description.includes(condition)));
    }
    docToModule(doc) {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            provenance: {
                ...data.provenance,
                lastUsed: data.provenance?.lastUsed?.toDate(),
            },
        };
    }
}
exports.FirestoreModuleRegistry = FirestoreModuleRegistry;
class FirestoreRecipeRepository {
    constructor(db) {
        this.db = db;
    }
    async save(recipe) {
        await this.db.collection(COLLECTIONS.RECIPES).doc(recipe.id).set({
            ...recipe,
            createdAt: recipe.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    async get(recipeId) {
        const doc = await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).get();
        if (!doc.exists)
            return null;
        return this.docToRecipe(doc);
    }
    async findByProblem(problem) {
        const snapshot = await this.db.collection(COLLECTIONS.RECIPES)
            .where('problemMatch.domain', '==', problem.domain)
            .where('status', 'in', ['proven', 'experimental'])
            .get();
        return snapshot.docs
            .map(doc => this.docToRecipe(doc))
            .filter(recipe => {
            const goalRegex = new RegExp(recipe.problemMatch.goalPattern, 'i');
            return goalRegex.test(problem.goal);
        });
    }
    async listByDomain(domain) {
        const snapshot = await this.db.collection(COLLECTIONS.RECIPES)
            .where('problemMatch.domain', '==', domain)
            .get();
        return snapshot.docs.map(doc => this.docToRecipe(doc));
    }
    async updateStats(recipeId, success) {
        const updates = {
            usageCount: admin.firestore.FieldValue.increment(1),
            lastUsed: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (success) {
            updates.confidence = admin.firestore.FieldValue.increment(0.01);
        }
        else {
            updates.confidence = admin.firestore.FieldValue.increment(-0.05);
        }
        await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).update(updates);
    }
    async deprecate(recipeId) {
        await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).update({
            status: 'failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    docToRecipe(doc) {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastUsed: data.lastUsed?.toDate(),
        };
    }
}
exports.FirestoreRecipeRepository = FirestoreRecipeRepository;
class FirestoreLearningRepository {
    constructor(db) {
        this.db = db;
    }
    async recordAttempt(attempt) {
        await this.db.collection(COLLECTIONS.ATTEMPTS).doc(attempt.id).set({
            ...attempt,
            startedAt: attempt.startedAt || admin.firestore.FieldValue.serverTimestamp(),
            completedAt: attempt.completedAt || admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    async getAttempt(attemptId) {
        const doc = await this.db.collection(COLLECTIONS.ATTEMPTS).doc(attemptId).get();
        if (!doc.exists)
            return null;
        return this.docToAttempt(doc);
    }
    async getAttemptsForProblem(problemId) {
        const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
            .where('problemSignature.id', '==', problemId)
            .orderBy('startedAt', 'desc')
            .limit(50)
            .get();
        return snapshot.docs.map(doc => this.docToAttempt(doc));
    }
    async getRecentAttempts(limit) {
        const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
            .orderBy('startedAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => this.docToAttempt(doc));
    }
    async getSuccessfulPatterns(domain) {
        const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
            .where('problemSignature.domain', '==', domain)
            .where('outcome', '==', 'success')
            .orderBy('startedAt', 'desc')
            .limit(100)
            .get();
        const patternCounts = new Map();
        for (const doc of snapshot.docs) {
            const attempt = this.docToAttempt(doc);
            const key = attempt.modulesTriedIds.join('→');
            patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
        }
        return Array.from(patternCounts.entries())
            .map(([key, count]) => ({
            moduleSequence: key.split('→'),
            count,
        }))
            .sort((a, b) => b.count - a.count);
    }
    docToAttempt(doc) {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            startedAt: data.startedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate() || new Date(),
            problemSignature: {
                ...data.problemSignature,
                detectedAt: data.problemSignature?.detectedAt?.toDate() || new Date(),
            },
        };
    }
}
exports.FirestoreLearningRepository = FirestoreLearningRepository;
class FirestoreModuleGraphRepository {
    constructor(db) {
        this.db = db;
    }
    async getGraph() {
        const [nodesSnapshot, edgesSnapshot] = await Promise.all([
            this.db.collection(COLLECTIONS.GRAPH_NODES).get(),
            this.db.collection(COLLECTIONS.GRAPH_EDGES).get(),
        ]);
        const nodes = nodesSnapshot.docs.map(doc => ({
            ...doc.data(),
            moduleId: doc.id,
        }));
        const edges = edgesSnapshot.docs.map(doc => doc.data());
        return {
            nodes,
            edges,
            version: '1.0',
            lastUpdated: new Date(),
        };
    }
    async updateNode(node) {
        await this.db.collection(COLLECTIONS.GRAPH_NODES).doc(node.moduleId).set(node);
    }
    async addEdge(edge) {
        const edgeId = `${edge.fromModuleId}_${edge.toModuleId}`;
        await this.db.collection(COLLECTIONS.GRAPH_EDGES).doc(edgeId).set(edge);
    }
    async removeEdge(fromId, toId) {
        const edgeId = `${fromId}_${toId}`;
        await this.db.collection(COLLECTIONS.GRAPH_EDGES).doc(edgeId).delete();
    }
    async findPaths(fromModuleId, toModuleId, maxHops) {
        const graph = await this.getGraph();
        const paths = [];
        const dfs = (current, target, path, visited, depth) => {
            if (depth > maxHops)
                return;
            if (current === target) {
                paths.push([...path]);
                return;
            }
            const outgoingEdges = graph.edges.filter(e => e.fromModuleId === current);
            for (const edge of outgoingEdges) {
                if (!visited.has(edge.toModuleId)) {
                    visited.add(edge.toModuleId);
                    path.push(edge.toModuleId);
                    dfs(edge.toModuleId, target, path, visited, depth + 1);
                    path.pop();
                    visited.delete(edge.toModuleId);
                }
            }
        };
        dfs(fromModuleId, toModuleId, [fromModuleId], new Set([fromModuleId]), 0);
        return paths;
    }
    async getRelatedModules(moduleId) {
        const graph = await this.getGraph();
        const relatedIds = new Set();
        for (const edge of graph.edges) {
            if (edge.fromModuleId === moduleId) {
                relatedIds.add(edge.toModuleId);
            }
            if (edge.toModuleId === moduleId) {
                relatedIds.add(edge.fromModuleId);
            }
        }
        const moduleRegistry = new FirestoreModuleRegistry(this.db);
        const modules = [];
        for (const id of relatedIds) {
            const module = await moduleRegistry.getModule(id);
            if (module)
                modules.push(module);
        }
        return modules;
    }
}
exports.FirestoreModuleGraphRepository = FirestoreModuleGraphRepository;
//# sourceMappingURL=FirestoreAdapters.js.map