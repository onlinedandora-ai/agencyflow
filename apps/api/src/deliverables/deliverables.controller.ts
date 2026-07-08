import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeliverablesService } from './deliverables.service';
import {
  ClientDeliverableFeedbackDto,
  CreateDeliverableDto,
  ReviewDeliverableDto,
} from './dto/deliverable.dto';

@Controller()
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('projects/tasks/:taskId/deliverables')
  listForTask(@Param('taskId') taskId: string) {
    return this.deliverablesService.listForTask(taskId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/tasks/:taskId/deliverables')
  create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateDeliverableDto,
    @Req() req: { user: { sub: string; role: string } },
  ) {
    return this.deliverablesService.create(taskId, dto, req.user.sub, req.user.role);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/tasks/:taskId/deliverables/:id/submit')
  submit(
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Req() req: { user: { sub: string; role: string } },
  ) {
    return this.deliverablesService.submit(taskId, id, req.user.sub, req.user.role);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/tasks/:taskId/deliverables/:id/approve')
  approve(
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDeliverableDto,
    @Req() req: { user: { sub: string; role: string } },
  ) {
    return this.deliverablesService.approve(taskId, id, req.user.sub, req.user.role, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/tasks/:taskId/deliverables/:id/reject')
  reject(
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDeliverableDto,
    @Req() req: { user: { sub: string; role: string } },
  ) {
    return this.deliverablesService.reject(taskId, id, req.user.sub, req.user.role, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/tasks/:taskId/deliverables/:id/share')
  share(
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Req() req: { user: { sub: string; role: string } },
  ) {
    return this.deliverablesService.share(taskId, id, req.user.sub, req.user.role);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('deliverables/pending-review')
  listPendingReview() {
    return this.deliverablesService.listPendingReview();
  }

  @Get('portal/:token/deliverables')
  listPortalDeliverables(@Param('token') token: string) {
    return this.deliverablesService.listSharedForWorkspace(token);
  }

  @Get('deliverables/public/:token')
  getPublic(@Param('token') token: string) {
    return this.deliverablesService.getPublic(token);
  }

  @Post('deliverables/public/:token/feedback')
  clientFeedback(@Param('token') token: string, @Body() dto: ClientDeliverableFeedbackDto) {
    return this.deliverablesService.clientFeedback(token, dto);
  }
}
