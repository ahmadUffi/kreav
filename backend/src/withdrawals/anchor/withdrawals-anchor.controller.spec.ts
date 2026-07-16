import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { WalletsService } from '../../wallets/wallets.service';
import { WithdrawalsService } from '../withdrawals.service';
import { AnchorSep24Service } from './anchor-sep24.service';
import { SponsorshipService } from '../../stellar/sponsorship.service';
import { STELLAR_PUBLIC_CONFIG } from '../../stellar/stellar.config';
import { WithdrawalsAnchorController } from './withdrawals-anchor.controller';
import type { AuthUser } from '../../auth/jwt-auth.guard';

describe('WithdrawalsAnchorController', () => {
  let controller: WithdrawalsAnchorController;
  let withdrawals: { getWithdrawableBalance: jest.Mock };
  let wallets: { getAddressForCreator: jest.Mock };
  let anchor: {
    withdrawInteractive: jest.Mock;
    getTransaction: jest.Mock;
    mapStatus: jest.Mock;
  };
  let prisma: { withdrawal: { create: jest.Mock; updateMany: jest.Mock } };
  let sponsorship: { buildWithdrawPayment: jest.Mock; submitWithdrawPayment: jest.Mock };

  const USER: AuthUser = { userId: 'creator-1', role: 'CREATOR' };
  const CONFIG = {
    anchorHomeDomain: 'testanchor.stellar.org',
    anchorEnabled: true,
  };

  beforeEach(async () => {
    withdrawals = { getWithdrawableBalance: jest.fn() };
    wallets = { getAddressForCreator: jest.fn() };
    anchor = {
      withdrawInteractive: jest.fn(),
      getTransaction: jest.fn(),
      mapStatus: jest.fn(),
    };
    prisma = {
      withdrawal: { create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    sponsorship = { buildWithdrawPayment: jest.fn(), submitWithdrawPayment: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [WithdrawalsAnchorController],
      providers: [
        { provide: WalletsService, useValue: wallets },
        { provide: WithdrawalsService, useValue: withdrawals },
        { provide: AnchorSep24Service, useValue: anchor },
        { provide: PrismaService, useValue: prisma },
        { provide: SponsorshipService, useValue: sponsorship },
        { provide: STELLAR_PUBLIC_CONFIG, useValue: CONFIG },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { isTokenRevoked: jest.fn().mockReturnValue(false) } },
      ],
    }).compile();

    controller = module.get(WithdrawalsAnchorController);
  });

  describe('interactive()', () => {
    it('rejects insufficient balance', async () => {
      wallets.getAddressForCreator.mockResolvedValue('GADDR1234567890ABCDEF');
      withdrawals.getWithdrawableBalance.mockResolvedValue(new Prisma.Decimal('5.00'));

      await expect(controller.interactive(USER, { token: 'tok', amount: 10 })).rejects.toThrow(
        ForbiddenException,
      );

      await expect(controller.interactive(USER, { token: 'tok', amount: 10 })).rejects.toThrow(
        /Insufficient withdrawable balance/,
      );
    });

    it('succeeds with enough balance and creates a withdrawal record', async () => {
      wallets.getAddressForCreator.mockResolvedValue('GADDR1234567890ABCDEF');
      withdrawals.getWithdrawableBalance.mockResolvedValue(new Prisma.Decimal('100.00'));
      anchor.withdrawInteractive.mockResolvedValue({
        url: 'https://anchor.test/kyc',
        id: 'anchor-1',
      });
      prisma.withdrawal.create.mockResolvedValue({ id: 'wd-1' });

      const result = await controller.interactive(USER, { token: 'tok', amount: 10 });

      expect(result).toEqual({
        url: 'https://anchor.test/kyc',
        id: 'anchor-1',
        withdrawalId: 'wd-1',
      });
      expect(prisma.withdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creatorId: 'creator-1',
            amount: new Prisma.Decimal(10),
            destinationType: 'ANCHOR',
            status: 'PROCESSING',
            anchorTransactionId: 'anchor-1',
          }),
          select: { id: true },
        }),
      );
    });
  });

  describe('transaction()', () => {
    it('updateMany includes creatorId in where clause', async () => {
      anchor.getTransaction.mockResolvedValue({ status: 'completed' });
      anchor.mapStatus.mockReturnValue('COMPLETED');

      const result = await controller.transaction(USER, 'anchor-1', 'tok');

      expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { anchorTransactionId: 'anchor-1', creatorId: 'creator-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
      expect(result.status).toBe('completed');
      expect(result.mappedStatus).toBe('COMPLETED');
    });
  });

  describe('submitPayment()', () => {
    it('updateMany includes creatorId in where clause and returns txHash', async () => {
      wallets.getAddressForCreator.mockResolvedValue('GADDR1234567890ABCDEF');
      sponsorship.submitWithdrawPayment.mockResolvedValue('txhash123');

      const result = await controller.submitPayment(USER, {
        signedXdr: 'xdr...',
        id: 'anchor-1',
      });

      expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { anchorTransactionId: 'anchor-1', creatorId: 'creator-1' },
        data: { txHash: 'txhash123' },
      });
      expect(result).toEqual({ txHash: 'txhash123' });
    });
  });
});
