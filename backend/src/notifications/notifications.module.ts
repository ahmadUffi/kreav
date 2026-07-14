import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { MailerService } from './mailer.service';
import { ProductDeliveryListener } from './product-delivery.listener';

/**
 * NotificationsModule — MVP product delivery.
 *
 * Listens for `settlement.completed` and emails the buyer their product link
 * (MailerService via Resend), recording each attempt in NotificationLog.
 *
 * Imports StellarModule for ExplorerService (transaction links in the email).
 */
@Module({
  imports: [PrismaModule, StellarModule],
  providers: [MailerService, ProductDeliveryListener],
  exports: [MailerService],
})
export class NotificationsModule {}
