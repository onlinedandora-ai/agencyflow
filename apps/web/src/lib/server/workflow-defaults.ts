export type WorkflowSettings = {
  enabled: boolean;
  leadSlaScan: boolean;
  proposalFollowUp: boolean;
  invoiceOverdue: boolean;
  deliverableReviewNudge: boolean;
};

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  enabled: true,
  leadSlaScan: true,
  proposalFollowUp: true,
  invoiceOverdue: true,
  deliverableReviewNudge: true,
};

export type AutomationJobType =
  | "lead_sla_scan"
  | "proposal_followup"
  | "invoice_overdue"
  | "deliverable_review_nudge";

export const AUTOMATION_JOB_TYPES: AutomationJobType[] = [
  "lead_sla_scan",
  "proposal_followup",
  "invoice_overdue",
  "deliverable_review_nudge",
];

/** In-process / Nest BullMQ cron schedules. */
export const AUTOMATION_CRON_SCHEDULES: Array<{
  job: AutomationJobType;
  schedule: string;
}> = [
  { job: "lead_sla_scan", schedule: "*/5 * * * *" },
  { job: "proposal_followup", schedule: "0 * * * *" },
  { job: "invoice_overdue", schedule: "0 9 * * *" },
  { job: "deliverable_review_nudge", schedule: "*/15 * * * *" },
];
