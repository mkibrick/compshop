import { getDb, initDb } from "./db";
import { Report, Position, Org } from "./types";

initDb();

interface ReportRow {
  id: number;
  survey_id: number;
  slug: string;
  title: string;
  url: string;
  sku: string;
  description: string;
  edition: string;
  publication_date: string;
  participation_deadline: string;
  geographic_scope: string;
  countries_regions: string;
  num_positions: number;
  num_position_families: number;
  num_orgs: number;
  num_incumbents: string;
  includes_base: number;
  includes_sti: number;
  includes_lti: number;
  includes_benefits: number;
  price_range: string;
  notes: string;
  survey_slug: string;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    surveySlug: row.survey_slug,
    slug: row.slug,
    title: row.title,
    url: row.url,
    sku: row.sku,
    description: row.description,
    edition: row.edition,
    publicationDate: row.publication_date,
    participationDeadline: row.participation_deadline,
    geographicScope: row.geographic_scope,
    countriesRegions: row.countries_regions,
    numPositions: row.num_positions,
    numPositionFamilies: row.num_position_families,
    numOrgs: row.num_orgs,
    numIncumbents: row.num_incumbents,
    includesBase: !!row.includes_base,
    includesSti: !!row.includes_sti,
    includesLti: !!row.includes_lti,
    includesBenefits: !!row.includes_benefits,
    priceRange: row.price_range,
    notes: row.notes,
  };
}

const REPORT_JOIN_SQL = `
  SELECT r.*, s.slug AS survey_slug
  FROM reports r
  JOIN surveys s ON s.id = r.survey_id
`;

export function getAllReports(): Report[] {
  const db = getDb();
  const rows = db.prepare(REPORT_JOIN_SQL + " ORDER BY r.title").all() as ReportRow[];
  return rows.map(rowToReport);
}

export function getReportBySlug(slug: string): Report | undefined {
  const db = getDb();
  const row = db
    .prepare(REPORT_JOIN_SQL + " WHERE r.slug = ?")
    .get(slug) as ReportRow | undefined;
  return row ? rowToReport(row) : undefined;
}

export function getReportsForSurveySlug(surveySlug: string): Report[] {
  const db = getDb();
  const rows = db
    .prepare(REPORT_JOIN_SQL + " WHERE s.slug = ? ORDER BY r.title")
    .all(surveySlug) as ReportRow[];
  return rows.map(rowToReport);
}

export function getPositionsForReport(reportId: number): Position[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.slug, p.canonical_title AS canonicalTitle, p.description
       FROM positions p
       JOIN report_positions rp ON rp.position_id = p.id
       WHERE rp.report_id = ?
       GROUP BY p.id
       ORDER BY p.canonical_title`
    )
    .all(reportId) as Position[];
  return rows;
}

export function getOrgsForReport(reportId: number): Org[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.id, o.slug, o.name
       FROM orgs o
       JOIN report_orgs ro ON ro.org_id = o.id
       WHERE ro.report_id = ?
       ORDER BY o.name`
    )
    .all(reportId) as Org[];
  return rows;
}

export function getFamiliesForReport(reportId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT f.id, f.slug, f.canonical_name AS canonicalName
       FROM job_families f
       JOIN report_families rf ON rf.family_id = f.id
       WHERE rf.report_id = ?
       ORDER BY f.canonical_name`
    )
    .all(reportId) as { id: number; slug: string; canonicalName: string }[];
}

// ---------- Positions ----------
export interface PositionDetail {
  id: number;
  slug: string;
  canonicalTitle: string;
  description: string;
}

export function getAllPositions(): PositionDetail[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, slug, canonical_title AS canonicalTitle, description
       FROM positions
       ORDER BY canonical_title`
    )
    .all() as PositionDetail[];
}

export function getPositionBySlug(slug: string): PositionDetail | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, slug, canonical_title AS canonicalTitle, description
       FROM positions WHERE slug = ?`
    )
    .get(slug) as PositionDetail | undefined;
}

export interface ReportWithVendor {
  slug: string;
  title: string;
  description: string;
  url: string;
  geographicScope: string;
  edition: string;
  vendorSlug: string;
  vendorProvider: string;
}

export function getReportsForPosition(positionId: number): ReportWithVendor[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.slug, r.title, r.description,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              r.geographic_scope AS geographicScope,
              r.edition,
              s.slug AS vendorSlug, s.provider AS vendorProvider
       FROM report_positions rp
       JOIN reports r ON r.id = rp.report_id
       JOIN surveys s ON s.id = r.survey_id
       WHERE rp.position_id = ?
       GROUP BY r.id
       ORDER BY s.provider, r.title`
    )
    .all(positionId) as ReportWithVendor[];
}

export function getFamiliesForPosition(positionId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT f.id, f.slug, f.canonical_name AS canonicalName
       FROM job_families f
       JOIN position_families pf ON pf.family_id = f.id
       WHERE pf.position_id = ?
       ORDER BY f.canonical_name`
    )
    .all(positionId) as { id: number; slug: string; canonicalName: string }[];
}

// ---------- Families ----------
export interface FamilyDetail {
  id: number;
  slug: string;
  canonicalName: string;
}

export function getAllFamilies(): FamilyDetail[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, slug, canonical_name AS canonicalName
       FROM job_families ORDER BY canonical_name`
    )
    .all() as FamilyDetail[];
}

export function getFamilyBySlug(slug: string): FamilyDetail | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, slug, canonical_name AS canonicalName
       FROM job_families WHERE slug = ?`
    )
    .get(slug) as FamilyDetail | undefined;
}

export function getReportsForFamily(familyId: number): ReportWithVendor[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.slug, r.title, r.description,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              r.geographic_scope AS geographicScope,
              r.edition,
              s.slug AS vendorSlug, s.provider AS vendorProvider
       FROM report_families rf
       JOIN reports r ON r.id = rf.report_id
       JOIN surveys s ON s.id = r.survey_id
       WHERE rf.family_id = ?
       GROUP BY r.id
       ORDER BY s.provider, r.title`
    )
    .all(familyId) as ReportWithVendor[];
}

export function getPositionsForFamily(familyId: number): PositionDetail[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.id, p.slug, p.canonical_title AS canonicalTitle, p.description
       FROM positions p
       JOIN position_families pf ON pf.position_id = p.id
       WHERE pf.family_id = ?
       ORDER BY p.canonical_title`
    )
    .all(familyId) as PositionDetail[];
}

export function getVendorsForFamily(familyId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT s.slug, s.provider, COUNT(DISTINCT r.id) AS reportCount
       FROM surveys s
       JOIN reports r ON r.survey_id = s.id
       JOIN report_families rf ON rf.report_id = r.id
       WHERE rf.family_id = ?
       GROUP BY s.id
       ORDER BY reportCount DESC, s.provider`
    )
    .all(familyId) as { slug: string; provider: string; reportCount: number }[];
}
