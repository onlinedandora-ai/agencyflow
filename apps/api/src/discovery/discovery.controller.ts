import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DiscoveryService } from './discovery.service';
import { UpsertDiscoveryDto } from './dto/discovery.dto';

@Controller('discovery')
@UseGuards(AuthGuard('jwt'))
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('lead/:leadId')
  findByLead(@Param('leadId') leadId: string) {
    return this.discoveryService.findByLead(leadId);
  }

  @Put('lead/:leadId')
  upsert(@Param('leadId') leadId: string, @Body() dto: UpsertDiscoveryDto) {
    return this.discoveryService.upsert(leadId, dto);
  }
}
