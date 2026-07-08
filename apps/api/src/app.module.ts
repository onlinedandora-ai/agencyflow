import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { HealthController } from './health.controller';
import { LeadsModule } from './leads/leads.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ProjectsModule } from './projects/projects.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [PrismaModule, AuthModule, LeadsModule, ProposalsModule, DiscoveryModule, OnboardingModule, ProjectsModule, DeliverablesModule, InvoicesModule, ClientPortalModule, PaymentsModule, SettingsModule, UsersModule, WorkflowsModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
