import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Strip accidental quotes/whitespace from Render / dashboard env pastes. */
function sanitizeEnv(key: string) {
  const raw = process.env[key];
  if (raw == null) return;
  let v = raw.trim().replace(/[\u201C\u201D\u2018\u2019]/g, '"');
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  const eq = v.indexOf('=');
  if (eq > 0 && new RegExp(`^${key}$`, 'i').test(v.slice(0, eq).trim())) {
    v = v.slice(eq + 1).trim();
  }
  process.env[key] = v;
}

for (const key of ['DATABASE_URL', 'DIRECT_URL', 'WEB_ORIGIN', 'JWT_SECRET']) {
  sanitizeEnv(key);
}

async function bootstrap() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    console.error(
      'DATABASE_URL must start with postgresql:// (remove quotes if pasting into Render).',
    );
    console.error(
      `Got ${databaseUrl ? `prefix="${databaseUrl.slice(0, 24)}..."` : 'empty/missing value'}.`,
    );
    process.exit(1);
  }

  try {
    console.log(`Prisma DB host: ${new URL(databaseUrl).host}`);
  } catch {
    console.error('DATABASE_URL is not a valid URL after sanitize.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: webOrigins.length === 1 ? webOrigins[0] : webOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`AgencyFlow API running on port ${port}`);
}
bootstrap();
