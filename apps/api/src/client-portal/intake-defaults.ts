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
    legalName: '',
    brandName: '',
    industry: '',
    gstin: '',
    pan: '',
    address: '',
    websiteSocials: '',
  },
  primaryContact: { name: '', designation: '', phone: '', email: '' },
  billingContact: { name: '', email: '', address: '', preferredPaymentMode: '' },
  decisionMakers: [
    { name: '', role: '', approvalArea: '' },
    { name: '', role: '', approvalArea: '' },
  ],
  waysOfWorking: {
    preferredChannel: '',
    reportingCadence: '',
    workingHours: '',
    notes: '',
  },
};

export const DEFAULT_BRAND_INTAKE: BrandIntake = {
  assets: [
    { asset: 'Logo files (SVG / PNG / AI)', provided: '', link: '' },
    { asset: 'Brand guidelines', provided: '', link: '' },
    { asset: 'Brand fonts', provided: '', link: '' },
    { asset: 'Colour codes (HEX)', provided: '', link: '' },
    { asset: 'Product / project photos', provided: '', link: '' },
    { asset: 'Existing videos / reels', provided: '', link: '' },
    { asset: 'Past collateral', provided: '', link: '' },
    { asset: 'Testimonials / reviews', provided: '', link: '' },
  ],
  brandVoice: { tone: '', standsFor: '', audience: '', competitors: '' },
  dosDonts: [
    { do: '', dont: '' },
    { do: '', dont: '' },
    { do: '', dont: '' },
  ],
  delivery: { sharedDriveLink: '', contactForAssets: '' },
};

export const DEFAULT_ACCESS_INTAKE: AccessIntake = {
  platforms: [
    { platform: 'Website / CMS', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Instagram', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Facebook Page', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Meta Business Suite', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'YouTube', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'LinkedIn', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Google Business', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Google Ads', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Meta Ads Manager', handle: '', accessLevel: '', grantedTo: '', status: '' },
    { platform: 'Analytics / GA4', handle: '', accessLevel: '', grantedTo: '', status: '' },
  ],
  notes: { passwordManager: '', revokeDate: '' },
};

export type IntakeSection = 'onboarding' | 'brand' | 'access';

export function mergeIntake<T extends object>(defaults: T, saved: unknown): T {
  if (!saved || typeof saved !== 'object') return defaults;
  return { ...defaults, ...(saved as T) };
}
