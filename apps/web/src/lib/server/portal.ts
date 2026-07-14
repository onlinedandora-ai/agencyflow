import { z } from "zod";
import { getBillingPortal } from "@/lib/server/invoices";
import { getRazorpayPublicConfig } from "@/lib/server/payments";
import { prisma } from "@/lib/server/prisma";

export const INTAKE_SECTIONS = ["onboarding", "brand", "access"] as const;
export type IntakeSection = (typeof INTAKE_SECTIONS)[number];

export type OnboardingIntake = {
  company: {
    legalName: string;
    brandName: string;
    industry: string;
    gstin: string;
    pan: string;
    address: string;
    websiteSocials: string;
  };
  primaryContact: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };
  billingContact: {
    name: string;
    email: string;
    address: string;
    preferredPaymentMode: string;
  };
  decisionMakers: Array<{ name: string; role: string; approvalArea: string }>;
  waysOfWorking: {
    preferredChannel: string;
    reportingCadence: string;
    workingHours: string;
    notes: string;
  };
};

export type BrandIntake = {
  assets: Array<{ asset: string; provided: string; link: string }>;
  brandVoice: {
    tone: string;
    standsFor: string;
    audience: string;
    competitors: string;
  };
  dosDonts: Array<{ do: string; dont: string }>;
  delivery: {
    sharedDriveLink: string;
    contactForAssets: string;
  };
};

export type AccessIntake = {
  platforms: Array<{
    platform: string;
    handle: string;
    accessLevel: string;
    grantedTo: string;
    status: string;
  }>;
  notes: {
    passwordManager: string;
    revokeDate: string;
  };
};

export const DEFAULT_ONBOARDING_INTAKE: OnboardingIntake = {
  company: {
    legalName: "",
    brandName: "",
    industry: "",
    gstin: "",
    pan: "",
    address: "",
    websiteSocials: "",
  },
  primaryContact: { name: "", designation: "", phone: "", email: "" },
  billingContact: { name: "", email: "", address: "", preferredPaymentMode: "" },
  decisionMakers: [
    { name: "", role: "", approvalArea: "" },
    { name: "", role: "", approvalArea: "" },
  ],
  waysOfWorking: {
    preferredChannel: "",
    reportingCadence: "",
    workingHours: "",
    notes: "",
  },
};

export const DEFAULT_BRAND_INTAKE: BrandIntake = {
  assets: [
    { asset: "Logo files (SVG / PNG / AI)", provided: "", link: "" },
    { asset: "Brand guidelines", provided: "", link: "" },
    { asset: "Brand fonts", provided: "", link: "" },
    { asset: "Colour codes (HEX)", provided: "", link: "" },
    { asset: "Product / project photos", provided: "", link: "" },
    { asset: "Existing videos / reels", provided: "", link: "" },
    { asset: "Past collateral", provided: "", link: "" },
    { asset: "Testimonials / reviews", provided: "", link: "" },
  ],
  brandVoice: { tone: "", standsFor: "", audience: "", competitors: "" },
  dosDonts: [
    { do: "", dont: "" },
    { do: "", dont: "" },
    { do: "", dont: "" },
  ],
  delivery: { sharedDriveLink: "", contactForAssets: "" },
};

export const DEFAULT_ACCESS_INTAKE: AccessIntake = {
  platforms: [
    { platform: "Website / CMS", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Instagram", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Facebook Page", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Meta Business Suite", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "YouTube", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "LinkedIn", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Google Business", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Google Ads", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Meta Ads Manager", handle: "", accessLevel: "", grantedTo: "", status: "" },
    { platform: "Analytics / GA4", handle: "", accessLevel: "", grantedTo: "", status: "" },
  ],
  notes: { passwordManager: "", revokeDate: "" },
};

export function mergeIntake<T extends object>(defaults: T, saved: unknown): T {
  if (!saved || typeof saved !== "object") return defaults;
  return { ...defaults, ...(saved as T) };
}

export class PortalHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const saveIntakeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export function parseIntakeSection(section: string): IntakeSection {
  if (!INTAKE_SECTIONS.includes(section as IntakeSection)) {
    throw new PortalHttpError("Invalid intake section", 400);
  }
  return section as IntakeSection;
}

async function workspaceByToken(token: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { billingToken: token },
  });
  if (!workspace) {
    throw new PortalHttpError("Client portal link not found", 404);
  }
  return workspace;
}

export async function getPortal(token: string) {
  const workspace = await workspaceByToken(token);
  const billing = await getBillingPortal(token);

  const claims = await prisma.paymentClaim.findMany({
    where: {
      invoice: { workspaceId: workspace.id },
    },
    include: {
      invoice: { select: { number: true } },
      milestone: { select: { label: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const payableInvoices = billing.taxInvoice
    ? [
        {
          id: billing.taxInvoice.id,
          number: billing.taxInvoice.number,
          amountDue:
            billing.taxInvoice.amountDue ?? Number(billing.taxInvoice.amount),
          status: billing.taxInvoice.status,
          milestones: billing.milestones.filter((m) => m.status === "PENDING"),
        },
      ]
    : [];

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      company: workspace.company,
      billingFlow: workspace.billingFlow,
    },
    agency: billing.agency,
    intake: {
      onboarding: mergeIntake(DEFAULT_ONBOARDING_INTAKE, workspace.onboardingIntake),
      brand: mergeIntake(DEFAULT_BRAND_INTAKE, workspace.brandIntake),
      access: mergeIntake(DEFAULT_ACCESS_INTAKE, workspace.accessIntake),
      submitted: {
        onboarding: !!workspace.onboardingIntakeAt,
        brand: !!workspace.brandIntakeAt,
        access: !!workspace.accessIntakeAt,
      },
      submittedAt: {
        onboarding: workspace.onboardingIntakeAt,
        brand: workspace.brandIntakeAt,
        access: workspace.accessIntakeAt,
      },
    },
    billing,
    payableInvoices,
    razorpay: getRazorpayPublicConfig(),
    paymentClaims: claims.map((c) => ({
      id: c.id,
      invoiceNumber: c.invoice.number,
      milestoneLabel: c.milestone?.label ?? null,
      amount: Number(c.amount),
      paymentMode: c.paymentMode,
      paymentReference: c.paymentReference,
      status: c.status,
      submittedAt: c.submittedAt,
      submittedByName: c.submittedByName,
      reviewNote: c.reviewNote,
    })),
    steps: [
      {
        key: "onboarding",
        label: "Client onboarding",
        done: !!workspace.onboardingIntakeAt,
      },
      { key: "brand", label: "Brand & assets", done: !!workspace.brandIntakeAt },
      { key: "access", label: "Access & social", done: !!workspace.accessIntakeAt },
      {
        key: "billing",
        label: "Billing & payment",
        done: billing.taxInvoice?.status === "PAID",
      },
    ],
  };
}

export async function saveIntake(
  token: string,
  section: IntakeSection,
  data: Record<string, unknown>,
) {
  const workspace = await workspaceByToken(token);
  const fieldMap = {
    onboarding: "onboardingIntake" as const,
    brand: "brandIntake" as const,
    access: "accessIntake" as const,
  };

  return prisma.clientWorkspace.update({
    where: { id: workspace.id },
    data: { [fieldMap[section]]: data },
  });
}

export async function submitIntake(
  token: string,
  section: IntakeSection,
  data: Record<string, unknown>,
) {
  const workspace = await workspaceByToken(token);
  const atFieldMap = {
    onboarding: "onboardingIntakeAt" as const,
    brand: "brandIntakeAt" as const,
    access: "accessIntakeAt" as const,
  };
  const dataFieldMap = {
    onboarding: "onboardingIntake" as const,
    brand: "brandIntake" as const,
    access: "accessIntake" as const,
  };

  const updated = await prisma.clientWorkspace.update({
    where: { id: workspace.id },
    data: {
      [dataFieldMap[section]]: data,
      [atFieldMap[section]]: new Date(),
    },
  });

  return {
    message: `${section} intake submitted`,
    submittedAt: updated[atFieldMap[section]],
  };
}

export function handlePortalError(error: unknown) {
  if (error instanceof PortalHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
