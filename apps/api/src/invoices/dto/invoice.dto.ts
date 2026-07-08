import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';

export class MilestoneItemDto {
  @IsString()
  label: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class SendMilestoneNotificationDto {
  @IsOptional()
  @IsString()
  internalNote?: string;
}

export class SetMilestonesDto {
  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneItemDto)
  milestones?: MilestoneItemDto[];
}

export class UpdateInvoiceNumberingDto {
  @IsOptional()
  @IsString()
  draftInvoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  draftInvoiceNextSeq?: number;

  @IsOptional()
  @IsString()
  taxInvoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  taxInvoiceNextSeq?: number;

  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @IsOptional()
  @IsNumber()
  receiptNextSeq?: number;
}

export class RecordPaymentDto {
  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  milestoneId?: string;
}

export class RequestTaxInvoiceDto {
  @IsString()
  requestedByName: string;

  @IsOptional()
  @IsString()
  requestedByEmail?: string;
}

export class IssueTaxInvoiceDto {
  @IsOptional()
  @IsString()
  internalNote?: string;
}
