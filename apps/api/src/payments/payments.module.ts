import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [InvoicesModule],
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
