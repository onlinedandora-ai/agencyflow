import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      service: 'AgencyFlow API',
      status: 'ok',
      app: process.env.WEB_ORIGIN || 'http://localhost:3000',
      message: 'Open the web app URL above in your browser. This port is the API only.',
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
