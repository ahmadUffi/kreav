import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from './site.service';

describe('SiteService', () => {
  let service: SiteService;
  let prisma: {
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    user: { update: jest.Mock; findUnique: jest.Mock };
    socialLink: { deleteMany: jest.Mock; createMany: jest.Mock };
    customLink: { deleteMany: jest.Mock; createMany: jest.Mock };
    featuredProduct: { deleteMany: jest.Mock; createMany: jest.Mock };
    product: { findFirst: jest.Mock };
  };

  const USER_ID = 'u1';

  const mockUserWithSite = {
    name: 'Maya Tan',
    username: 'maya.shoots',
    bio: 'Photographer from Jakarta.',
    avatarEmoji: '🌅',
    accent: '#FF3BFF',
    socialLinks: [
      { platform: 'INSTAGRAM', handle: 'maya.shoots' },
      { platform: 'X', handle: 'mayashoots' },
    ],
    customLinks: [
      { label: 'My Lightroom workflow', url: 'https://example.com/workflow', sortOrder: 0 },
    ],
    featuredProducts: [{ productId: 'p1' }, { productId: 'p2' }],
  };

  beforeEach(async () => {
    tx = {
      user: { update: jest.fn(), findUnique: jest.fn() },
      socialLink: { deleteMany: jest.fn(), createMany: jest.fn() },
      customLink: { deleteMany: jest.fn(), createMany: jest.fn() },
      featuredProduct: { deleteMany: jest.fn(), createMany: jest.fn() },
      product: { findFirst: jest.fn() },
    };

    prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (txArg: typeof tx) => unknown) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SiteService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SiteService);
  });

  describe('getSite', () => {
    it('returns site configuration', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithSite);

      const result = await service.getSite(USER_ID);

      expect(result).toEqual({
        displayName: 'Maya Tan',
        username: 'maya.shoots',
        bio: 'Photographer from Jakarta.',
        avatarEmoji: '🌅',
        accent: '#FF3BFF',
        socials: {
          instagram: 'maya.shoots',
          x: 'mayashoots',
          tiktok: undefined,
          youtube: undefined,
        },
        links: [{ label: 'My Lightroom workflow', url: 'https://example.com/workflow' }],
        featuredProductIds: ['p1', 'p2'],
      });
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getSite(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateSite', () => {
    const dto = {
      displayName: 'Maya Tan Updated',
      username: 'maya.updated',
      bio: 'Updated bio',
      avatarEmoji: '✨',
      accent: '#00FF00',
      socials: { instagram: 'maya.updated', x: undefined, tiktok: undefined, youtube: undefined },
      links: [{ label: 'New Link', url: 'https://example.com/new' }],
      featuredProductIds: ['p1', 'p3'],
    };

    it('updates site with valid featured products', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      tx.user.update.mockResolvedValue(undefined);
      tx.socialLink.deleteMany.mockResolvedValue(undefined);
      tx.socialLink.createMany.mockResolvedValue(undefined);
      tx.customLink.deleteMany.mockResolvedValue(undefined);
      tx.customLink.createMany.mockResolvedValue(undefined);
      tx.featuredProduct.deleteMany.mockResolvedValue(undefined);
      tx.product.findFirst.mockResolvedValue({ id: 'p1', creatorId: USER_ID });
      tx.featuredProduct.createMany.mockResolvedValue(undefined);

      tx.user.findUnique.mockResolvedValue({
        name: 'Maya Tan Updated',
        username: 'maya.updated',
        bio: 'Updated bio',
        avatarEmoji: '✨',
        accent: '#00FF00',
        socialLinks: [{ platform: 'INSTAGRAM', handle: 'maya.updated' }],
        customLinks: [{ label: 'New Link', url: 'https://example.com/new' }],
        featuredProducts: [{ productId: 'p1' }, { productId: 'p3' }],
      });

      const result = await service.updateSite(USER_ID, dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.displayName).toBe('Maya Tan Updated');
      expect(result.username).toBe('maya.updated');
      expect(result.featuredProductIds).toEqual(['p1', 'p3']);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateSite(USER_ID, dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when featuredProductIds includes product from another creator', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      tx.user.update.mockResolvedValue(undefined);
      tx.socialLink.deleteMany.mockResolvedValue(undefined);
      tx.socialLink.createMany.mockResolvedValue(undefined);
      tx.customLink.deleteMany.mockResolvedValue(undefined);
      tx.customLink.createMany.mockResolvedValue(undefined);
      tx.featuredProduct.deleteMany.mockResolvedValue(undefined);
      tx.product.findFirst.mockResolvedValue(null);

      await expect(service.updateSite(USER_ID, dto)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
