/**
 * Shared heuristic: does a query read like a company DESCRIPTION
 * ("we're a 2,000-employee health system in the Midwest") rather than a
 * directory KEYWORD search ("athletic director", "oil & gas Canada")?
 *
 * Description-style intent belongs in the Survey Advisor (which reasons
 * about a recommended stack, budget, and coverage), not the keyword
 * search index — feeding a self-description to literal/semantic search
 * yields weak results. Both the homepage submit router and the search
 * dropdown import THIS function so they never disagree about where a
 * given query should go.
 */
export function looksLikeAdvisorQuery(q: string): boolean {
  const trimmed = q.trim();
  // Short queries are almost always keyword lookups ("cfo", "nurses").
  if (trimmed.length < 30) return false;
  const lower = trimmed.toLowerCase();
  const signals = [
    // First-person framing of a company/self.
    /\bwe('?re| are| have| need)\b/,
    /\bi('?m| am| have| need)\b/,
    /\b(looking for|need data|need salary|need comp)\b/,
    // A headcount figure ("1,200 employees", "500 FTEs").
    /\b\d{2,5}[\s-]*(employees?|people|headcount|fte|ftes)\b/,
    // An organization noun described by location/attributes.
    /\b(company|organization|firm|business|system|hospital|health\s*system|manufacturer|retailer|nonprofit|non-profit|startup|agency|institution)\b.*\b(in|that|with|based|headquartered)\b/,
    /\b(industry|sector)\b.*\b(in|for)\b/,
  ];
  return signals.some((re) => re.test(lower));
}
