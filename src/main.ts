import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, VersioningType } from '@nestjs/common';
import * as dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { cors: true });
  // Allow Cors
  app.enableCors({
    // origin: '*',
    origin: [
      'http://localhost:4200',
      'http://localhost:42001',
      'http://localhost:42002',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      'http://localhost:3007',
      'https://www.banglabazarbooks.com',
      'https://ui.banglabazarbooks.com',
      'https://banglabazarbooks.com',
      'https://admin.banglabazarbooks.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization,administrator',
    credentials: true,
  });
  // app.enableCors();
  // Version Control

  app.enableVersioning({
    type: VersioningType.URI,
  });
  // Global Prefix

  app.setGlobalPrefix('api');
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
}

bootstrap();
// Trigger reload: translator module loaded
