/**
 * Canonical job family aliases.
 *
 * Maps raw family strings (as they appear in vendor XLSX/product pages) to a
 * single canonical family name. When the loader encounters a family string,
 * it looks it up here; unmatched strings become new canonical entries and
 * print a warning, so the user can collapse them by adding an entry below.
 *
 * Keys are lowercased normalized strings (no punctuation, collapsed spaces).
 * Values are the canonical display name.
 */

export const FAMILY_ALIASES: Record<string, string> = {
  // Engineering
  "engineering": "Engineering",
  "engineering science": "Engineering",
  "engineering and science": "Engineering",
  "engineering technology": "Engineering",
  "engineering and technology": "Engineering",
  "architecture engineering": "Engineering",
  "engineering rnd": "Engineering",
  "rnd": "R&D",
  "research and development": "R&D",

  // Finance & Accounting
  "finance": "Finance",
  "accounting finance": "Finance",
  "accounting and finance": "Finance",
  "finance accounting": "Finance",
  "accounting": "Accounting",
  "tax": "Tax",
  "treasury": "Treasury",
  "audit": "Audit",
  "financial planning analysis": "Finance",
  "fpa": "Finance",

  // HR
  "human resources": "Human Resources",
  "hr": "Human Resources",
  "people operations": "Human Resources",
  "people and culture": "Human Resources",
  "talent acquisition": "Talent Acquisition",
  "total rewards": "Total Rewards",
  "compensation benefits": "Total Rewards",

  // IT
  "information technology": "Information Technology",
  "it": "Information Technology",
  "technology": "Information Technology",
  "tech": "Information Technology",
  "software engineering": "Software Engineering",
  "hardware engineering": "Hardware Engineering",
  "data science": "Data Science",
  "data analytics": "Data Science",
  "analytics": "Data Science",
  "product management": "Product Management",
  "design": "Design",
  "ux design": "Design",
  "user experience": "Design",
  "devops": "DevOps",

  // Sales / Marketing
  "sales": "Sales",
  "sales marketing": "Sales & Marketing",
  "sales and marketing": "Sales & Marketing",
  "marketing": "Marketing",
  "sales marketing product management": "Sales & Marketing",
  "business development": "Business Development",
  "customer success": "Customer Success",

  // Operations / Supply Chain
  "operations": "Operations",
  "supply chain": "Supply Chain",
  "logistics": "Supply Chain",
  "procurement": "Procurement",
  "manufacturing": "Manufacturing",
  "production skilled trades": "Production & Skilled Trades",
  "production and skilled trades": "Production & Skilled Trades",
  "quality management": "Quality",
  "quality": "Quality",
  "quality assurance": "Quality",

  // Legal / Compliance
  "legal": "Legal",
  "compliance": "Compliance",
  "legal compliance": "Legal & Compliance",
  "legal and compliance": "Legal & Compliance",
  "risk management": "Risk Management",

  // Industry-specific roles
  "drilling exploration operations": "Drilling & Oilfield Operations",
  "drilling exploration and operations": "Drilling & Oilfield Operations",
  "refining operations": "Refining Operations",
  "retail": "Retail",
  "retail store management": "Retail",
  "transportation services": "Transportation",
  "healthcare pharmacy": "Healthcare",
  "healthcare": "Healthcare",
  "clinical": "Clinical",
  "regulatory": "Regulatory",

  // Administrative
  "administration facilities secretarial": "Administrative",
  "administration and secretarial": "Administrative",
  "administrative": "Administrative",
  "facilities": "Facilities",
  "secretarial": "Administrative",

  // Executive / Project
  "executive": "Executive",
  "project management": "Project & Program Management",
  "project program management": "Project & Program Management",
  "program management": "Project & Program Management",

  // Communications / Corporate Affairs
  "communications": "Communications",
  "corporate communications": "Communications",
  "public relations": "Communications",
  "corporate affairs": "Corporate Affairs",

  // Education / Research
  "academic affairs": "Academic Affairs",
  "research administration": "Research Administration",
  "library": "Library",
};

export function canonicalizeFamily(raw: string): string {
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .replace(/[&/\\,.:;()\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (FAMILY_ALIASES[normalized]) return FAMILY_ALIASES[normalized];
  // Not in map — keep the original casing as a new canonical entry
  return raw.trim();
}

export function normalizeFamilyKey(canonical: string): string {
  return canonical
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
