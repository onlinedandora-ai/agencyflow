import { IsOptional, IsString } from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsString()
  invoiceId: string;

  @IsOptional()
  @IsString()
  milestoneId?: string;

  @IsString()
  payerName: string;

  @IsOptional()
  @IsString()
  payerEmail?: string;
}

export class VerifyRazorpayPaymentDto {
  @IsString()
  razorpay_order_id: string;

  @IsString()
  razorpay_payment_id: string;

  @IsString()
  razorpay_signature: string;
}
