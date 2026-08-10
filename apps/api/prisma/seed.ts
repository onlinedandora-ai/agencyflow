import 'dotenv/config';
import { PrismaClient, UserRole, LeadStage, LeadSource, ProposalStatus, ProjectStatus, TaskStatus, BillingFlow, InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_AGENCY_PROFILE } from '../src/common/agency-defaults';

const prisma = new PrismaClient();

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return daysFromNow(-days);
}

type DemoTaskSeed = {
  title: string;
  boardColumn: string;
  status: TaskStatus;
  sortOrder: number;
  priority: string;
  assigneeId?: string;
  revisionRound?: number;
  description?: string;
  dueDate?: Date;
  customFields?: Record<string, string>;
  qaSignedOffById?: string;
  qaSignedOffAt?: Date;
};

async function syncDemoTasks(projectId: string, tasks: DemoTaskSeed[], defaultAssigneeId: string) {
  for (const task of tasks) {
    const existing = await prisma.task.findFirst({
      where: { projectId, title: task.title },
    });
    const data = {
      boardColumn: task.boardColumn,
      status: task.status,
      sortOrder: task.sortOrder,
      priority: task.priority,
      assigneeId: task.assigneeId ?? defaultAssigneeId,
      revisionRound: task.revisionRound ?? 0,
      description: task.description,
      dueDate: task.dueDate,
      customFields: task.customFields,
      qaSignedOffAt: task.qaSignedOffAt,
      qaSignedOffById: task.qaSignedOffById,
    };

    if (existing) {
      await prisma.task.update({ where: { id: existing.id }, data });
    } else {
      await prisma.task.create({
        data: {
          projectId,
          title: task.title,
          ...data,
        },
      });
    }
  }
}

async function seedDemoProject(
  leadEmail: string,
  workspaceData: {
    name: string;
    company: string;
    email: string;
    phone?: string;
    serviceLine: string;
    billingToken?: string;
    billingFlow?: BillingFlow;
  },
  projectData: {
    id: string;
    name: string;
    status: ProjectStatus;
    advancePaidAt?: Date | null;
    requirementsFrozenAt?: Date;
  },
  tasks: DemoTaskSeed[],
  defaultAssigneeId: string,
) {
  const lead = await prisma.lead.findFirst({ where: { email: leadEmail } });
  if (!lead) return null;

  const workspace = await prisma.clientWorkspace.upsert({
    where: { leadId: lead.id },
    create: {
      leadId: lead.id,
      ...workspaceData,
      billingFlow: workspaceData.billingFlow ?? BillingFlow.DIRECT,
    },
    update: {
      serviceLine: workspaceData.serviceLine,
      billingToken: workspaceData.billingToken,
      billingFlow: workspaceData.billingFlow ?? BillingFlow.DIRECT,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: projectData.id },
    create: {
      id: projectData.id,
      workspaceId: workspace.id,
      name: projectData.name,
      status: projectData.status,
      advancePaidAt: projectData.advancePaidAt ?? null,
      requirementsFrozenAt: projectData.requirementsFrozenAt,
    },
    update: {
      status: projectData.status,
      advancePaidAt: projectData.advancePaidAt ?? null,
    },
  });

  await syncDemoTasks(project.id, tasks, defaultAssigneeId);
  return { workspace, project };
}

async function syncDemoLeads(managerId: string, adminId: string) {
  const now = Date.now();
  const demoLeads: Array<{
    email: string;
    stage: LeadStage;
    firstResponseAt: Date;
    createdAt: Date;
    slaBreached: boolean;
  }> = [
    {
      email: 'riya@startup.io',
      stage: LeadStage.NEW,
      firstResponseAt: new Date(now - 8 * 60 * 1000),
      createdAt: new Date(now - 12 * 60 * 1000),
      slaBreached: false,
    },
    {
      email: 'arjun@brandco.in',
      stage: LeadStage.DISCOVERY_SCHEDULED,
      firstResponseAt: new Date(now - 2 * 60 * 60 * 1000),
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      slaBreached: false,
    },
    {
      email: 'neha@retailplus.com',
      stage: LeadStage.PROPOSAL_SENT,
      firstResponseAt: new Date(now - 20 * 60 * 60 * 1000),
      createdAt: new Date(now - 22 * 60 * 60 * 1000),
      slaBreached: false,
    },
    {
      email: 'karan@fintech.app',
      stage: LeadStage.NEGOTIATION,
      firstResponseAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      slaBreached: false,
    },
    {
      email: 'lost@example.com',
      stage: LeadStage.CLOSED_LOST,
      firstResponseAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 11 * 24 * 60 * 60 * 1000),
      slaBreached: false,
    },
  ];

  for (const lead of demoLeads) {
    await prisma.lead.updateMany({
      where: { email: lead.email },
      data: {
        stage: lead.stage,
        firstResponseAt: lead.firstResponseAt,
        createdAt: lead.createdAt,
        slaBreached: lead.slaBreached,
        assigneeId: lead.email === 'karan@fintech.app' ? adminId : managerId,
      },
    });
  }
}

/** Tasks in client review must have peer QA sign-off (by someone other than assignee). */
async function syncClientReviewQaSignoffs(managerId: string, execId: string) {
  const clientReviewColumns = ['client_review', 'client_approval'];
  const tasks = await prisma.task.findMany({
    where: { boardColumn: { in: clientReviewColumns }, qaSignedOffAt: null },
  });
  const signedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  for (const task of tasks) {
    const signerId = task.assigneeId === execId ? managerId : execId;
    await prisma.task.update({
      where: { id: task.id },
      data: { qaSignedOffAt: signedAt, qaSignedOffById: signerId },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@agencyflow.com' },
    update: {
      passwordHash,
      name: 'Agency Admin',
      role: UserRole.ADMIN,
    },
    create: {
      email: 'admin@agencyflow.com',
      passwordHash,
      name: 'Agency Admin',
      role: UserRole.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@agencyflow.com' },
    update: {
      passwordHash,
      name: 'Client Manager',
      role: UserRole.CLIENT_MANAGER,
    },
    create: {
      email: 'manager@agencyflow.com',
      passwordHash,
      name: 'Client Manager',
      role: UserRole.CLIENT_MANAGER,
    },
  });

  const deliveryExec = await prisma.user.upsert({
    where: { email: 'exec@agencyflow.com' },
    update: {
      passwordHash,
      name: 'Priya Delivery',
      role: UserRole.DELIVERY_EXEC,
    },
    create: {
      email: 'exec@agencyflow.com',
      passwordHash,
      name: 'Priya Delivery',
      role: UserRole.DELIVERY_EXEC,
    },
  });

  const existingLeads = await prisma.lead.count();
  if (existingLeads === 0) {
    const now = Date.now();
    await prisma.lead.createMany({
      data: [
        {
          name: 'Riya Sharma',
          email: 'riya@startup.io',
          company: 'Startup.io',
          source: LeadSource.WEB_FORM,
          stage: LeadStage.NEW,
          assigneeId: manager.id,
          createdAt: new Date(now - 10 * 60 * 1000),
        },
        {
          name: 'Arjun Patel',
          email: 'arjun@brandco.in',
          company: 'BrandCo',
          source: LeadSource.REFERRAL,
          stage: LeadStage.DISCOVERY_SCHEDULED,
          assigneeId: manager.id,
          firstResponseAt: new Date(now - 2 * 60 * 60 * 1000),
        },
        {
          name: 'Neha Gupta',
          email: 'neha@retailplus.com',
          company: 'RetailPlus',
          source: LeadSource.WHATSAPP,
          stage: LeadStage.PROPOSAL_SENT,
          assigneeId: manager.id,
          firstResponseAt: new Date(now - 24 * 60 * 60 * 1000),
        },
        {
          name: 'Karan Mehta',
          email: 'karan@fintech.app',
          company: 'FinTech App',
          source: LeadSource.MANUAL,
          stage: LeadStage.NEGOTIATION,
          assigneeId: admin.id,
          firstResponseAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        },
        {
          name: 'Lost Lead Co',
          email: 'lost@example.com',
          company: 'Lost Lead Co',
          source: LeadSource.OTHER,
          stage: LeadStage.CLOSED_LOST,
          assigneeId: manager.id,
          firstResponseAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  const caseStudyCount = await prisma.caseStudy.count();
  if (caseStudyCount === 0) {
    await prisma.caseStudy.createMany({
      data: [
        {
          title: 'Startup Launch Campaign',
          clientName: 'TechStart',
          serviceLine: 'Digital Marketing',
          summary: 'Full-funnel launch for a B2B SaaS product.',
          outcome: '3x lead volume in 60 days',
        },
        {
          title: 'E-commerce Rebrand Film',
          clientName: 'RetailPlus',
          serviceLine: 'Content Creation',
          summary: 'Brand film + 12 social cutdowns for D2C relaunch.',
          outcome: '40% increase in ad CTR',
        },
        {
          title: 'Corporate Explainer Series',
          clientName: 'FinServe',
          serviceLine: 'Web Development',
          summary: 'Product explainers integrated into marketing site.',
          outcome: 'Reduced sales cycle by 2 weeks',
        },
      ],
    });
  }

  const retailCaseStudy = await prisma.caseStudy.findFirst({
    where: { title: 'E-commerce Rebrand Film' },
  });

  const nehaLead = await prisma.lead.findFirst({ where: { email: 'neha@retailplus.com' } });
  if (nehaLead && retailCaseStudy) {
    await prisma.lead.update({
      where: { id: nehaLead.id },
      data: { phone: '+91 98765 43210' },
    });
    const sampleProposal = {
      situation:
        'RetailPlus is relaunching its D2C brand with a new product line. Current content is fragmented across channels and not driving consistent conversions from paid social.',
      recommendation:
        'A focused 6-week content sprint: one hero brand film, 12 platform-native cutdowns, and a landing-page video module — all aligned to your Q3 launch.',
      deliverables:
        '• 1 × 90-sec brand film\n• 12 × social cutdowns (Reels/Shorts)\n• 1 × landing-page hero video\n• 2 revision rounds included',
      timeline:
        'Week 1–2: Script & pre-production\nWeek 3: Shoot\nWeek 4–5: Edit & client review\nWeek 6: Final delivery & handoff',
      investment:
        '₹1,85,000 + GST\n50% advance to begin · 50% on final delivery',
        nextStep:
          'Confirm by Friday and we\'ll send the onboarding pack + advance invoice. Kickoff call within 48 hours of payment.',
      termsAndConditions: `1. Scope: Work begins only after written acceptance and advance payment.\n2. Revisions: Two rounds included; additional revisions billed separately.\n3. Timeline: Depends on timely client feedback.\n4. Payment: 50% advance, 50% on delivery. Due within 7 days.\n5. Ownership: Usage rights transfer on full payment.`,
      wordCount: 98,
      caseStudyId: retailCaseStudy.id,
      proposalNumber: 'PROP-2026-0001',
      publicToken: 'demo-retailplus-proposal-token',
      status: ProposalStatus.SENT,
      currentVersion: 1,
      billingFlow: BillingFlow.DRAFT_FIRST,
      sentAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    };

    const upserted = await prisma.proposal.upsert({
      where: { leadId: nehaLead.id },
      create: { leadId: nehaLead.id, ...sampleProposal },
      update: sampleProposal,
    });

    await prisma.proposalSendLog.upsert({
      where: { id: 'demo-retailplus-send-log' },
      create: {
        id: 'demo-retailplus-send-log',
        proposalId: upserted.id,
        version: 1,
        sentAt: sampleProposal.sentAt,
        sentById: manager.id,
        isResend: false,
        publicUrl: 'http://localhost:3000/p/demo-retailplus-proposal-token',
        internalNote: 'Sent after discovery call',
      },
      update: {},
    });
  }

  const nehaLeadForWorkspace = await prisma.lead.findFirst({ where: { email: 'neha@retailplus.com' } });
  if (nehaLeadForWorkspace) {
    const workspace = await prisma.clientWorkspace.upsert({
      where: { leadId: nehaLeadForWorkspace.id },
      create: {
        leadId: nehaLeadForWorkspace.id,
        name: 'Neha Gupta',
        company: 'RetailPlus',
        email: 'neha@retailplus.com',
        phone: '+91 98765 43210',
        serviceLine: 'Content Creation',
        billingFlow: BillingFlow.DRAFT_FIRST,
        billingToken: 'demo-retailplus-billing-token',
      },
      update: {
        serviceLine: 'Content Creation',
        billingFlow: BillingFlow.DRAFT_FIRST,
        billingToken: 'demo-retailplus-billing-token',
      },
    });

    const project = await prisma.project.upsert({
      where: { id: 'demo-retailplus-project' },
      create: {
        id: 'demo-retailplus-project',
        workspaceId: workspace.id,
        name: 'RetailPlus — Content Sprint',
        status: ProjectStatus.AWAITING_ADVANCE,
        advancePaidAt: null,
        requirementsFrozenAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      update: {
        status: ProjectStatus.AWAITING_ADVANCE,
        advancePaidAt: null,
      },
    });

    const retailTasks: DemoTaskSeed[] = [
      {
        title: 'Brand film script & storyboard',
        boardColumn: 'brief',
        status: TaskStatus.TODO,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: manager.id,
        description: 'Script + storyboard for 90-sec hero film. Two revision rounds included.',
        dueDate: daysFromNow(7),
        customFields: { contentType: 'Brand film', platform: 'YouTube', publishDate: '2026-09-15' },
      },
      {
        title: 'Hero film — first cut',
        boardColumn: 'draft',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: deliveryExec.id,
        description: 'First assembly cut for client review. Include placeholder music.',
        dueDate: daysFromNow(4),
      },
      {
        title: '12 social cutdowns — batch 1',
        boardColumn: 'internal_review',
        status: TaskStatus.INTERNAL_QA,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(10),
        customFields: { contentType: 'Reels/Shorts', platform: 'Instagram', publishDate: '2026-09-20' },
      },
      {
        title: 'Landing page hero video',
        boardColumn: 'published',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        revisionRound: 1,
        dueDate: daysFromNow(12),
        customFields: { contentType: 'Web hero', platform: 'Website', publishDate: '2026-09-25' },
      },
      {
        title: 'Social cutdowns — batch 2',
        boardColumn: 'published',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(14),
        customFields: { contentType: 'Reels/Shorts', platform: 'Instagram', publishDate: '2026-09-28' },
      },
      {
        title: 'Q3 launch recap post',
        boardColumn: 'published',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'LOW',
        dueDate: daysFromNow(18),
        customFields: { contentType: 'Carousel', platform: 'LinkedIn', publishDate: '2026-10-01' },
      },
    ];
    await syncDemoTasks(project.id, retailTasks, manager.id);

    const advanceExists = await prisma.invoice.findFirst({
      where: { workspaceId: workspace.id, documentType: InvoiceDocumentType.DRAFT },
    });
    if (!advanceExists) {
      const proposal = await prisma.proposal.findUnique({ where: { leadId: nehaLeadForWorkspace.id } });
      await prisma.invoice.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          proposalId: proposal?.id,
          number: 'DRF-2026-0001',
          documentType: InvoiceDocumentType.DRAFT,
          amount: 92500,
          description: 'Draft invoice — for client review before tax invoice',
          lineItems: [{ description: 'Content sprint — advance (50%)', amount: 92500 }],
          status: InvoiceStatus.SENT,
          sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          isAdvance: true,
          publicToken: 'demo-retailplus-draft-invoice-token',
        },
      });
    }
  }

  // Additional task-board examples across service lines (gate cleared — full drag-and-drop)
  await seedDemoProject(
    'arjun@brandco.in',
    {
      name: 'Arjun Patel',
      company: 'BrandCo',
      email: 'arjun@brandco.in',
      serviceLine: 'Digital Marketing',
      billingToken: 'demo-brandco-billing-token',
    },
    {
      id: 'demo-brandco-project',
      name: 'BrandCo — Q3 Growth Campaign',
      status: ProjectStatus.ACTIVE,
      advancePaidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      requirementsFrozenAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    },
    [
      {
        title: 'Q3 campaign brief & KPIs',
        boardColumn: 'strategy',
        status: TaskStatus.TODO,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: manager.id,
        dueDate: daysFromNow(5),
        customFields: { channel: 'Multi-channel', campaign: 'Q3 Launch', budget: '₹2.5L' },
      },
      {
        title: 'Meta ads creative refresh',
        boardColumn: 'in_progress',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'HIGH',
        dueDate: daysAgo(1),
        description: 'Slightly behind — client assets arrived late.',
        customFields: { channel: 'Meta', campaign: 'Retargeting', budget: '₹80K' },
      },
      {
        title: 'Google Search ad copy set',
        boardColumn: 'live',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        revisionRound: 1,
        dueDate: daysFromNow(3),
        customFields: { channel: 'Google', campaign: 'Brand search', budget: '₹45K' },
      },
      {
        title: 'Email nurture sequence #4',
        boardColumn: 'scheduled',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(6),
        customFields: { channel: 'Email', campaign: 'Nurture', budget: '—' },
      },
      {
        title: 'Instagram Reels cadence',
        boardColumn: 'live',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(2),
        customFields: { channel: 'Instagram', campaign: 'Organic', budget: '—' },
      },
      {
        title: 'July performance report',
        boardColumn: 'reporting',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'LOW',
        assigneeId: admin.id,
        dueDate: daysFromNow(4),
        customFields: { channel: 'All', campaign: 'Monthly', budget: '—' },
      },
      {
        title: 'August performance report',
        boardColumn: 'reporting',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'LOW',
        assigneeId: admin.id,
        dueDate: daysFromNow(6),
        customFields: { channel: 'All', campaign: 'Monthly', budget: '—' },
      },
    ],
    manager.id,
  );

  await seedDemoProject(
    'karan@fintech.app',
    {
      name: 'Karan Mehta',
      company: 'FinTech App',
      email: 'karan@fintech.app',
      serviceLine: 'Web Development',
      billingToken: 'demo-fintech-billing-token',
    },
    {
      id: 'demo-fintech-project',
      name: 'FinTech App — Product Site v2',
      status: ProjectStatus.ACTIVE,
      advancePaidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      requirementsFrozenAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    },
    [
      {
        title: 'User onboarding flow audit',
        boardColumn: 'backlog',
        status: TaskStatus.TODO,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(8),
        customFields: { environment: 'Staging', bugSeverity: '—' },
      },
      {
        title: 'Dashboard wireframes v2',
        boardColumn: 'design',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: manager.id,
        dueDate: daysFromNow(5),
        customFields: { environment: 'Figma', bugSeverity: '—' },
      },
      {
        title: 'API integration — payments',
        boardColumn: 'dev',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: admin.id,
        dueDate: daysFromNow(6),
        customFields: { repoLink: 'github.com/demo/fintech-api', environment: 'Dev' },
      },
      {
        title: 'Mobile responsive regression',
        boardColumn: 'qa',
        status: TaskStatus.INTERNAL_QA,
        sortOrder: 0,
        priority: 'HIGH',
        dueDate: daysAgo(2),
        description: 'Minor delay — waiting on staging deploy.',
        customFields: { environment: 'QA', bugSeverity: 'Medium' },
      },
      {
        title: 'Settings page redesign',
        boardColumn: 'live',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        revisionRound: 2,
        dueDate: daysFromNow(3),
        customFields: { environment: 'Preview', bugSeverity: '—' },
      },
      {
        title: 'Marketing site — pricing page',
        boardColumn: 'live',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'LOW',
        dueDate: daysFromNow(1),
        customFields: { repoLink: 'github.com/demo/fintech-web', environment: 'Production' },
      },
    ],
    manager.id,
  );

  await seedDemoProject(
    'riya@startup.io',
    {
      name: 'Riya Sharma',
      company: 'Startup.io',
      email: 'riya@startup.io',
      serviceLine: 'Ad Management',
      billingToken: 'demo-startup-billing-token',
    },
    {
      id: 'demo-startup-project',
      name: 'Startup.io — Paid Acquisition',
      status: ProjectStatus.ACTIVE,
      advancePaidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      requirementsFrozenAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
    [
      {
        title: 'Q4 media plan & budget split',
        boardColumn: 'planning',
        status: TaskStatus.TODO,
        sortOrder: 0,
        priority: 'HIGH',
        assigneeId: manager.id,
        dueDate: daysFromNow(4),
        customFields: { platform: 'Multi', budget: '₹4L', roasTarget: '3.5x' },
      },
      {
        title: 'LinkedIn carousel set A',
        boardColumn: 'creative_build',
        status: TaskStatus.IN_PROGRESS,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(6),
        customFields: { platform: 'LinkedIn', budget: '₹60K', roasTarget: '—' },
      },
      {
        title: 'YouTube pre-roll variants',
        boardColumn: 'client_approval',
        status: TaskStatus.CLIENT_REVIEW,
        sortOrder: 0,
        priority: 'HIGH',
        revisionRound: 1,
        dueDate: daysFromNow(5),
        customFields: { platform: 'YouTube', budget: '₹1.2L', roasTarget: '2.8x' },
      },
      {
        title: 'Search brand campaign',
        boardColumn: 'reporting',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'HIGH',
        dueDate: daysFromNow(2),
        customFields: { platform: 'Google', budget: '₹90K', roasTarget: '4x' },
      },
      {
        title: 'Retargeting audience refresh',
        boardColumn: 'reporting',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'MEDIUM',
        dueDate: daysFromNow(3),
        customFields: { platform: 'Meta', budget: '₹50K', roasTarget: '3.2x' },
      },
      {
        title: 'Weekly ROAS dashboard',
        boardColumn: 'reporting',
        status: TaskStatus.APPROVED,
        sortOrder: 0,
        priority: 'LOW',
        assigneeId: admin.id,
        dueDate: daysFromNow(7),
        customFields: { platform: 'All', budget: '—', roasTarget: '3.5x' },
      },
    ],
    manager.id,
  );

  await syncDemoLeads(manager.id, admin.id);

  await prisma.agencyProfile.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...DEFAULT_AGENCY_PROFILE },
    update: {},
  });

  await syncClientReviewQaSignoffs(manager.id, deliveryExec.id);

  console.log('Seed complete');
  console.log('Admin login: admin@agencyflow.com / demo123');
  console.log('Manager login: manager@agencyflow.com / demo123');
  console.log('Delivery exec login: exec@agencyflow.com / demo123');
  console.log('On-time projects: RetailPlus (awaiting advance), Startup.io Paid Acquisition');
  console.log('Slight delay (1 overdue task each): BrandCo Q3 Growth, FinTech Product Site v2');
  console.log('Task boards: /projects/demo-retailplus-project/board (gate locked)');
  console.log('             /projects/demo-brandco-project/board (Digital Marketing — 1d overdue)');
  console.log('             /projects/demo-fintech-project/board (Web Development — 2d overdue)');
  console.log('             /projects/demo-startup-project/board (Ad Management — on track)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
