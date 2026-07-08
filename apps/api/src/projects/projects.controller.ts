import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('templates')
  getTemplates() {
    return this.projectsService.getTemplates();
  }

  @Get('tasks/:taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.projectsService.getTask(taskId);
  }

  @Patch('tasks/:taskId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.projectsService.updateTask(taskId, dto);
  }

  @Patch('tasks/:taskId/move')
  moveTask(@Param('taskId') taskId: string, @Body() dto: MoveTaskDto) {
    return this.projectsService.moveTask(taskId, dto);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':projectId/board')
  getBoard(@Param('projectId') projectId: string) {
    return this.projectsService.getBoard(projectId);
  }

  @Post(':projectId/tasks')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT_MANAGER)
  createTask(@Param('projectId') projectId: string, @Body() dto: CreateTaskDto) {
    return this.projectsService.createTask(projectId, dto);
  }

  @Get(':projectId')
  findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }
}
