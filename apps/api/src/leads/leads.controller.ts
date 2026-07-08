import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateLeadDto, LogFirstResponseDto, UpdateLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@UseGuards(AuthGuard('jwt'))
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll() {
    return this.leadsService.findAll();
  }

  @Get('pipeline')
  findByStage() {
    return this.leadsService.findByStage();
  }

  @Get('stats')
  getStats() {
    return this.leadsService.getPipelineStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Post(':id/first-response')
  logFirstResponse(@Param('id') id: string, @Body() dto: LogFirstResponseDto) {
    return this.leadsService.logFirstResponse(id, dto);
  }
}
