import { DEFAULT_AGENCY_PROFILE } from "@/lib/server/agency-defaults";
import { prisma } from "@/lib/server/prisma";
import {
  DEFAULT_WORKFLOW_SETTINGS,
  type WorkflowSettings,
} from "@/lib/server/workflow-defaults";

export type UpdateAgencyProfileInput = {
  name?: string;
  tagline?: string;
  address?: string;
  city?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstin?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  defaultTermsAndConditions?: string;
};

export type UpdateWorkflowSettingsInput = Partial<WorkflowSettings>;

export async function getAgencyProfile() {
  const profile = await prisma.agencyProfile.findUnique({ where: { id: "default" } });
  if (profile) return profile;

  return prisma.agencyProfile.create({
    data: { id: "default", ...DEFAULT_AGENCY_PROFILE },
  });
}

export async function updateAgencyProfile(dto: UpdateAgencyProfileInput) {
  await getAgencyProfile();
  return prisma.agencyProfile.update({
    where: { id: "default" },
    data: dto,
  });
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
  const profile = await getAgencyProfile();
  return {
    ...DEFAULT_WORKFLOW_SETTINGS,
    ...(profile.workflowSettings as WorkflowSettings | null),
  };
}

export async function updateWorkflowSettings(dto: UpdateWorkflowSettingsInput) {
  const current = await getWorkflowSettings();
  const next = { ...current, ...dto };
  await getAgencyProfile();
  await prisma.agencyProfile.update({
    where: { id: "default" },
    data: { workflowSettings: next },
  });
  return next;
}
