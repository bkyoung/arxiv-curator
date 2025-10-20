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

      findUnique: vi.fn(async ({ where }) => {
        // Support both userId and id lookups
        if (where.userId) {
          const profiles = Array.from(mockPrismaProfiles.values());
          return profiles.find((p) => p.userId === where.userId) || null;
        }
        return mockPrismaProfiles.get(where.id) || null;
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

      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const result = await caller.getCategories();

      // Should only return CS categories
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('cs.AI');
      expect(result[1].id).toBe('cs.CL');
      expect(result[2].id).toBe('cs.LG');
    });

    it('should return empty array if no categories exist', async () => {
      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
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

      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const result = await caller.getProfile();

      expect(result.id).toBe('profile-1');
      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.LG']);
      expect(result.useLocalEmbeddings).toBe(true);
    });

    it('should throw error if profile does not exist', async () => {
      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      await expect(caller.getProfile()).rejects.toThrow(
        'User profile not found'
      );
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

      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const result = await caller.updateCategories({
        categories: ['cs.AI', 'cs.LG', 'cs.CL'],
      });

      expect(result.arxivCategories).toEqual(['cs.AI', 'cs.LG', 'cs.CL']);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error if profile does not exist', async () => {
      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      await expect(
        caller.updateCategories({
          categories: ['cs.AI', 'cs.LG'],
        })
      ).rejects.toThrow('User profile not found');
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

      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const result = await caller.updateProcessing({
        useLocalEmbeddings: false,
        useLocalLLM: false,
      });

      expect(result.useLocalEmbeddings).toBe(false);
      expect(result.useLocalLLM).toBe(false);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error if profile does not exist', async () => {
      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      await expect(
        caller.updateProcessing({
          useLocalEmbeddings: false,
          useLocalLLM: true,
        })
      ).rejects.toThrow('User profile not found');
    });
  });

  describe('updatePreferences', () => {
    it('should update existing profile preferences', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        arxivCategories: ['cs.AI'],
        sourcesEnabled: ['arxiv'],
        useLocalEmbeddings: true,
        useLocalLLM: true,
        digestEnabled: true,
        noiseCap: 15,
        scoreThreshold: 0.5,
        explorationRate: 0.15,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaProfiles.set(profile.id, profile);

      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const result = await caller.updatePreferences({
        digestEnabled: false,
        noiseCap: 20,
        scoreThreshold: 0.6,
      });

      expect(result.digestEnabled).toBe(false);
      expect(result.noiseCap).toBe(20);
      expect(result.scoreThreshold).toBe(0.6);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error if profile does not exist', async () => {
      const caller = settingsRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      await expect(
        caller.updatePreferences({
          digestEnabled: true,
          noiseCap: 15,
          scoreThreshold: 0.5,
        })
      ).rejects.toThrow('User profile not found');
    });
  });
});
