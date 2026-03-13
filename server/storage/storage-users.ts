import type {
  User,
  InsertUser,
  UpsertUser,
  BrowsingHistory,
  InsertBrowsingHistory,
} from "@shared/schema";

export const userMethods = {
  async getUser(this: any, id: string): Promise<User | undefined> {
    return this.users.get(id);
  },

  async getUserByEmail(this: any, email: string): Promise<User | undefined> {
    return (Array.from(this.users.values()) as User[]).find((u) => u.email === email);
  },

  async createUser(this: any, user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      id: user.id || `user_${Date.now()}`,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      email: user.email ?? null,
      passwordHash: user.passwordHash ?? null,
      socialFacebook: user.socialFacebook ?? null,
      socialInstagram: user.socialInstagram ?? null,
      socialTwitter: user.socialTwitter ?? null,
      socialLinkedin: user.socialLinkedin ?? null,
      socialTiktok: user.socialTiktok ?? null,
      socialYoutube: user.socialYoutube ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  },

  async upsertUser(this: any, userData: UpsertUser): Promise<User> {
    const existing = userData.id ? this.users.get(userData.id) : undefined;
    const user: User = {
      id: userData.id || `user_${Date.now()}`,
      email: userData.email ?? null,
      passwordHash: userData.passwordHash ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      socialFacebook: userData.socialFacebook ?? null,
      socialInstagram: userData.socialInstagram ?? null,
      socialTwitter: userData.socialTwitter ?? null,
      socialLinkedin: userData.socialLinkedin ?? null,
      socialTiktok: userData.socialTiktok ?? null,
      socialYoutube: userData.socialYoutube ?? null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  },

  async getUsers(this: any): Promise<User[]> {
    return (Array.from(this.users.values()) as User[]).sort((a, b) =>
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  },

  async getBrowsingHistory(this: any, userId: string): Promise<BrowsingHistory[]> {
    return (Array.from(this.browsingHistory.values()) as BrowsingHistory[]).filter((h) => h.userId === userId);
  },

  async addBrowsingHistory(this: any, entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
    const id = `bh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEntry: BrowsingHistory = {
      id,
      userId: entry.userId,
      productId: entry.productId,
      viewedAt: new Date(),
    };
    this.browsingHistory.set(id, newEntry);
    return newEntry;
  },

  async clearBrowsingHistory(this: any, userId: string): Promise<void> {
    const toDelete: string[] = [];
    this.browsingHistory.forEach((entry: BrowsingHistory, id: string) => {
      if (entry.userId === userId) {
        toDelete.push(id);
      }
    });
    toDelete.forEach((id: string) => this.browsingHistory.delete(id));
  },
};
