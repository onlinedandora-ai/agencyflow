export type BoardColumn = {
  key: string;
  label: string;
  status: string;
};

export type ServiceLineTemplate = {
  key: string;
  label: string;
  columns: BoardColumn[];
  customFieldLabels: Record<string, string>;
};

export const SERVICE_LINE_TEMPLATES: Record<string, ServiceLineTemplate> = {
  "Web Development": {
    key: "web_dev",
    label: "Web Development",
    columns: [
      { key: "backlog", label: "Backlog", status: "TODO" },
      { key: "design", label: "Design", status: "IN_PROGRESS" },
      { key: "dev", label: "Dev", status: "IN_PROGRESS" },
      { key: "qa", label: "QA", status: "INTERNAL_QA" },
      { key: "client_review", label: "Client Review", status: "CLIENT_REVIEW" },
      { key: "live", label: "Live", status: "APPROVED" },
    ],
    customFieldLabels: { repoLink: "Repo link", environment: "Environment", bugSeverity: "Bug severity" },
  },
  "Digital Marketing": {
    key: "digital_marketing",
    label: "Digital Marketing",
    columns: [
      { key: "strategy", label: "Strategy", status: "TODO" },
      { key: "in_progress", label: "In Progress", status: "IN_PROGRESS" },
      { key: "client_approval", label: "Client Approval", status: "CLIENT_REVIEW" },
      { key: "scheduled", label: "Scheduled", status: "IN_PROGRESS" },
      { key: "live", label: "Live", status: "APPROVED" },
      { key: "reporting", label: "Reporting", status: "APPROVED" },
    ],
    customFieldLabels: { channel: "Channel", campaign: "Campaign", budget: "Budget" },
  },
  "Content Creation": {
    key: "content_creation",
    label: "Content Creation",
    columns: [
      { key: "brief", label: "Brief", status: "TODO" },
      { key: "draft", label: "Draft", status: "IN_PROGRESS" },
      { key: "internal_review", label: "Internal Review", status: "INTERNAL_QA" },
      { key: "client_review", label: "Client Review", status: "CLIENT_REVIEW" },
      { key: "approved", label: "Approved", status: "APPROVED" },
      { key: "published", label: "Published", status: "APPROVED" },
    ],
    customFieldLabels: {
      contentType: "Content type",
      platform: "Platform",
      publishDate: "Publish date",
    },
  },
  "Ad Management": {
    key: "ad_management",
    label: "Ad Management",
    columns: [
      { key: "planning", label: "Planning", status: "TODO" },
      { key: "creative_build", label: "Creative Build", status: "IN_PROGRESS" },
      { key: "client_approval", label: "Client Approval", status: "CLIENT_REVIEW" },
      { key: "live", label: "Live", status: "APPROVED" },
      { key: "optimizing", label: "Optimizing", status: "IN_PROGRESS" },
      { key: "reporting", label: "Reporting", status: "APPROVED" },
    ],
    customFieldLabels: { platform: "Platform", budget: "Budget", roasTarget: "ROAS target" },
  },
};
