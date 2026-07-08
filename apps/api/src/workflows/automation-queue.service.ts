import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AutomationService } from './automation.service';
import type { AutomationJobType } from './workflow-defaults';

const QUEUE_NAME = 'agencyflow-automation';

@Injectable()
export class AutomationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private useRedis = false;

  constructor(
    private readonly automationService: AutomationService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  isRedisEnabled() {
    return this.useRedis;
  }

  private redisUrl() {
    return process.env.REDIS_URL?.trim() || '';
  }

  private connectionOptions() {
    return { url: this.redisUrl(), maxRetriesPerRequest: null };
  }

  async onModuleInit() {
    const url = this.redisUrl();
    if (url) {
      const probe = new IORedis(url, { maxRetriesPerRequest: null });
      try {
        await probe.ping();
        const connection = this.connectionOptions();
        this.queue = new Queue(QUEUE_NAME, { connection });
        this.worker = new Worker(
          QUEUE_NAME,
          async (job) => this.runJob(job.name as AutomationJobType),
          { connection },
        );
        this.worker.on('failed', (job, err) => {
          this.logger.error(`Job ${job?.name} failed: ${err.message}`);
        });
        await this.registerRepeatableJobs();
        this.useRedis = true;
        this.logger.log('BullMQ automation engine started (Redis)');
        return;
      } catch (err) {
        this.logger.warn(`Redis unavailable, falling back to in-process cron: ${(err as Error).message}`);
      } finally {
        probe.disconnect();
      }
    } else {
      this.logger.warn('REDIS_URL not set — using in-process cron for workflow automation');
    }
    this.registerCronFallbacks();
  }

  private async registerRepeatableJobs() {
    if (!this.queue) return;
    const jobs: Array<{ name: AutomationJobType; pattern: string }> = [
      { name: 'lead_sla_scan', pattern: '*/5 * * * *' },
      { name: 'proposal_followup', pattern: '0 * * * *' },
      { name: 'invoice_overdue', pattern: '0 9 * * *' },
      { name: 'deliverable_review_nudge', pattern: '*/15 * * * *' },
    ];
    for (const job of jobs) {
      await this.queue.add(job.name, {}, { repeat: { pattern: job.pattern }, jobId: job.name });
    }
  }

  private registerCronFallbacks() {
    const crons: Array<{ name: AutomationJobType; pattern: string }> = [
      { name: 'lead_sla_scan', pattern: '*/5 * * * *' },
      { name: 'proposal_followup', pattern: '0 * * * *' },
      { name: 'invoice_overdue', pattern: '0 9 * * *' },
      { name: 'deliverable_review_nudge', pattern: '*/15 * * * *' },
    ];
    for (const { name, pattern } of crons) {
      const job = new CronJob(pattern, () => {
        void this.runJob(name);
      });
      this.schedulerRegistry.addCronJob(`automation-${name}`, job);
      job.start();
    }
    this.logger.log('In-process cron automation registered');
  }

  private async runJob(type: AutomationJobType) {
    switch (type) {
      case 'lead_sla_scan':
        return this.automationService.scanLeadSla();
      case 'proposal_followup':
        return this.automationService.scanProposalFollowUps();
      case 'invoice_overdue':
        return this.automationService.scanOverdueInvoices();
      case 'deliverable_review_nudge':
        return this.automationService.scanPendingDeliverableReviews();
      default:
        this.logger.warn(`Unknown automation job: ${type}`);
    }
  }

  async triggerJob(type: AutomationJobType) {
    if (this.queue) {
      await this.queue.add(type, {}, { jobId: `${type}-manual-${Date.now()}` });
      return { mode: 'bullmq', type };
    }
    const result = await this.runJob(type);
    return { mode: 'cron', type, result };
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
