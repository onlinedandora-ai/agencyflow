import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertDiscoveryDto {
  @IsOptional()
  @IsString()
  researchNotes?: string;

  @IsOptional()
  @IsString()
  callNotes?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;
}
