import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  AcceptProposalDto,
  RequestRevisionDto,
  ResendProposalDto,
  SendProposalDto,
  UpsertProposalDto,
} from './dto/proposal.dto';
import { ProposalsService } from './proposals.service';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get('public/:token')
  findByPublicToken(@Param('token') token: string) {
    return this.proposalsService.findByPublicToken(token);
  }

  @Post('public/:token/accept')
  acceptByToken(@Param('token') token: string, @Body() dto: AcceptProposalDto) {
    return this.proposalsService.acceptByToken(token, dto);
  }

  @Post('public/:token/request-revision')
  requestRevision(@Param('token') token: string, @Body() dto: RequestRevisionDto) {
    return this.proposalsService.requestRevision(token, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll() {
    return this.proposalsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('case-studies')
  getCaseStudies() {
    return this.proposalsService.getCaseStudies();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('lead/:leadId')
  findByLead(@Param('leadId') leadId: string) {
    return this.proposalsService.findByLead(leadId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('lead/:leadId/history')
  getHistory(@Param('leadId') leadId: string) {
    return this.proposalsService.getHistory(leadId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('lead/:leadId')
  upsert(@Param('leadId') leadId: string, @Body() dto: UpsertProposalDto) {
    return this.proposalsService.upsert(leadId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('lead/:leadId/send')
  send(
    @Param('leadId') leadId: string,
    @Body() dto: SendProposalDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.proposalsService.send(leadId, dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('lead/:leadId/resend')
  resend(
    @Param('leadId') leadId: string,
    @Body() dto: ResendProposalDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.proposalsService.resend(leadId, dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('lead/:leadId/accept')
  accept(@Param('leadId') leadId: string, @Body() dto: AcceptProposalDto) {
    return this.proposalsService.accept(leadId, dto);
  }
}
