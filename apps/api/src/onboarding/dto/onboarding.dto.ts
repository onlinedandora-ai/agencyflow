import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkspaceProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  serviceLine?: string;
}
