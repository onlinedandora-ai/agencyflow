import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('workspaces')
  listWorkspaces() {
    return this.onboardingService.listWorkspaces();
  }

  @Get('workspaces/:id')
  getWorkspace(@Param('id') id: string) {
    return this.onboardingService.getWorkspace(id);
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
