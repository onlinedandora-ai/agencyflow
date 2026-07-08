import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { SettingsModule } from '../settings/settings.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [SettingsModule, OnboardingModule, InvoicesModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
})
export class ProposalsModule {}
