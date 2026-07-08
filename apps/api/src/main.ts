import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Strip accidental quotes/whitespace from Render / dashboard env pastes. */
function sanitizeEnv(key: string) {
  const raw = process.env[key];
  if (raw == null) return;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed !== raw) process.env[key] = trimmed;
}

sanitizeEnv('DATABASE_URL');
sanitizeEnv('DIRECT_URL');
sanitizeEnv('WEB_ORIGIN');
sanitizeEnv('JWT_SECRET');

async function bootstrap() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    console.error(
      'DATABASE_URL must start with postgresql:// (remove quotes if pasting into Render).',
    );
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
