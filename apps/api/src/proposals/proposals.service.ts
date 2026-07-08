import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage, ProposalStatus, RevisionRequestStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  AcceptProposalDto,
  RequestRevisionDto,
  ResendProposalDto,
  SendProposalDto,
  UpsertProposalDto,
} from './dto/proposal.dto';

const WORD_LIMIT = 300;
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

function countWords(...sections: (string | null | undefined)[]) {
  const text = sections.filter(Boolean).join(' ');
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly onboardingService: OnboardingService,
    private readonly invoicesService: InvoicesService,
  ) {}

  private withMeta<
    T extends {
      sentAt: Date | null;
      wordCount: number;
      status: ProposalStatus;
      acceptedAt: Date | null;
      currentVersion: number;
    },
  >(proposal: T) {
    const hoursRemaining = proposal.sentAt
      ? Math.max(0, Math.round((proposal.sentAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 3600000))
      : null;

    const canEdit =
      proposal.status === ProposalStatus.DRAFT ||
      proposal.status === ProposalStatus.SENT ||
      proposal.status === ProposalStatus.REVISION_REQUESTED;

    return {
      ...proposal,
      wordLimit: WORD_LIMIT,
      overWordLimit: proposal.wordCount > WORD_LIMIT,
      followUpHoursRemaining: hoursRemaining,
      followUpOverdue: proposal.sentAt ? hoursRemaining === 0 : false,
      isAccepted: proposal.status === ProposalStatus.ACCEPTED,
      canEdit: canEdit && proposal.status !== ProposalStatus.ACCEPTED,
    };
  }

  private snapshotFromProposal(proposal: {
    situation: string | null;
    recommendation: string | null;
    deliverables: string | null;
    timeline: string | null;
    investment: string | null;
    nextStep: string | null;
    termsAndConditions: string | null;
    caseStudyId: string | null;
    wordCount: number;
  }) {
    return {
      situation: proposal.situation,
      recommendation: proposal.recommendation,
      deliverables: proposal.deliverables,
      timeline: proposal.timeline,
      investment: proposal.investment,
      nextStep: proposal.nextStep,
      termsAndConditions: proposal.termsAndConditions,
      caseStudyId: proposal.caseStudyId,
      wordCount: proposal.wordCount,
    };
  }

  private async nextProposalNumber() {
    const count = await this.prisma.proposal.count();
    const year = new Date().getFullYear();
    return `PROP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private proposalInclude = {
    caseStudy: true,
    lead: { include: { assignee: { select: { id: true, name: true, email: true } } } },
    sendLogs: { orderBy: { sentAt: 'desc' as const }, include: { sentBy: { select: { id: true, name: true } } } },
    revisionRequests: { orderBy: { requestedAt: 'desc' as const } },
  };

  async findAll() {
    const proposals = await this.prisma.proposal.findMany({
      include: this.proposalInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return proposals.map((p) => this.withMeta(p));
  }

  async findByLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const agency = await this.settingsService.getAgencyProfile();

    let proposal = await this.prisma.proposal.findUnique({
      where: { leadId },
      include: this.proposalInclude,
    });

    if (!proposal) {
      proposal = await this.prisma.proposal.create({
        data: { leadId, termsAndConditions: agency.defaultTermsAndConditions },
        include: this.proposalInclude,
      });
    }

    const meta = this.withMeta(proposal);
    const clientUrl = proposal.publicToken ? `${WEB_ORIGIN}/p/${proposal.publicToken}` : null;

    return { ...meta, clientUrl };
  }

  async findByPublicToken(token: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { publicToken: token },
      include: this.proposalInclude,
    });
    if (!proposal) throw new NotFoundException('Proposal not found');

    const agency = await this.settingsService.getAgencyProfile();
    return { ...this.withMeta(proposal), agency };
  }

  async upsert(leadId: string, dto: UpsertProposalDto) {
    const existing = await this.prisma.proposal.findUnique({ where: { leadId } });
    if (existing?.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Cannot edit an accepted proposal');
    }

    await this.findByLead(leadId);

    const wordCount = countWords(
      dto.situation,
      dto.recommendation,
      dto.deliverables,
      dto.timeline,
      dto.investment,
      dto.nextStep,
    );

    const proposal = await this.prisma.proposal.upsert({
      where: { leadId },
      create: { leadId, ...dto, wordCount },
      update: { ...dto, wordCount },
      include: this.proposalInclude,
    });

    return this.withMeta(proposal);
  }

  private validateProposalContent(proposal: {
    situation: string | null;
    recommendation: string | null;
    deliverables: string | null;
    timeline: string | null;
    investment: string | null;
    nextStep: string | null;
    termsAndConditions: string | null;
  }) {
    const required = [
      proposal.situation,
      proposal.recommendation,
      proposal.deliverables,
      proposal.timeline,
      proposal.investment,
      proposal.nextStep,
      proposal.termsAndConditions,
    ];
    if (required.some((s) => !s?.trim())) {
      throw new BadRequestException(
        'All six proposal sections and terms & conditions must be filled before sending',
      );
    }
  }

  async send(leadId: string, dto: SendProposalDto = {}, actorId?: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { leadId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Proposal already accepted');
    }
    if (proposal.currentVersion > 0) {
      throw new BadRequestException('Proposal already sent. Use resend after revisions.');
    }

    this.validateProposalContent(proposal);

    const now = new Date();
    const proposalNumber = proposal.proposalNumber || (await this.nextProposalNumber());
    const publicToken = proposal.publicToken || randomBytes(24).toString('hex');
    const version = 1;
    const publicUrl = `${WEB_ORIGIN}/p/${publicToken}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.proposal.update({
        where: { leadId },
        data: {
          sentAt: now,
          status: ProposalStatus.SENT,
          proposalNumber,
          publicToken,
          currentVersion: version,
        },
        include: this.proposalInclude,
      });

      await tx.proposalSendLog.create({
        data: {
          proposalId: p.id,
          version,
          sentAt: now,
          sentById: actorId,
          isResend: false,
          publicUrl,
          internalNote: dto.internalNote,
          snapshot: this.snapshotFromProposal(p),
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { stage: LeadStage.PROPOSAL_SENT, stageChangedAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'Proposal',
          entityId: p.id,
          action: 'PROPOSAL_SENT',
          metadata: { proposalNumber, leadId, version, publicUrl },
        },
      });

      return p;
    });

    return {
      ...this.withMeta(updated),
      clientUrl: publicUrl,
      version,
      message: 'Proposal sent. Share the client link with your call to action.',
    };
  }

  async resend(leadId: string, dto: ResendProposalDto = {}, actorId?: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { leadId },
      include: { revisionRequests: true },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Cannot resend an accepted proposal');
    }
    if (proposal.currentVersion === 0) {
      throw new BadRequestException('Proposal has not been sent yet');
    }

    this.validateProposalContent(proposal);

    const now = new Date();
    const version = proposal.currentVersion + 1;
    const publicUrl = `${WEB_ORIGIN}/p/${proposal.publicToken}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.proposal.update({
        where: { leadId },
        data: {
          sentAt: now,
          status: ProposalStatus.SENT,
          currentVersion: version,
        },
        include: this.proposalInclude,
      });

      await tx.proposalSendLog.create({
        data: {
          proposalId: p.id,
          version,
          sentAt: now,
          sentById: actorId,
          isResend: true,
          publicUrl,
          internalNote: dto.internalNote,
          snapshot: this.snapshotFromProposal(p),
        },
      });

      const pendingRevisions = proposal.revisionRequests.filter(
        (r) => r.status === RevisionRequestStatus.PENDING || r.status === RevisionRequestStatus.IN_PROGRESS,
      );

      for (const rev of pendingRevisions) {
        await tx.proposalRevisionRequest.update({
          where: { id: rev.id },
          data: {
            status: RevisionRequestStatus.ADDRESSED,
            addressedAt: now,
            addressedInVersion: version,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'Proposal',
          entityId: p.id,
          action: 'PROPOSAL_RESENT',
          metadata: { leadId, version, publicUrl, revisionsAddressed: pendingRevisions.length },
        },
      });

      return p;
    });

    return {
      ...this.withMeta(updated),
      clientUrl: publicUrl,
      version,
      message: `Proposal v${version} sent. Client link updated with latest version.`,
    };
  }

  async requestRevision(token: string, dto: RequestRevisionDto) {
    const proposal = await this.prisma.proposal.findUnique({ where: { publicToken: token } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Proposal already accepted — contact your account manager');
    }
    if (!proposal.sentAt) {
      throw new BadRequestException('Proposal has not been sent yet');
    }

    const now = new Date();

    const [revision, updated] = await this.prisma.$transaction(async (tx) => {
      const rev = await tx.proposalRevisionRequest.create({
        data: {
          proposalId: proposal.id,
          versionAtRequest: proposal.currentVersion,
          requestedByName: dto.requestedByName,
          requestedByEmail: dto.requestedByEmail,
          comments: dto.comments,
        },
      });

      const p = await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: ProposalStatus.REVISION_REQUESTED },
        include: this.proposalInclude,
      });

      await tx.auditLog.create({
        data: {
          entityType: 'Proposal',
          entityId: proposal.id,
          action: 'PROPOSAL_REVISION_REQUESTED',
          metadata: {
            revisionId: rev.id,
            version: proposal.currentVersion,
            requestedByName: dto.requestedByName,
            comments: dto.comments,
          },
        },
      });

      return [rev, p] as const;
    });

    return {
      revision,
      proposal: this.withMeta(updated),
      message: 'Revision request received. The team will update and resend the proposal.',
    };
  }

  async getHistory(leadId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { leadId },
      include: {
        sendLogs: { orderBy: { sentAt: 'desc' }, include: { sentBy: { select: { name: true } } } },
        revisionRequests: { orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');

    return {
      currentVersion: proposal.currentVersion,
      sendLogs: proposal.sendLogs,
      revisionRequests: proposal.revisionRequests,
    };
  }

  async accept(leadId: string, dto: AcceptProposalDto, actorId?: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { leadId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Proposal already accepted');
    }
    if (!proposal.sentAt) {
      throw new BadRequestException('Proposal must be sent before it can be accepted');
    }

    const pending = await this.prisma.proposalRevisionRequest.count({
      where: {
        proposalId: proposal.id,
        status: { in: [RevisionRequestStatus.PENDING, RevisionRequestStatus.IN_PROGRESS] },
      },
    });
    if (pending > 0) {
      throw new BadRequestException('Resolve pending revision requests before acceptance');
    }

    const now = new Date();
    const updated = await this.prisma.proposal.update({
      where: { leadId },
      data: {
        status: ProposalStatus.ACCEPTED,
        acceptedAt: now,
        acceptedByName: dto.acceptedByName,
        acceptedByEmail: dto.acceptedByEmail,
      },
      include: this.proposalInclude,
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { stage: LeadStage.CLOSED_WON, stageChangedAt: now },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        entityType: 'Proposal',
        entityId: updated.id,
        action: 'PROPOSAL_ACCEPTED',
        metadata: {
          acceptedByName: dto.acceptedByName,
          acceptedByEmail: dto.acceptedByEmail,
          leadId,
          version: proposal.currentVersion,
        },
      },
    });

    const workspace = await this.onboardingService.convertLead(leadId);
    const project = workspace.projects[0];
    if (!project) throw new BadRequestException('Failed to create project');

    const invoice = await this.invoicesService.createOnAccept({
      workspaceId: workspace.id,
      projectId: project.id,
      proposalId: updated.id,
      billingFlow: updated.billingFlow,
      investment: updated.investment,
      deliverables: updated.deliverables,
      isAdvance: true,
    });

    const refreshed = await this.onboardingService.getWorkspace(workspace.id);
    const billingUrl = refreshed.billingToken
      ? `${WEB_ORIGIN}/billing/${refreshed.billingToken}`
      : null;

    const flowMessage =
      updated.billingFlow === 'DRAFT_FIRST'
        ? 'Proposal accepted. Draft invoice is ready for client download.'
        : 'Proposal accepted. Advance tax invoice raised.';

    return {
      proposal: this.withMeta(updated),
      workspace: refreshed,
      invoice,
      billingUrl,
      message: flowMessage,
    };
  }

  async acceptByToken(token: string, dto: AcceptProposalDto) {
    const proposal = await this.prisma.proposal.findUnique({ where: { publicToken: token } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return this.accept(proposal.leadId, dto);
  }

  async getCaseStudies() {
    return this.prisma.caseStudy.findMany({ orderBy: { title: 'asc' } });
  }
}
