import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAgencyProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsString() bankIfsc?: string;
  @IsOptional() @IsString() defaultTermsAndConditions?: string;
}

export class UpdateWorkflowSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() leadSlaScan?: boolean;
  @IsOptional() @IsBoolean() proposalFollowUp?: boolean;
  @IsOptional() @IsBoolean() invoiceOverdue?: boolean;
  @IsOptional() @IsBoolean() deliverableReviewNudge?: boolean;
}
