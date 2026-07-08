"use client";

import { Input } from "@/components/ui/input";
import type { AccessIntake, BrandIntake, OnboardingIntake } from "@/lib/api";

function FieldRow({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-white/50 bg-white/60 px-3 py-2 text-sm backdrop-blur-md"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function OnboardingIntakeForm({
  data,
  onChange,
}: {
  data: OnboardingIntake;
  onChange: (d: OnboardingIntake) => void;
}) {
  const setCompany = (key: keyof OnboardingIntake["company"], v: string) =>
    onChange({ ...data, company: { ...data.company, [key]: v } });
  const setPrimary = (key: keyof OnboardingIntake["primaryContact"], v: string) =>
    onChange({ ...data, primaryContact: { ...data.primaryContact, [key]: v } });
  const setBilling = (key: keyof OnboardingIntake["billingContact"], v: string) =>
    onChange({ ...data, billingContact: { ...data.billingContact, [key]: v } });
  const setWays = (key: keyof OnboardingIntake["waysOfWorking"], v: string) =>
    onChange({ ...data, waysOfWorking: { ...data.waysOfWorking, [key]: v } });

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Company details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Legal entity name" value={data.company.legalName} onChange={(v) => setCompany("legalName", v)} />
          <FieldRow label="Brand / trade name" value={data.company.brandName} onChange={(v) => setCompany("brandName", v)} />
          <FieldRow label="Industry / sector" value={data.company.industry} onChange={(v) => setCompany("industry", v)} />
          <FieldRow label="GSTIN" value={data.company.gstin} onChange={(v) => setCompany("gstin", v)} />
          <FieldRow label="PAN" value={data.company.pan} onChange={(v) => setCompany("pan", v)} />
          <FieldRow label="Website / social links" value={data.company.websiteSocials} onChange={(v) => setCompany("websiteSocials", v)} />
          <div className="sm:col-span-2">
            <FieldRow label="Registered address" value={data.company.address} onChange={(v) => setCompany("address", v)} multiline />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Primary contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Name" value={data.primaryContact.name} onChange={(v) => setPrimary("name", v)} />
          <FieldRow label="Designation" value={data.primaryContact.designation} onChange={(v) => setPrimary("designation", v)} />
          <FieldRow label="Phone / WhatsApp" value={data.primaryContact.phone} onChange={(v) => setPrimary("phone", v)} />
          <FieldRow label="Email" value={data.primaryContact.email} onChange={(v) => setPrimary("email", v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Billing contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Name" value={data.billingContact.name} onChange={(v) => setBilling("name", v)} />
          <FieldRow label="Email" value={data.billingContact.email} onChange={(v) => setBilling("email", v)} />
          <FieldRow label="Preferred payment mode" value={data.billingContact.preferredPaymentMode} onChange={(v) => setBilling("preferredPaymentMode", v)} />
          <div className="sm:col-span-2">
            <FieldRow label="Billing address" value={data.billingContact.address} onChange={(v) => setBilling("address", v)} multiline />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Decision makers & approvals</h3>
        <div className="space-y-3">
          {data.decisionMakers.map((dm, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-white/50 bg-white/40 p-3 sm:grid-cols-3">
              <Input placeholder="Name" value={dm.name} onChange={(e) => {
                const next = [...data.decisionMakers];
                next[i] = { ...dm, name: e.target.value };
                onChange({ ...data, decisionMakers: next });
              }} />
              <Input placeholder="Role" value={dm.role} onChange={(e) => {
                const next = [...data.decisionMakers];
                next[i] = { ...dm, role: e.target.value };
                onChange({ ...data, decisionMakers: next });
              }} />
              <Input placeholder="Approval area" value={dm.approvalArea} onChange={(e) => {
                const next = [...data.decisionMakers];
                next[i] = { ...dm, approvalArea: e.target.value };
                onChange({ ...data, decisionMakers: next });
              }} />
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => onChange({ ...data, decisionMakers: [...data.decisionMakers, { name: "", role: "", approvalArea: "" }] })}
          >
            + Add decision maker
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Ways of working</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Preferred channel" value={data.waysOfWorking.preferredChannel} onChange={(v) => setWays("preferredChannel", v)} />
          <FieldRow label="Reporting cadence" value={data.waysOfWorking.reportingCadence} onChange={(v) => setWays("reportingCadence", v)} />
          <FieldRow label="Working hours / time zone" value={data.waysOfWorking.workingHours} onChange={(v) => setWays("workingHours", v)} />
          <div className="sm:col-span-2">
            <FieldRow label="Notes" value={data.waysOfWorking.notes} onChange={(v) => setWays("notes", v)} multiline />
          </div>
        </div>
      </section>
    </div>
  );
}

export function BrandIntakeForm({
  data,
  onChange,
}: {
  data: BrandIntake;
  onChange: (d: BrandIntake) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Asset checklist</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Share links to your logo files, brand guidelines, photos, and other assets (Google Drive, Dropbox, etc.).
        </p>
        <div className="space-y-3">
          {data.assets.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-white/50 bg-white/40 p-3 sm:grid-cols-[1fr_80px_1fr]">
              <Input value={row.asset} onChange={(e) => {
                const assets = [...data.assets];
                assets[i] = { ...row, asset: e.target.value };
                onChange({ ...data, assets });
              }} />
              <Input placeholder="Y/N" value={row.provided} onChange={(e) => {
                const assets = [...data.assets];
                assets[i] = { ...row, provided: e.target.value };
                onChange({ ...data, assets });
              }} />
              <Input placeholder="Link / location" value={row.link} onChange={(e) => {
                const assets = [...data.assets];
                assets[i] = { ...row, link: e.target.value };
                onChange({ ...data, assets });
              }} />
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-primary" onClick={() => onChange({ ...data, assets: [...data.assets, { asset: "", provided: "", link: "" }] })}>
            + Add asset row
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Brand voice</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Tone of voice (3 words)" value={data.brandVoice.tone} onChange={(v) => onChange({ ...data, brandVoice: { ...data.brandVoice, tone: v } })} />
          <FieldRow label="What the brand stands for" value={data.brandVoice.standsFor} onChange={(v) => onChange({ ...data, brandVoice: { ...data.brandVoice, standsFor: v } })} />
          <FieldRow label="Audience we are speaking to" value={data.brandVoice.audience} onChange={(v) => onChange({ ...data, brandVoice: { ...data.brandVoice, audience: v } })} />
          <FieldRow label="Key competitors" value={data.brandVoice.competitors} onChange={(v) => onChange({ ...data, brandVoice: { ...data.brandVoice, competitors: v } })} />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Do&apos;s &amp; Don&apos;ts</h3>
        {data.dosDonts.map((row, i) => (
          <div key={i} className="mb-3 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Always (Do)" value={row.do} onChange={(e) => {
              const dosDonts = [...data.dosDonts];
              dosDonts[i] = { ...row, do: e.target.value };
              onChange({ ...data, dosDonts });
            }} />
            <Input placeholder="Never (Don't)" value={row.dont} onChange={(e) => {
              const dosDonts = [...data.dosDonts];
              dosDonts[i] = { ...row, dont: e.target.value };
              onChange({ ...data, dosDonts });
            }} />
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Asset delivery</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Shared drive / folder link" value={data.delivery.sharedDriveLink} onChange={(v) => onChange({ ...data, delivery: { ...data.delivery, sharedDriveLink: v } })} />
          <FieldRow label="Who to contact for assets" value={data.delivery.contactForAssets} onChange={(v) => onChange({ ...data, delivery: { ...data.delivery, contactForAssets: v } })} />
        </div>
        <p className="mt-3 rounded-lg border-l-4 border-cyan-400 bg-cyan-50/50 px-3 py-2 text-xs text-muted-foreground">
          Do not share account passwords here — use the Access &amp; Social tab for platform handles only.
        </p>
      </section>
    </div>
  );
}

export function AccessIntakeForm({
  data,
  onChange,
}: {
  data: AccessIntake;
  onChange: (d: AccessIntake) => void;
}) {
  return (
    <div className="space-y-8">
      <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50/50 px-3 py-2 text-sm text-amber-900">
        Security: never store raw passwords. Share credentials via a password manager and record only access status below.
      </p>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Platform access &amp; social handles</h3>
        <div className="space-y-3">
          {data.platforms.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-white/50 bg-white/40 p-3 sm:grid-cols-5">
              <Input value={row.platform} onChange={(e) => {
                const platforms = [...data.platforms];
                platforms[i] = { ...row, platform: e.target.value };
                onChange({ ...data, platforms });
              }} />
              <Input placeholder="Handle / URL" value={row.handle} onChange={(e) => {
                const platforms = [...data.platforms];
                platforms[i] = { ...row, handle: e.target.value };
                onChange({ ...data, platforms });
              }} />
              <Input placeholder="Access level" value={row.accessLevel} onChange={(e) => {
                const platforms = [...data.platforms];
                platforms[i] = { ...row, accessLevel: e.target.value };
                onChange({ ...data, platforms });
              }} />
              <Input placeholder="Granted to" value={row.grantedTo} onChange={(e) => {
                const platforms = [...data.platforms];
                platforms[i] = { ...row, grantedTo: e.target.value };
                onChange({ ...data, platforms });
              }} />
              <Input placeholder="Status" value={row.status} onChange={(e) => {
                const platforms = [...data.platforms];
                platforms[i] = { ...row, status: e.target.value };
                onChange({ ...data, platforms });
              }} />
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-primary" onClick={() => onChange({ ...data, platforms: [...data.platforms, { platform: "", handle: "", accessLevel: "", grantedTo: "", status: "" }] })}>
            + Add platform
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Notes</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Password manager / vault used" value={data.notes.passwordManager} onChange={(v) => onChange({ ...data, notes: { ...data.notes, passwordManager: v } })} />
          <FieldRow label="Access revoked on offboarding (date)" value={data.notes.revokeDate} onChange={(v) => onChange({ ...data, notes: { ...data.notes, revokeDate: v } })} />
        </div>
      </section>
    </div>
  );
}
