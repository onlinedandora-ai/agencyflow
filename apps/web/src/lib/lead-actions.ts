export const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "DISCOVERY_SCHEDULED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
  "NURTURE",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type LeadCardActions = {
  showLogResponse: boolean;
  showDiscovery: boolean;
  showProposal: boolean;
  showConvert: boolean;
};

/** Stage-aware primary actions per agency SOP. */
export function getLeadCardActions(stage: string): LeadCardActions {
  switch (stage) {
    case "NEW":
      return { showLogResponse: true, showDiscovery: false, showProposal: false, showConvert: false };
    case "CONTACTED":
    case "DISCOVERY_SCHEDULED":
      return { showLogResponse: false, showDiscovery: true, showProposal: false, showConvert: false };
    case "PROPOSAL_SENT":
      return { showLogResponse: false, showDiscovery: false, showProposal: true, showConvert: false };
    case "NEGOTIATION":
      return { showLogResponse: false, showDiscovery: false, showProposal: true, showConvert: true };
    case "CLOSED_WON":
      return { showLogResponse: false, showDiscovery: false, showProposal: false, showConvert: true };
    default:
      return { showLogResponse: false, showDiscovery: false, showProposal: false, showConvert: false };
  }
}
