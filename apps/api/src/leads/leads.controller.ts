import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
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

  @Get('archive')
  findArchived() {
    return this.leadsService.findArchived();
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

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  archive(@Param('id') id: string) {
    return this.leadsService.archive(id);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  restore(@Param('id') id: string) {
    return this.leadsService.restore(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
