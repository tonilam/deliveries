/** Mirrors apps/api CompanyDomainService normalization for preview/confirm. */

export function normalizeRegNumber(regNumber: string): string {
  return regNumber.trim().replace(/\s+/g, '');
}

export function normalizeBusinessName(businessName: string): string {
  return businessName.trim().replace(/\s+/g, ' ');
}

export function normalizeDomains(domains: string[]): string[] {
  const normalized = domains
    .map((domain) => domain.trim().toLowerCase().replace(/^@+/, '').replace(/\.+$/, ''))
    .filter(Boolean);

  return [...new Set(normalized)];
}
