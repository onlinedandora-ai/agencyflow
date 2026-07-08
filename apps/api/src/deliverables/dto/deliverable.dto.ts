import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeliverableType } from '@prisma/client';

export class CreateDeliverableDto {
  @IsEnum(DeliverableType)
  type: DeliverableType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  fileDataUrl?: string;
}

export class ReviewDeliverableDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class ClientDeliverableFeedbackDto {
  @IsString()
  @MaxLength(2000)
  feedback: string;

  @IsOptional()
  approved?: boolean;
}
