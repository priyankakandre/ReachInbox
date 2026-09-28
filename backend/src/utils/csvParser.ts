export function parseLeads(rawContent: string): string[] {
  if (!rawContent || !rawContent.trim()) {
    return [];
  }

  // Regex to match valid email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = rawContent.match(emailRegex) || [];

  // Deduplicate and normalize to lowercase
  const uniqueEmails = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  return uniqueEmails;
}
