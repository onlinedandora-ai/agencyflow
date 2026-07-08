import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentClaimStatus } from '@prisma/client';
import { ClientPortalService } from './client-portal.service';
import {
  ReviewPaymentClaimDto,
  SaveIntakeDto,
  SubmitPaymentClaimDto,
} from './dto/client-portal.dto';
import { CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from '../payments/dto/razorpay.dto';
import { RazorpayService } from '../payments/razorpay.service';

const INTAKE_SECTIONS = ['onboarding', 'brand', 'access'] as const;
type IntakeSectionParam = (typeof INTAKE_SECTIONS)[number];

function parseSection(section: string): IntakeSectionParam {
  if (!INTAKE_SECTIONS.includes(section as IntakeSectionParam)) {
    throw new Error('Invalid intake section');
  }
  return section as IntakeSectionParam;
}

@Controller()
export class ClientPortalController {
  constructor(
    private readonly clientPortalService: ClientPortalService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get('portal/:token')
  getPortal(@Param('token') token: string) {
    return this.clientPortalService.getPortal(token);
  }

  @Put('portal/:token/intake/:section')
  saveIntake(
    @Param('token') token: string,
    @Param('section') section: string,
    @Body() dto: SaveIntakeDto,
  ) {
    return this.clientPortalService.saveIntake(token, parseSection(section), dto.data);
  }

  @Post('portal/:token/intake/:section/submit')
  submitIntake(
    @Param('token') token: string,
    @Param('section') section: string,
    @Body() dto: SaveIntakeDto,
  ) {
    return this.clientPortalService.submitIntake(token, parseSection(section), dto.data);
  }

  @Post('portal/:token/payment-claim')
  submitPaymentClaim(@Param('token') token: string, @Body() dto: SubmitPaymentClaimDto) {
    return this.clientPortalService.submitPaymentClaim(token, dto);
  }

  @Post('portal/:token/razorpay/create-order')
  createRazorpayOrder(@Param('token') token: string, @Body() dto: CreateRazorpayOrderDto) {
    return this.razorpayService.createOrder(token, dto);
  }

  @Post('portal/:token/razorpay/verify')
  verifyRazorpayPayment(@Param('token') token: string, @Body() dto: VerifyRazorpayPaymentDto) {
    return this.razorpayService.verifyPayment(token, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('payment-claims')
  listPaymentClaims(@Query('status') status?: PaymentClaimStatus) {
    return this.clientPortalService.listPaymentClaims(status);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('payment-claims/:id/approve')
  approvePaymentClaim(
    @Param('id') id: string,
    @Body() dto: ReviewPaymentClaimDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clientPortalService.approvePaymentClaim(id, req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('payment-claims/:id/reject')
  rejectPaymentClaim(
    @Param('id') id: string,
    @Body() dto: ReviewPaymentClaimDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clientPortalService.rejectPaymentClaim(id, req.user.sub, dto);
  }
}
