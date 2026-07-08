import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UpdateAgencyProfileDto, UpdateWorkflowSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('agency')
  getAgencyProfile() {
    return this.settingsService.getAgencyProfile();
  }

  @Patch('agency')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  updateAgencyProfile(@Body() dto: UpdateAgencyProfileDto) {
    return this.settingsService.updateAgencyProfile(dto);
  }

  @Get('workflow')
  getWorkflowSettings() {
    return this.settingsService.getWorkflowSettings();
  }

  @Patch('workflow')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  updateWorkflowSettings(@Body() dto: UpdateWorkflowSettingsDto) {
    return this.settingsService.updateWorkflowSettings(dto);
  }
}
