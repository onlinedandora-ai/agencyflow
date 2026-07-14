export type MilestoneTemplateSplit = {
  label: string;
  percent: number;
};

export type MilestoneTemplate = {
  key: string;
  label: string;
  description: string;
  splits: MilestoneTemplateSplit[];
};

export const MILESTONE_TEMPLATES: MilestoneTemplate[] = [
  {
    key: "ONE_TIME_50_50",
    label: "One-time (50/50)",
    description: "50% advance to begin, 50% on final delivery",
    splits: [
      { label: "Advance (50%)", percent: 50 },
      { label: "On delivery (50%)", percent: 50 },
    ],
  },
  {
    key: "LARGE_40_30_30",
    label: "Large project (40/30/30)",
    description: "For projects ₹3L+ — signing, milestone, completion",
    splits: [
      { label: "On signing (40%)", percent: 40 },
      { label: "Mid-project (30%)", percent: 30 },
      { label: "On completion (30%)", percent: 30 },
    ],
  },
  {
    key: "RETAINER_100",
    label: "Retainer (100% upfront)",
    description: "Full monthly retainer due on the 1st",
    splits: [{ label: "Monthly retainer (100%)", percent: 100 }],
  },
  {
    key: "CONSULTING_50_50",
    label: "Consulting (50/50)",
    description: "50% to start, 50% on report delivery",
    splits: [
      { label: "Engagement start (50%)", percent: 50 },
      { label: "On report delivery (50%)", percent: 50 },
    ],
  },
];

export function splitsFromTemplate(templateKey: string, totalAmount: number) {
  const template = MILESTONE_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return null;

  const splits = template.splits.map((split, index) => {
    const raw = (totalAmount * split.percent) / 100;
    const amount =
      index === template.splits.length - 1
        ? totalAmount -
          template.splits
            .slice(0, -1)
            .reduce((sum, s) => sum + Math.round((totalAmount * s.percent) / 100), 0)
        : Math.round(raw);
    return { label: split.label, amount, sortOrder: index };
  });

  return splits;
}
