import * as admin from 'firebase-admin';
import type {
  CapabilityModule,
  SolutionRecipe,
  LearningAttempt,
  ModuleGraph,
  ModuleGraphNode,
  ModuleGraphEdge,
  ProblemSignature,
  NexusDomain,
} from '../../../shared/nexus/types';
import type {
  IModuleRegistry,
  IRecipeRepository,
  ILearningRepository,
  IModuleGraphRepository,
  IModuleExecutor,
} from '../../../shared/nexus/contracts';

const COLLECTIONS = {
  MODULES: 'nexus_modules',
  RECIPES: 'nexus_recipes',
  ATTEMPTS: 'nexus_attempts',
  GRAPH_NODES: 'nexus_graph_nodes',
  GRAPH_EDGES: 'nexus_graph_edges',
};

export class FirestoreModuleRegistry implements IModuleRegistry {
  private db: admin.firestore.Firestore;
  private executors: Map<string, IModuleExecutor> = new Map();

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async register(module: CapabilityModule, executor: IModuleExecutor): Promise<void> {
    await this.db.collection(COLLECTIONS.MODULES).doc(module.id).set({
      ...module,
      createdAt: module.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    this.executors.set(module.id, executor);
  }

  async unregister(moduleId: string): Promise<void> {
    await this.db.collection(COLLECTIONS.MODULES).doc(moduleId).delete();
    this.executors.delete(moduleId);
  }

  async getModule(moduleId: string): Promise<CapabilityModule | null> {
    const doc = await this.db.collection(COLLECTIONS.MODULES).doc(moduleId).get();
    if (!doc.exists) return null;
    return this.docToModule(doc);
  }

  getExecutor(moduleId: string): IModuleExecutor | null {
    return this.executors.get(moduleId) || null;
  }

  async listModules(domain?: NexusDomain): Promise<CapabilityModule[]> {
    let query: admin.firestore.Query = this.db.collection(COLLECTIONS.MODULES);
    if (domain) {
      query = query.where('domain', '==', domain);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => this.docToModule(doc));
  }

  async findByCapability(capability: string): Promise<CapabilityModule[]> {
    const snapshot = await this.db.collection(COLLECTIONS.MODULES)
      .where('tags', 'array-contains', capability)
      .get();
    return snapshot.docs.map(doc => this.docToModule(doc));
  }

  async findByPrecondition(condition: string): Promise<CapabilityModule[]> {
    const allModules = await this.listModules();
    return allModules.filter(m => 
      m.preconditions.some(pc => pc.key === condition || pc.description.includes(condition))
    );
  }

  private docToModule(doc: admin.firestore.DocumentSnapshot): CapabilityModule {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      provenance: {
        ...data.provenance,
        lastUsed: data.provenance?.lastUsed?.toDate(),
      },
    } as CapabilityModule;
  }
}

export class FirestoreRecipeRepository implements IRecipeRepository {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async save(recipe: SolutionRecipe): Promise<void> {
    await this.db.collection(COLLECTIONS.RECIPES).doc(recipe.id).set({
      ...recipe,
      createdAt: recipe.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async get(recipeId: string): Promise<SolutionRecipe | null> {
    const doc = await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).get();
    if (!doc.exists) return null;
    return this.docToRecipe(doc);
  }

  async findByProblem(problem: ProblemSignature): Promise<SolutionRecipe[]> {
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

  async listByDomain(domain: NexusDomain): Promise<SolutionRecipe[]> {
    const snapshot = await this.db.collection(COLLECTIONS.RECIPES)
      .where('problemMatch.domain', '==', domain)
      .get();
    return snapshot.docs.map(doc => this.docToRecipe(doc));
  }

  async updateStats(recipeId: string, success: boolean): Promise<void> {
    const updates: Record<string, any> = {
      usageCount: admin.firestore.FieldValue.increment(1),
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (success) {
      updates.confidence = admin.firestore.FieldValue.increment(0.01);
    } else {
      updates.confidence = admin.firestore.FieldValue.increment(-0.05);
    }
    
    await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).update(updates);
  }

  async deprecate(recipeId: string): Promise<void> {
    await this.db.collection(COLLECTIONS.RECIPES).doc(recipeId).update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  private docToRecipe(doc: admin.firestore.DocumentSnapshot): SolutionRecipe {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      lastUsed: data.lastUsed?.toDate(),
    } as SolutionRecipe;
  }
}

export class FirestoreLearningRepository implements ILearningRepository {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async recordAttempt(attempt: LearningAttempt): Promise<void> {
    await this.db.collection(COLLECTIONS.ATTEMPTS).doc(attempt.id).set({
      ...attempt,
      startedAt: attempt.startedAt || admin.firestore.FieldValue.serverTimestamp(),
      completedAt: attempt.completedAt || admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async getAttempt(attemptId: string): Promise<LearningAttempt | null> {
    const doc = await this.db.collection(COLLECTIONS.ATTEMPTS).doc(attemptId).get();
    if (!doc.exists) return null;
    return this.docToAttempt(doc);
  }

  async getAttemptsForProblem(problemId: string): Promise<LearningAttempt[]> {
    const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
      .where('problemSignature.id', '==', problemId)
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(doc => this.docToAttempt(doc));
  }

  async getRecentAttempts(limit: number): Promise<LearningAttempt[]> {
    const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => this.docToAttempt(doc));
  }

  async getSuccessfulPatterns(domain: NexusDomain): Promise<{ moduleSequence: string[]; count: number }[]> {
    const snapshot = await this.db.collection(COLLECTIONS.ATTEMPTS)
      .where('problemSignature.domain', '==', domain)
      .where('outcome', '==', 'success')
      .orderBy('startedAt', 'desc')
      .limit(100)
      .get();
    
    const patternCounts = new Map<string, number>();
    
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

  private docToAttempt(doc: admin.firestore.DocumentSnapshot): LearningAttempt {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      startedAt: data.startedAt?.toDate() || new Date(),
      completedAt: data.completedAt?.toDate() || new Date(),
      problemSignature: {
        ...data.problemSignature,
        detectedAt: data.problemSignature?.detectedAt?.toDate() || new Date(),
      },
    } as LearningAttempt;
  }
}

export class FirestoreModuleGraphRepository implements IModuleGraphRepository {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async getGraph(): Promise<ModuleGraph> {
    const [nodesSnapshot, edgesSnapshot] = await Promise.all([
      this.db.collection(COLLECTIONS.GRAPH_NODES).get(),
      this.db.collection(COLLECTIONS.GRAPH_EDGES).get(),
    ]);

    const nodes: ModuleGraphNode[] = nodesSnapshot.docs.map(doc => ({
      ...doc.data(),
      moduleId: doc.id,
    } as ModuleGraphNode));

    const edges: ModuleGraphEdge[] = edgesSnapshot.docs.map(doc => doc.data() as ModuleGraphEdge);

    return {
      nodes,
      edges,
      version: '1.0',
      lastUpdated: new Date(),
    };
  }

  async updateNode(node: ModuleGraphNode): Promise<void> {
    await this.db.collection(COLLECTIONS.GRAPH_NODES).doc(node.moduleId).set(node);
  }

  async addEdge(edge: ModuleGraphEdge): Promise<void> {
    const edgeId = `${edge.fromModuleId}_${edge.toModuleId}`;
    await this.db.collection(COLLECTIONS.GRAPH_EDGES).doc(edgeId).set(edge);
  }

  async removeEdge(fromId: string, toId: string): Promise<void> {
    const edgeId = `${fromId}_${toId}`;
    await this.db.collection(COLLECTIONS.GRAPH_EDGES).doc(edgeId).delete();
  }

  async findPaths(fromModuleId: string, toModuleId: string, maxHops: number): Promise<string[][]> {
    const graph = await this.getGraph();
    const paths: string[][] = [];
    
    const dfs = (current: string, target: string, path: string[], visited: Set<string>, depth: number) => {
      if (depth > maxHops) return;
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

  async getRelatedModules(moduleId: string): Promise<CapabilityModule[]> {
    const graph = await this.getGraph();
    const relatedIds = new Set<string>();
    
    for (const edge of graph.edges) {
      if (edge.fromModuleId === moduleId) {
        relatedIds.add(edge.toModuleId);
      }
      if (edge.toModuleId === moduleId) {
        relatedIds.add(edge.fromModuleId);
      }
    }
    
    const moduleRegistry = new FirestoreModuleRegistry(this.db);
    const modules: CapabilityModule[] = [];
    
    for (const id of relatedIds) {
      const module = await moduleRegistry.getModule(id);
      if (module) modules.push(module);
    }
    
    return modules;
  }
}
