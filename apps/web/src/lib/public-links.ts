/** Prefer live browser origin so copy-link never sticks to localhost from server env. */
export function buildPublicProposalUrl(publicToken: string | null | undefined): string {
  if (!publicToken) return "";
  if (typeof window !== "undefined") {
    return `${window.location.origin}/p/${publicToken}`;
  }
  return `/p/${publicToken}`;
}
