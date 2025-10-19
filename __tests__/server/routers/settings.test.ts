/**
 * Settings Router Tests (Mocked)
 *
 * Tests for settings tRPC endpoints with mocked Prisma
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
const mockPrismaCategories = new Map<string, any>();
const mockPrismaProfiles = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    arxivCategory: {
      findMany: vi.fn(async ({ where, orderBy }) => {
        let categories = Array.from(mockPrismaCategories.values());

        if (where?.id?.startsWith) {
          const prefix = where.id.startsWith;
          categories = categories.filter((cat) => cat.id.startsWith(prefix));
        }

        if (orderBy?.id === 'asc') {
          categories.sort((a, b) => a.id.localeCompare(b.id));
        }

        return categories;
      }),
    },

    userProfile: {
      findFirst: vi.fn(async () => {
        const profiles = Array.from(mockPrismaProfiles.values());
        return profiles[0] || null;
      }),

      create: vi.fn(async ({ data }) => {
        const profile = {
          id: `profile-${mockPrismaProfiles.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockPrismaProfiles.set(profile.id, profile);
        return profile;
      }),

      update: vi.fn(async ({ where, data }) => {
        const profile = mockPrismaProfiles.get(where.id);
        if (!profile) throw new Error('Profile not found');

        const updated = {
          ...profile,
          ...data,
          updatedAt: new Date(),
        };
        mockPrismaProfiles.set(where.id, updated);
        return updated;
      }),
    },
  },
}));

import { settingsRouter } from '@/server/routers/settings';

describe('Settings Router (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaCategories.clear();
    mockPrismaProfiles.clear();
  });

  describe('getCategories', () => {
    it('should return CS categories sorted by ID', async () => {
      // Create test categories
      mockPrismaCategories.set('cs.AI', {
        id: 'cs.AI',
        name: 'Artificial Intelligence',
        description: '',
      });

      mockPrismaCategories.set('cs.LG', {
        id: 'cs.LG',
        name: 'Machine Learning',
        description: '',
      });

      mockPrismaCategories.set('cs.CL', {
        id: 'cs.CL',
        name: 'Computation and Language',
        description: '',
      });

      mockPrismaCategories.set('math.AG', {
        id: 'math.AG',
        name: 'Algebraic Geometry',
        description: '',
      });

      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.getCategories();

      // Should only return CS categories
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('cs.AI');
      expect(result[1].id).toBe('cs.CL');
      expect(result[2].id).toBe('cs.LG');
    });

    it('should return empty array if no categories exist', async () => {
      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.getCategories();

      expect(result).toHaveLength(0);
    });
  });

  describe('getProfile', () => {
    it('should return existing profile', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        arxivCategories: ['cs.AI', 'cs.LG'],
        sourcesEnabled: ['arxiv'],
        useLocalEmbeddings: true,
        useLocalLLM: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaProfiles.set(profile.id, profile);

      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.getProfile();

      expect(result.id).toBe('profile-1');
      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.LG']);
      expect(result.useLocalEmbeddings).toBe(true);
    });

    it('should return default profile if none exists', async () => {
      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.getProfile();

      expect(result.id).toBe('default');
      expect(result.userId).toBe('default');
      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.CL', 'cs.LG']);
      expect(result.useLocalEmbeddings).toBe(true);
      expect(result.useLocalLLM).toBe(true);
    });
  });

  describe('updateCategories', () => {
    it('should update existing profile categories', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        arxivCategories: ['cs.AI'],
        sourcesEnabled: ['arxiv'],
        useLocalEmbeddings: true,
        useLocalLLM: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaProfiles.set(profile.id, profile);

      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.updateCategories({
        categories: ['cs.AI', 'cs.LG', 'cs.CL'],
      });

      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.LG', 'cs.CL']);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create new profile if none exists', async () => {
      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.updateCategories({
        categories: ['cs.AI', 'cs.LG'],
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('default');
      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.LG']);
      expect(result.sourcesEnabled).toEqual(['arxiv']);
    });
  });

  describe('updateProcessing', () => {
    it('should update existing profile processing preferences', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        arxivCategories: ['cs.AI'],
        sourcesEnabled: ['arxiv'],
        useLocalEmbeddings: true,
        useLocalLLM: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaProfiles.set(profile.id, profile);

      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.updateProcessing({
        useLocalEmbeddings: false,
        useLocalLLM: false,
      });

      expect(result.useLocalEmbeddings).toBe(false);
      expect(result.useLocalLLM).toBe(false);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create new profile with processing preferences if none exists', async () => {
      const caller = settingsRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.updateProcessing({
        useLocalEmbeddings: false,
        useLocalLLM: true,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('default');
      expect(result.useLocalEmbeddings).toBe(false);
      expect(result.useLocalLLM).toBe(true);
      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.CL', 'cs.LG']);
    });
  });
});
