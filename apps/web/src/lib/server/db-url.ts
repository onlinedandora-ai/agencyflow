/** Strip quotes / accidental `KEY=url` pastes from dashboard env values. */
export function cleanDbUrl(value: string | undefined): string | undefined {
  if (value == null) return value;
  let v = value.trim().replace(/[\u201C\u201D\u2018\u2019]/g, '"');
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  const eq = v.indexOf("=");
  if (eq > 0 && /database_url|direct_url/i.test(v.slice(0, eq))) {
    const maybe = v.slice(eq + 1).trim();
    if (/^postgres(ql)?:\/\//i.test(maybe)) v = maybe;
  }
  return v;
}

export function applyCleanedDbEnv() {
  const url = cleanDbUrl(process.env.DATABASE_URL);
  const directUrl = cleanDbUrl(process.env.DIRECT_URL);
  if (url) process.env.DATABASE_URL = url;
  if (directUrl) process.env.DIRECT_URL = directUrl;
  return { url, directUrl };
}
