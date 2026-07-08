import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const CREATABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.CLIENT_MANAGER,
  UserRole.DELIVERY_EXEC,
] as const;

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole, {
    message: `role must be one of: ${CREATABLE_ROLES.join(', ')}`,
  })
  role: UserRole;
}
