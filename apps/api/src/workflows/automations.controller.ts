import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AutomationQueueService } from './automation-queue.service';
import { AutomationService } from './automation.service';
import type { AutomationJobType } from './workflow-defaults';

@Controller('automations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
export class AutomationsController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly queueService: AutomationQueueService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      engine: this.queueService.isRedisEnabled() ? 'bullmq' : 'cron',
      redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    };
  }

  @Get('runs')
  getRuns() {
    return this.automationService.getRecentRuns(30);
  }

  @Post('trigger/:jobType')
  trigger(@Param('jobType') jobType: AutomationJobType) {
    return this.queueService.triggerJob(jobType);
  }
}
