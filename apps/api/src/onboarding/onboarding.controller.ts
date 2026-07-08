import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateWorkspaceProjectDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('workspaces')
  listWorkspaces() {
    return this.onboardingService.listWorkspaces();
  }

  @Get('workspaces/search')
  searchWorkspaces(@Query('q') q?: string) {
    return this.onboardingService.searchWorkspaces(q);
  }

  @Get('workspaces/:id')
  getWorkspace(@Param('id') id: string) {
    return this.onboardingService.getWorkspace(id);
  }

  @Post('workspaces/:workspaceId/new-project')
  createProjectForWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkspaceProjectDto,
  ) {
    return this.onboardingService.createProjectForWorkspace(workspaceId, dto);
  }

  @Post('convert-lead/:leadId')
  convertLead(@Param('leadId') leadId: string) {
    return this.onboardingService.convertLead(leadId);
  }

  @Post('invoices/:invoiceId/confirm-payment')
  confirmAdvancePayment(@Param('invoiceId') invoiceId: string) {
    return this.onboardingService.confirmAdvancePayment(invoiceId);
  }
}
