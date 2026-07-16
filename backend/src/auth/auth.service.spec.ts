import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformKeypairService } from '../stellar/platform-keypair.service';
import { STELLAR_PUBLIC_CONFIG } from '../stellar/stellar.config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    wallet: { findFirst: jest.Mock };
  };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      wallet: { findFirst: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('fake-jwt') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: PlatformKeypairService,
          useValue: { getKeypair: jest.fn(), getPublicKey: jest.fn() },
        },
        {
          provide: STELLAR_PUBLIC_CONFIG,
          useValue: { networkPassphrase: 'Test SDF Network ; September 2015' },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string) => (key === 'NODE_ENV' ? 'test' : undefined)),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      name: 'Test User',
      role: 'CREATOR' as const,
    };

    const createdUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CREATOR',
      createdAt: new Date('2026-07-01T10:00:00Z'),
    };

    it('creates user and returns token + profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result).toMatchObject({
        token: 'fake-jwt',
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CREATOR',
        createdAt: '2026-07-01T10:00:00.000Z',
      });
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('includes jti in the JWT payload', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createdUser);

      await service.register(dto);

      expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ jti: expect.any(String) }));
    });
  });

  describe('walletStatus', () => {
    it('returns registered: true when wallet found', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ id: 'w-1' });

      const result = await service.walletStatus('GABC123');

      expect(result).toEqual({ registered: true });
    });

    it('returns registered: false when wallet not found', async () => {
      prisma.wallet.findFirst.mockResolvedValue(null);

      const result = await service.walletStatus('GABC123');

      expect(result).toEqual({ registered: false });
    });
  });

  describe('revokeToken / isTokenRevoked', () => {
    it('returns true for a revoked token and false for an unrevoked one', () => {
      service.revokeToken('abc');
      expect(service.isTokenRevoked('abc')).toBe(true);
      expect(service.isTokenRevoked('xyz')).toBe(false);
    });
  });
});
