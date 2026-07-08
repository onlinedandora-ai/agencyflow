import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import {
  IssueTaxInvoiceDto,
  RecordPaymentDto,
  RequestTaxInvoiceDto,
  UpdateInvoiceNumberingDto,
  SendMilestoneNotificationDto,
  SetMilestonesDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('billing/:token')
  getBillingPortal(@Param('token') token: string) {
    return this.invoicesService.getBillingPortal(token);
  }

  @Post('billing/:token/request-tax-invoice')
  requestTaxInvoice(@Param('token') token: string, @Body() dto: RequestTaxInvoiceDto) {
    return this.invoicesService.requestTaxInvoice(token, dto);
  }

  @Get('billing/doc/:token')
  getPublicDocument(@Param('token') token: string) {
    return this.invoicesService.getPublicDocument(token);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoices')
  findAll(
    @Query('documentType') documentType?: InvoiceDocumentType,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoicesService.findAll({ documentType, status });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoices/templates/milestones')
  getMilestoneTemplates() {
    return this.invoicesService.getMilestoneTemplates();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoices/settings/numbering')
  getNumbering() {
    return this.invoicesService.getNumberingSettings();
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('invoices/settings/numbering')
  updateNumbering(@Body() dto: UpdateInvoiceNumberingDto) {
    return this.invoicesService.updateNumberingSettings(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('invoices/milestones/:milestoneId/send-notification')
  sendMilestoneNotification(
    @Param('milestoneId') milestoneId: string,
    @Body() dto: SendMilestoneNotificationDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.invoicesService.sendMilestoneNotification(milestoneId, dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoices/:id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('invoices/:id/milestones')
  setMilestones(
    @Param('id') id: string,
    @Body() dto: SetMilestonesDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.invoicesService.setMilestones(id, dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('invoices/:id/issue')
  issueTaxInvoice(
    @Param('id') id: string,
    @Body() dto: IssueTaxInvoiceDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.invoicesService.issueTaxInvoice(id, dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('invoices/:id/record-payment')
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.invoicesService.recordPayment(id, dto, req.user.sub);
  }
}
