import { Test } from '@nestjs/testing';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExplorerService } from '../stellar/explorer.service';
import { AppEvents } from '../events/event-names';
import { MailerService } from './mailer.service';
import { ProductDeliveryListener } from './product-delivery.listener';

describe('ProductDeliveryListener', () => {
  let listener: ProductDeliveryListener;
  let prisma: {
    order: { findUnique: jest.Mock };
    notificationLog: { create: jest.Mock };
  };
  let mailer: { send: jest.Mock };

  const PAYLOAD = {
    orderId: 'order-1',
    txHash: 'txhash-abc',
    creatorAmountUsd: '9.50',
    platformAmountUsd: '0.50',
  };
  const ORDER = {
    buyerEmail: 'buyer@example.com',
    product: { title: 'Sunset Presets', fileUrl: 'https://drive.example/abc' },
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(ORDER) },
      notificationLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    };
    mailer = { send: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductDeliveryListener,
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailer },
        { provide: ExplorerService, useValue: { txUrl: (h: string) => `https://exp/tx/${h}` } },
      ],
    }).compile();

    listener = moduleRef.get(ProductDeliveryListener);
  });

  it('emails the buyer the product link and logs SENT', async () => {
    mailer.send.mockResolvedValue({ status: 'SENT', providerMessageId: 'msg_1' });

    await listener.handleSettlementCompleted(PAYLOAD);

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        subject: expect.stringContaining('Sunset Presets'),
        html: expect.stringContaining('https://drive.example/abc'),
      }),
    );
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipient: 'buyer@example.com',
          channel: NotificationChannel.EMAIL,
          event: AppEvents.SettlementCompleted,
          status: NotificationStatus.SENT,
          providerMessageId: 'msg_1',
        }),
      }),
    );
  });

  it('records SIMULATED sends as SENT with a marker providerMessageId', async () => {
    mailer.send.mockResolvedValue({ status: 'SIMULATED' });

    await listener.handleSettlementCompleted(PAYLOAD);

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.SENT,
          providerMessageId: 'SIMULATED',
        }),
      }),
    );
  });

  it('logs FAILED (with error) when the mailer fails', async () => {
    mailer.send.mockResolvedValue({ status: 'FAILED', error: 'boom' });

    await listener.handleSettlementCompleted(PAYLOAD);

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          lastError: 'boom',
        }),
      }),
    );
  });

  it('does not throw or send when the order/product is missing', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(listener.handleSettlementCompleted(PAYLOAD)).resolves.toBeUndefined();
    expect(mailer.send).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });
});
