import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

const INTERNAL_ROLES = [
  UserRole.ADMIN,
  UserRole.CLIENT_MANAGER,
  UserRole.DELIVERY_EXEC,
] as const;

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export class UserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserConflictError";
  }
}

export function listAssignable() {
  return prisma.user.findMany({
    where: {
      role: { in: [...INTERNAL_ROLES] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export function listAll() {
  return prisma.user.findMany({
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
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function createUser(dto: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new UserConflictError("A user with this email already exists");
  }

  if (!(INTERNAL_ROLES as readonly UserRole[]).includes(dto.role)) {
    throw new UserConflictError(
      "Only internal team roles can be created from the admin panel",
    );
  }

  const passwordHash = await bcrypt.hash(dto.password, 10);
  return prisma.user.create({
    data: {
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}
