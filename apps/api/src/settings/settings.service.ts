import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_AGENCY_PROFILE } from '../common/agency-defaults';
import {
  DEFAULT_WORKFLOW_SETTINGS,
  type WorkflowSettings,
} from '../workflows/workflow-defaults';
import { UpdateAgencyProfileDto, UpdateWorkflowSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAgencyProfile() {
    const profile = await this.prisma.agencyProfile.findUnique({ where: { id: 'default' } });
    if (profile) return profile;

    return this.prisma.agencyProfile.create({
      data: { id: 'default', ...DEFAULT_AGENCY_PROFILE },
    });
  }

  async updateAgencyProfile(dto: UpdateAgencyProfileDto) {
    await this.getAgencyProfile();
    return this.prisma.agencyProfile.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  async getWorkflowSettings(): Promise<WorkflowSettings> {
    const profile = await this.getAgencyProfile();
    return { ...DEFAULT_WORKFLOW_SETTINGS, ...(profile.workflowSettings as WorkflowSettings | null) };
  }

  async updateWorkflowSettings(dto: UpdateWorkflowSettingsDto) {
    const current = await this.getWorkflowSettings();
    const next = { ...current, ...dto };
    await this.getAgencyProfile();
    await this.prisma.agencyProfile.update({
      where: { id: 'default' },
      data: { workflowSettings: next },
    });
    return next;
  }
}
