import { ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const INTERNAL_ROLES = [UserRole.ADMIN, UserRole.CLIENT_MANAGER, UserRole.DELIVERY_EXEC] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listAssignable() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [...INTERNAL_ROLES] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  listAll() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [...INTERNAL_ROLES] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    if (!(INTERNAL_ROLES as readonly UserRole[]).includes(dto.role)) {
      throw new ConflictException('Only internal team roles can be created from the admin panel');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }
}
