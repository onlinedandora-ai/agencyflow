import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BillingFlow } from '@prisma/client';

export class UpsertProposalDto {
  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  deliverables?: string;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @IsString()
  investment?: string;

  @IsOptional()
  @IsString()
  nextStep?: string;

  @IsOptional()
  @IsString()
  caseStudyId?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsEnum(BillingFlow)
  billingFlow?: BillingFlow;
}

export class AcceptProposalDto {
  @IsString()
  acceptedByName: string;

  @IsString()
  acceptedByEmail: string;
}

export class SendProposalDto {
  @IsOptional()
  @IsString()
  internalNote?: string;
}

export class RequestRevisionDto {
  @IsString()
  @MinLength(1)
  requestedByName: string;

  @IsOptional()
  @IsString()
  requestedByEmail?: string;

  @IsString()
  @MinLength(10)
  comments: string;
}

export class ResendProposalDto {
  @IsOptional()
  @IsString()
  internalNote?: string;
}
