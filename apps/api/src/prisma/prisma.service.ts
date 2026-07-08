import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function cleanDbUrl(value: string | undefined): string | undefined {
  if (value == null) return value;
  let v = value.trim().replace(/[\u201C\u201D\u2018\u2019]/g, '"');
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  // pasted as DATABASE_URL=postgresql://...
  const eq = v.indexOf('=');
  if (eq > 0 && /database_url|direct_url/i.test(v.slice(0, eq))) {
    const maybe = v.slice(eq + 1).trim();
    if (/^postgres(ql)?:\/\//i.test(maybe)) v = maybe;
  }
  return v;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = cleanDbUrl(process.env.DATABASE_URL);
    const directUrl = cleanDbUrl(process.env.DIRECT_URL);
    if (url) process.env.DATABASE_URL = url;
    if (directUrl) process.env.DIRECT_URL = directUrl;

    super(
      url
        ? {
            datasources: {
              db: { url },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
