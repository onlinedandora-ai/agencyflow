export { cn } from "./utils";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type LeadSla = {
  targetMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  breached: boolean;
  responded: boolean;
};

export type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  notes?: string | null;
  firstResponseAt?: string | null;
  slaBreached: boolean;
  createdAt: string;
  assignee?: { id: string; name: string; email: string } | null;
  sla: LeadSla;
};

export type PipelineColumn = {
  stage: string;
  leads: Lead[];
};

export type PipelineStats = {
  total: number;
  won: number;
  conversionRate: number;
  slaBreaches: number;
  awaitingFirstResponse: number;
};

export type CaseStudy = {
  id: string;
  title: string;
  clientName: string;
  serviceLine: string;
  summary: string;
  outcome?: string | null;
};

export type AgencyProfile = {
  name: string;
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  gstin?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  defaultTermsAndConditions?: string | null;
};

export type ProposalSendLog = {
  id: string;
  version: number;
  sentAt: string;
  isResend: boolean;
  publicUrl?: string | null;
  internalNote?: string | null;
  sentBy?: { name: string } | null;
};

export type ProposalRevisionRequest = {
  id: string;
  versionAtRequest: number;
  requestedAt: string;
  requestedByName: string;
  requestedByEmail?: string | null;
  comments: string;
  status: string;
  addressedAt?: string | null;
  addressedInVersion?: number | null;
};

export type ProposalHistory = {
  currentVersion: number;
  sendLogs: ProposalSendLog[];
  revisionRequests: ProposalRevisionRequest[];
};

export type Proposal = {
  id: string;
  leadId: string;
  proposalNumber?: string | null;
  situation?: string | null;
  recommendation?: string | null;
  deliverables?: string | null;
  timeline?: string | null;
  investment?: string | null;
  nextStep?: string | null;
  termsAndConditions?: string | null;
  wordCount: number;
  wordLimit: number;
  overWordLimit: boolean;
  status?: string;
  currentVersion?: number;
  isAccepted?: boolean;
  canEdit?: boolean;
  clientUrl?: string | null;
  caseStudyId?: string | null;
  caseStudy?: CaseStudy | null;
  publicToken?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  followUpHoursRemaining?: number | null;
  followUpOverdue?: boolean;
  billingFlow?: string;
  lead?: Lead;
  sendLogs?: ProposalSendLog[];
  revisionRequests?: ProposalRevisionRequest[];
};

export type PublicProposal = Proposal & { agency: AgencyProfile };

export type DiscoveryCall = {
  id: string;
  leadId: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  researchNotes?: string | null;
  callNotes?: string | null;
  answers?: Record<string, string> | null;
  lead?: Lead;
};

export type ClientWorkspace = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  serviceLine?: string | null;
  leadId?: string | null;
  billingToken?: string | null;
  billingFlow?: string | null;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    advancePaidAt?: string | null;
    invoices: Array<{ id: string; number: string; amount: string; status: string; isAdvance: boolean }>;
  }>;
  invoices: Array<{ id: string; number: string; amount: string; status: string; isAdvance: boolean }>;
};

export type TaskSla = {
  active: boolean;
  targetHours: number;
  targetMinutes: number;
  deadline: string | null;
  remainingMinutes: number;
  elapsedMinutes: number;
  breached: boolean;
  atRisk: boolean;
  completed: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  boardColumn: string;
  sortOrder: number;
  priority?: string | null;
  dueDate?: string | null;
  sla?: TaskSla;
  revisionRound: number;
  isBlockedByGate?: boolean;
  gateReason?: string | null;
  customFields?: Record<string, string> | null;
  createdAt?: string;
  updatedAt?: string;
  assignee?: { id: string; name: string; email: string; role?: string } | null;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type TaskDetail = TaskItem & {
  columnLabel?: string;
  project?: { id: string; name: string; status: string };
  workspace?: { id: string; name: string; company?: string | null; serviceLine?: string | null };
  template?: {
    customFieldLabels: Record<string, string>;
    columns: Array<{ key: string; label: string; status: string }>;
  };
};

export type BoardColumnData = {
  key: string;
  label: string;
  status: string;
  tasks: TaskItem[];
};

export type ProjectBoard = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  serviceLine: string;
  isGateLocked: boolean;
  gateMessage?: string | null;
  overdueCount?: number;
  slaBreaches?: number;
  completedCount?: number;
  urgentCount?: number;
  progressPercent?: number;
  health?: "green" | "yellow" | "red";
  workspace: { id: string; name: string; company?: string | null };
  template: {
    key: string;
    label: string;
    columns: Array<{ key: string; label: string; status: string }>;
    customFieldLabels: Record<string, string>;
  };
  columns: BoardColumnData[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  serviceLine: string;
  taskCount: number;
  isGateLocked: boolean;
  overdueCount?: number;
  slaBreaches?: number;
  completedCount?: number;
  urgentCount?: number;
  progressPercent?: number;
  health?: "green" | "yellow" | "red";
  team?: Array<{ id: string; name: string }>;
  workspace: { id: string; name: string; company?: string | null };
};

export type PaymentMilestone = {
  id: string;
  label: string;
  amount: string | number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  sortOrder: number;
  receipt?: { id: string; number: string; paidAt?: string | null } | null;
  notifications?: Array<{
    id: string;
    sentAt: string;
    message: string;
    internalNote?: string | null;
    sentBy?: { name: string } | null;
  }>;
};

export type MilestoneTemplate = {
  key: string;
  label: string;
  description: string;
  splits: Array<{ label: string; percent: number }>;
};

export type SalesInvoice = {
  id: string;
  number: string;
  documentType: string;
  typeLabel: string;
  amount: string;
  status: string;
  description?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  sentAt?: string | null;
  requestedAt?: string | null;
  requestedByName?: string | null;
  publicToken?: string | null;
  billingUrl?: string | null;
  publicUrl?: string | null;
  paymentMode?: string | null;
  paymentReference?: string | null;
  isAdvance?: boolean;
  amountPaid?: number;
  amountDue?: number;
  receipts?: SalesInvoice[];
  paymentMilestones?: PaymentMilestone[];
  workspace?: { name: string; company?: string | null; billingToken?: string | null };
};

export type BillingPortal = {
  workspace: { id: string; name: string; company?: string | null; billingFlow: string };
  agency: AgencyProfile;
  proposal?: {
    proposalNumber?: string | null;
    acceptedAt?: string | null;
    acceptedByName?: string | null;
    investment?: string | null;
    deliverables?: string | null;
  } | null;
  draftInvoice?: SalesInvoice | null;
  taxInvoice?: SalesInvoice | null;
  pendingTaxRequest?: SalesInvoice | null;
  receipts: SalesInvoice[];
  milestones: PaymentMilestone[];
  steps: Array<{ key: string; label: string; done: boolean; active?: boolean }>;
};

export type InvoiceNumbering = {
  draftInvoicePrefix: string;
  draftInvoiceNextSeq: number;
  taxInvoicePrefix: string;
  taxInvoiceNextSeq: number;
  receiptPrefix: string;
  receiptNextSeq: number;
};

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) => apiFetch<User>("/auth/me", {}, token),
  getPipeline: (token: string) => apiFetch<PipelineColumn[]>("/leads/pipeline", {}, token),
  getStats: (token: string) => apiFetch<PipelineStats>("/leads/stats", {}, token),
  createLead: (token: string, data: Record<string, string>) =>
    apiFetch<Lead>("/leads", { method: "POST", body: JSON.stringify(data) }, token),
  updateLead: (token: string, id: string, data: Record<string, string>) =>
    apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  logFirstResponse: (token: string, id: string) =>
    apiFetch<Lead>(`/leads/${id}/first-response`, { method: "POST", body: JSON.stringify({}) }, token),
  getProposals: (token: string) => apiFetch<Proposal[]>("/proposals", {}, token),
  getProposalByLead: (token: string, leadId: string) =>
    apiFetch<Proposal>(`/proposals/lead/${leadId}`, {}, token),
  upsertProposal: (token: string, leadId: string, data: Record<string, string | undefined>) =>
    apiFetch<Proposal>(`/proposals/lead/${leadId}`, { method: "PUT", body: JSON.stringify(data) }, token),
  sendProposal: (token: string, leadId: string, internalNote?: string) =>
    apiFetch<Proposal & { clientUrl: string; version: number; message: string }>(
      `/proposals/lead/${leadId}/send`,
      { method: "POST", body: JSON.stringify({ internalNote }) },
      token,
    ),
  resendProposal: (token: string, leadId: string, internalNote?: string) =>
    apiFetch<Proposal & { clientUrl: string; version: number; message: string }>(
      `/proposals/lead/${leadId}/resend`,
      { method: "POST", body: JSON.stringify({ internalNote }) },
      token,
    ),
  getProposalHistory: (token: string, leadId: string) =>
    apiFetch<ProposalHistory>(`/proposals/lead/${leadId}/history`, {}, token),
  acceptProposal: (token: string, leadId: string, data: { acceptedByName: string; acceptedByEmail: string }) =>
    apiFetch<{ proposal: Proposal; workspace: ClientWorkspace; message: string }>(
      `/proposals/lead/${leadId}/accept`,
      { method: "POST", body: JSON.stringify(data) },
      token,
    ),
  getPublicProposal: (publicToken: string) =>
    apiFetch<PublicProposal>(`/proposals/public/${publicToken}`),
  acceptPublicProposal: (publicToken: string, data: { acceptedByName: string; acceptedByEmail: string }) =>
    apiFetch<{ proposal: Proposal; workspace: ClientWorkspace; message: string }>(
      `/proposals/public/${publicToken}/accept`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  requestProposalRevision: (
    publicToken: string,
    data: { requestedByName: string; requestedByEmail?: string; comments: string },
  ) =>
    apiFetch<{ message: string }>(`/proposals/public/${publicToken}/request-revision`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAgencyProfile: (token: string) => apiFetch<AgencyProfile>("/settings/agency", {}, token),
  getCaseStudies: (token: string) => apiFetch<CaseStudy[]>("/proposals/case-studies", {}, token),
  getDiscovery: (token: string, leadId: string) =>
    apiFetch<DiscoveryCall>(`/discovery/lead/${leadId}`, {}, token),
  upsertDiscovery: (token: string, leadId: string, data: Record<string, unknown>) =>
    apiFetch<DiscoveryCall>(`/discovery/lead/${leadId}`, { method: "PUT", body: JSON.stringify(data) }, token),
  getWorkspaces: (token: string) => apiFetch<ClientWorkspace[]>("/onboarding/workspaces", {}, token),
  getWorkspace: (token: string, id: string) =>
    apiFetch<ClientWorkspace>(`/onboarding/workspaces/${id}`, {}, token),
  convertLead: (token: string, leadId: string) =>
    apiFetch<ClientWorkspace>(`/onboarding/convert-lead/${leadId}`, { method: "POST", body: "{}" }, token),
  confirmAdvancePayment: (token: string, invoiceId: string) =>
    apiFetch<unknown>(`/onboarding/invoices/${invoiceId}/confirm-payment`, { method: "POST", body: "{}" }, token),
  getProjects: (token: string) => apiFetch<ProjectSummary[]>("/projects", {}, token),
  getProjectBoard: (token: string, projectId: string) =>
    apiFetch<ProjectBoard>(`/projects/${projectId}/board`, {}, token),
  getTask: (token: string, taskId: string) => apiFetch<TaskDetail>(`/projects/tasks/${taskId}`, {}, token),
  getAssignableTeam: (token: string) => apiFetch<TeamMember[]>("/users/assignable", {}, token),
  createTask: (
    token: string,
    projectId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
      customFields?: Record<string, string>;
    },
  ) => apiFetch<TaskItem>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) }, token),
  updateTask: (
    token: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
      customFields?: Record<string, string>;
    },
  ) =>
    apiFetch<TaskItem>(`/projects/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  moveTask: (token: string, taskId: string, boardColumn: string) =>
    apiFetch<TaskItem>(`/projects/tasks/${taskId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ boardColumn }),
    }, token),
  getInvoices: (token: string, params?: { documentType?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.documentType) qs.set("documentType", params.documentType);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiFetch<SalesInvoice[]>(`/invoices${query ? `?${query}` : ""}`, {}, token);
  },
  getInvoiceNumbering: (token: string) =>
    apiFetch<InvoiceNumbering>("/invoices/settings/numbering", {}, token),
  updateInvoiceNumbering: (token: string, data: InvoiceNumbering) =>
    apiFetch<InvoiceNumbering>("/invoices/settings/numbering", {
      method: "PATCH",
      body: JSON.stringify(data),
    }, token),
  issueTaxInvoice: (token: string, invoiceId: string) =>
    apiFetch<SalesInvoice>(`/invoices/${invoiceId}/issue`, { method: "POST", body: "{}" }, token),
  recordPayment: (
    token: string,
    invoiceId: string,
    data: { paymentMode: string; paymentReference?: string; amount?: number; milestoneId?: string },
  ) =>
    apiFetch<{ invoice: SalesInvoice; receipt: SalesInvoice; message: string }>(
      `/invoices/${invoiceId}/record-payment`,
      { method: "POST", body: JSON.stringify(data) },
      token,
    ),
  getBillingPortal: (billingToken: string) =>
    apiFetch<BillingPortal>(`/billing/${billingToken}`),
  requestTaxInvoice: (
    billingToken: string,
    data: { requestedByName: string; requestedByEmail?: string },
  ) =>
    apiFetch<{ message: string }>(`/billing/${billingToken}/request-tax-invoice`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getBillingDocument: (docToken: string) =>
    apiFetch<{ invoice: SalesInvoice & { workspace?: { name: string; company?: string | null; email?: string | null } }; agency: AgencyProfile }>(
      `/billing/doc/${docToken}`,
    ),
  getMilestoneTemplates: (token: string) =>
    apiFetch<MilestoneTemplate[]>("/invoices/templates/milestones", {}, token),
  setInvoiceMilestones: (
    token: string,
    invoiceId: string,
    data: { templateKey?: string; milestones?: Array<{ label: string; amount: number; dueDate?: string }> },
  ) =>
    apiFetch<SalesInvoice>(`/invoices/${invoiceId}/milestones`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token),
  sendMilestoneNotification: (token: string, milestoneId: string, internalNote?: string) =>
    apiFetch<{
      notificationText: string;
      billingUrl?: string | null;
      whatsappUrl: string;
      mailtoUrl?: string | null;
      clientName: string;
      clientEmail?: string | null;
      message: string;
    }>(`/invoices/milestones/${milestoneId}/send-notification`, {
      method: "POST",
      body: JSON.stringify({ internalNote }),
    }, token),
};

export const DISCOVERY_QUESTIONS = [
  "What is the primary business goal for this project?",
  "Who is the target audience?",
  "What problem are you trying to solve?",
  "What does success look like in 90 days?",
  "What is your budget range?",
  "What is your ideal timeline?",
  "Who are the key decision-makers?",
  "What assets or references do you already have?",
  "What has been tried before and what failed?",
  "Any constraints we should know about (brand, legal, technical)?",
];
