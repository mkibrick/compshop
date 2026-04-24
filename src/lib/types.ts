export interface Survey {
  provider: string;
  title: string;
  slug: string;
  url: string;
  edition: string;
  priceRange: string;
  pricingModel: string;
  participationDiscount: string;
  participationRequired: string;
  participationDeadline: string;
  submissionFormat: string;
  numBenchmarks: string;
  numJobFamilies: string;
  jobFamilies: string;
  jobLevels: string;
  numOrgs: string;
  numIncumbents: string;
  orgSizeRange: string;
  geographicScope: string;
  countriesRegions: string;
  metroCuts: string;
  industryFocus: string;
  industryCuts: string;
  deliveryFormat: string;
  updateFrequency: string;
  dataLag: string;
  includesBase: boolean;
  includesBonus: boolean;
  includesEquity: boolean;
  includesBenefits: boolean;
  includesPayPractices: boolean;
  includesExecutive: boolean;
  bestFor: string;
  notes: string;
  category: string[];
}

export interface Report {
  id: number;
  surveySlug: string;
  slug: string;
  title: string;
  url: string;
  sku: string;
  description: string;
  edition: string;
  publicationDate: string;
  participationDeadline: string;
  geographicScope: string;
  countriesRegions: string;
  numPositions: number;
  numPositionFamilies: number;
  numOrgs: number;
  numIncumbents: string;
  includesBase: boolean;
  includesSti: boolean;
  includesLti: boolean;
  includesBenefits: boolean;
  priceRange: string;
  notes: string;
}

export interface Position {
  id: number;
  slug: string;
  canonicalTitle: string;
  description: string;
  reportCount?: number;
}

export interface Org {
  id: number;
  slug: string;
  name: string;
  reportCount?: number;
}

export interface JobFamily {
  id: number;
  slug: string;
  canonicalName: string;
  reportCount?: number;
  positionCount?: number;
}

export interface LinkedReport {
  slug: string;
  title: string;
  url: string;
  vendorProvider: string;
  geographicScope: string;
}

export interface SearchResults {
  vendors: { slug: string; title: string; provider: string; industry: string; url: string; regions?: string[] }[];
  reports: { slug: string; title: string; vendorSlug: string; vendorProvider: string; url: string }[];
  positions: { slug: string; canonicalTitle: string; reportCount: number; reports: LinkedReport[] }[];
  orgs: { slug: string; name: string; reportCount: number; reports: LinkedReport[] }[];
  families: { slug: string; canonicalName: string; reportCount: number; positionCount: number; reports: LinkedReport[] }[];
}
