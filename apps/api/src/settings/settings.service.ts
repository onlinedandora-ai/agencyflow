import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_AGENCY_PROFILE } from '../common/agency-defaults';

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
}
