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
  | 'lead_sla_scan'
  | 'proposal_followup'
  | 'invoice_overdue'
  | 'deliverable_review_nudge';
