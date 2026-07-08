import { IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class SaveIntakeDto {
  @IsObject()
  data: Record<string, unknown>;
}

export class SubmitPaymentClaimDto {
  @IsString()
  invoiceId: string;

  @IsOptional()
  @IsString()
  milestoneId?: string;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsString()
  @MaxLength(120)
  submittedByName: string;

  @IsOptional()
  @IsString()
  submittedByEmail?: string;

  @IsOptional()
  @IsString()
  proofNote?: string;

  @IsOptional()
  @IsString()
  proofDataUrl?: string;
}

export class ReviewPaymentClaimDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
