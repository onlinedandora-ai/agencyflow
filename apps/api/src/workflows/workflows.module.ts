import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SettingsModule } from '../settings/settings.module';
import { AutomationQueueService } from './automation-queue.service';
import { AutomationService } from './automation.service';
import { AutomationsController } from './automations.controller';

@Module({
  imports: [ScheduleModule.forRoot(), SettingsModule],
  controllers: [AutomationsController],
  providers: [AutomationService, AutomationQueueService],
  exports: [AutomationService],
})
export class WorkflowsModule {}
