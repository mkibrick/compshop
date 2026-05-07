/**
 * Compensation glossary. Each term is its own SEO entry-door — comp
 * pros search definitional questions ("what is compa-ratio") constantly,
 * and dedicated pages targeting those queries are some of the highest-
 * leverage long-tail SEO content a comp directory can publish.
 *
 * Add new terms by appending to TERMS. The /glossary index and
 * /glossary/[slug] detail pages pick them up automatically.
 *
 * `definition` supports the same tiny markdown subset as blog posts
 * (paragraphs, ## h2, ### h3, - bullets, **bold**, [links](/url)).
 *
 * `seeAlso` should reference other slugs in this file so cross-links
 * resolve cleanly.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Alternate names searched / used interchangeably ("comp ratio", "compa"). */
  aliases?: string[];
  /** Grouping bucket on the index page. */
  category:
    | "Pay Structure"
    | "Survey Methodology"
    | "Compensation Elements"
    | "Market & Strategy"
    | "Equity & Compliance"
    | "Increases & Changes";
  /** One-sentence definition; doubles as meta description. */
  oneliner: string;
  /** Multi-paragraph markdown definition. */
  definition: string;
  /** Optional worked example. */
  example?: string;
  /** Related term slugs from this file. */
  seeAlso?: string[];
}

export const TERMS: GlossaryTerm[] = [
  // ----------------------------- Pay Structure -----------------------------
  {
    slug: "compa-ratio",
    term: "Compa-ratio",
    aliases: ["comp ratio", "compa", "compensation ratio"],
    category: "Pay Structure",
    oneliner:
      "An employee's pay divided by the midpoint of their pay range, expressed as a decimal or percentage.",
    definition: `Compa-ratio measures how an employee's salary compares to the midpoint of their assigned pay range. It's calculated as **base salary ÷ range midpoint** and is expressed either as a decimal (1.05) or a percentage (105%).

A compa-ratio of 1.00 means the employee is paid exactly at the market midpoint. Above 1.00 means they're paid above midpoint; below 1.00 means they're paid below. Most organizations aim for a department or company-wide average compa-ratio between 0.95 and 1.05, depending on their pay positioning strategy.

Compa-ratio is the most commonly cited compensation metric because it lets you compare pay across roles, departments, and grades on a normalized scale. It's how comp teams quickly spot pay-equity issues, identify red-circled employees (paid above max), and assess whether ranges are functioning as designed.`,
    example: `An accountant earns $72,000. Their pay grade has a midpoint of $75,000. Their compa-ratio is 72,000 ÷ 75,000 = 0.96 (or 96%).`,
    seeAlso: ["range-penetration", "range-midpoint", "pay-range", "pay-positioning"],
  },
  {
    slug: "range-penetration",
    term: "Range penetration",
    aliases: ["range pen", "salary range penetration"],
    category: "Pay Structure",
    oneliner:
      "Where an employee's pay sits within their range, from 0% (at the minimum) to 100% (at the maximum).",
    definition: `Range penetration measures an employee's position within their pay range as a percentage. It's calculated as **(salary − range minimum) ÷ (range maximum − range minimum)**.

A new hire might enter a range at 25% penetration (lower end). A tenured high performer might be at 80% penetration (upper end). 100% means they're at the range maximum and can't receive merit increases without a promotion or a range adjustment.

Range penetration is more granular than compa-ratio for tracking pay progression. It's especially useful for managers planning increases — moving an employee from 40% to 60% penetration is a clear story; moving them from a 0.95 to 1.05 compa-ratio is harder to interpret.`,
    example: `A range runs $60,000–$90,000 (spread of $30,000). An employee earning $72,000 has a range penetration of (72,000 − 60,000) ÷ 30,000 = 40%.`,
    seeAlso: ["compa-ratio", "range-spread", "pay-range", "pay-compression"],
  },
  {
    slug: "range-spread",
    term: "Range spread",
    aliases: ["range width", "spread", "salary range spread"],
    category: "Pay Structure",
    oneliner:
      "The percentage difference between a pay range's minimum and maximum.",
    definition: `Range spread (sometimes called range width) measures how wide a pay range is. It's calculated as **(maximum − minimum) ÷ minimum**, expressed as a percentage.

Typical spreads vary by job level:

- **Non-exempt / hourly roles**: 25–40% spread
- **Professional / individual contributor roles**: 40–50% spread
- **Management / professional roles**: 50% spread
- **Senior leadership / executive roles**: 60–70% or wider

Wider spreads give organizations more room to differentiate pay based on performance, tenure, and proficiency without forcing constant range adjustments. Narrower spreads keep pay tightly anchored to market but require more frequent structure updates.

New Jersey's pay transparency law caps posted ranges at 60% spread, so multi-state employers often default to that as their effective ceiling.`,
    example: `A range of $80,000–$120,000 has a spread of (120,000 − 80,000) ÷ 80,000 = 50%.`,
    seeAlso: ["pay-range", "range-midpoint", "salary-structure"],
  },
  {
    slug: "range-midpoint",
    term: "Range midpoint",
    aliases: ["midpoint", "midpoint salary"],
    category: "Pay Structure",
    oneliner:
      "The center of a pay range, typically anchored to the market median for the role.",
    definition: `The midpoint of a pay range is the reference point the entire range is built around. Most employers set the midpoint at the market median (50th percentile) for the role, then build the minimum and maximum around it using the desired range spread.

Midpoints serve two purposes:

1. **External anchor**: They're how you express your pay-positioning strategy. A "100% of market" midpoint means you're paying at market median for that role.
2. **Internal benchmark**: They drive compa-ratio calculations and compensation reporting.

Midpoints typically move 2–4% per year as the market shifts. Survey vendors publish "aged" midpoint data so HR teams can update their structures without re-doing benchmarking from scratch.`,
    seeAlso: ["compa-ratio", "pay-range", "aging-factor", "market-percentile"],
  },
  {
    slug: "pay-range",
    term: "Pay range",
    aliases: ["salary range", "compensation range"],
    category: "Pay Structure",
    oneliner:
      "The minimum-to-maximum pay band an employer assigns to a job or pay grade.",
    definition: `A pay range is the salary band an employer establishes for a job or group of jobs. Each range has a minimum, midpoint, and maximum. Employees in the same range can earn anywhere from the minimum (typically new hires or developing performers) to the maximum (typically tenured high performers).

Ranges are usually built from external market data (compensation surveys) and adjusted for the employer's pay-positioning strategy. They're the foundation of any structured compensation program.

State pay-transparency laws (California, Colorado, New York, Washington, and others) require posting the pay range on job listings, making range design a higher-stakes decision than it used to be — every posted range is a public claim about how you pay.`,
    seeAlso: [
      "range-spread",
      "range-midpoint",
      "compa-ratio",
      "pay-grade",
      "salary-structure",
    ],
  },
  {
    slug: "pay-grade",
    term: "Pay grade",
    aliases: ["salary grade", "job grade", "grade level"],
    category: "Pay Structure",
    oneliner:
      "A grouping of jobs with similar internal value that share a single pay range.",
    definition: `Pay grades group jobs of similar internal value (scope, complexity, accountability) so they share one pay range. A typical organization has 10–30 pay grades spanning entry-level individual contributors through executive roles.

Pay grades simplify compensation administration: instead of managing 1,000 individual job ranges, you manage 20 grade ranges and assign jobs into them. They also support internal equity — two roles in the same grade should be paid comparably regardless of department.

Grades are usually assigned via a job-evaluation process (Hay points, market-based banding, or a hybrid) and are typically reviewed every 1–3 years as the organization changes.`,
    seeAlso: ["pay-range", "salary-structure", "job-leveling", "broadbanding"],
  },
  {
    slug: "salary-structure",
    term: "Salary structure",
    aliases: ["pay structure", "compensation structure"],
    category: "Pay Structure",
    oneliner:
      "The complete framework of pay grades and ranges an organization uses to assign compensation.",
    definition: `A salary structure is the full set of pay grades, ranges, and overlap rules an employer uses to administer compensation. A structure has a few key design choices:

- **Number of grades** (often 10–30 for individual contributors and managers, plus separate executive grades)
- **Range spread** per grade (often wider at higher levels)
- **Overlap between grades** (typically 25–50% — the top of grade 5 overlaps with the middle of grade 6)
- **Geographic differentials** if you maintain separate structures per region
- **Aging cadence** — usually annual updates based on survey data

Most organizations maintain 1–3 structures: one for the US, one for international, and sometimes one for executives. Structure design is reviewed annually as part of the comp cycle.`,
    seeAlso: ["pay-grade", "pay-range", "geographic-differential", "broadbanding"],
  },
  {
    slug: "pay-compression",
    term: "Pay compression",
    aliases: ["salary compression", "compression"],
    category: "Pay Structure",
    oneliner:
      "When new hires earn similar pay to (or more than) tenured employees in the same role.",
    definition: `Pay compression happens when an organization's salary ranges fall behind the market. Hiring managers offer market-rate pay to fill open requisitions, while existing employees stay on outdated structures. The result: a new hire and a five-year tenured peer earn nearly the same — or worse, the new hire earns more.

Compression is one of the most common drivers of regrettable turnover. Tenured employees notice when their pay no longer reflects their experience, and they leave for competitors who'll pay them market.

Fixing compression typically requires a mid-cycle adjustment across affected employees, which usually costs far more than the salary survey that would have kept ranges accurate. This is why survey freshness matters — annual data refreshes are the standard, not biennial.`,
    example: `A team of 50 senior accountants haven't gotten a structure adjustment in 18 months. The market moved 6% in that time. New senior accountants are now hired at the same pay or higher than tenured peers. Fixing this requires a 4–6% catch-up adjustment across all 50 employees.`,
    seeAlso: ["pay-range", "aging-factor", "merit-increase", "internal-equity"],
  },

  // ----------------------------- Survey Methodology -----------------------------
  {
    slug: "aging-factor",
    term: "Aging factor",
    aliases: ["age factor", "data aging", "salary aging"],
    category: "Survey Methodology",
    oneliner:
      "A multiplier applied to survey data to project compensation values forward to a current effective date.",
    definition: `Survey data is collected at a point in time, but you use it months later. The aging factor adjusts those collected values forward to a target effective date.

Most US comp surveys use an annualized aging factor of 3–4% in normal markets, applied monthly. Hot segments (tech, biotech, executive) may age at 5–8%.

To age data: **Aged value = original value × (1 + annual_rate)^(months / 12)**.

Aging matters because using stale unmodified data understates current market pay. Survey vendors publish guidance on appropriate aging factors with every release; using their published rate makes your benchmarking defensible if challenged.`,
    example: `A survey reports a $90,000 median collected in October 2025, with a 3% annual aging factor. To use that data on April 1, 2026 (six months later): 90,000 × (1.03)^(6/12) = $91,341.`,
    seeAlso: [
      "effective-date",
      "market-percentile",
      "incumbent-based-survey",
      "job-match-based-survey",
    ],
  },
  {
    slug: "effective-date",
    term: "Effective date",
    aliases: ["data effective date", "as-of date", "valuation date"],
    category: "Survey Methodology",
    oneliner:
      "The date a survey's data is reported as being valid for, after any aging adjustments.",
    definition: `The effective date is the point in time the survey data is meant to represent. Vendors publish data in two flavors:

1. **Collection effective date** — when the data was actually gathered (e.g., October 2025)
2. **Reporting effective date** — what the data is aged to (e.g., April 1, 2026)

Most US benchmark surveys use April 1 or January 1 as their reporting effective date. Some healthcare surveys use April 1; energy and financial-services surveys often use January 1; international surveys vary by country.

When using survey data, document which effective date you used. If you age data further (e.g., to your own pay-cycle date), document that too. Pay-equity reviews and audits will ask.`,
    seeAlso: ["aging-factor", "market-percentile", "incumbent-based-survey"],
  },
  {
    slug: "job-matching",
    term: "Job matching",
    aliases: ["job match", "benchmark matching"],
    category: "Survey Methodology",
    oneliner:
      "The process of mapping your internal jobs to a survey's standardized benchmark jobs to pull comparable market data.",
    definition: `Survey vendors publish standardized benchmark jobs with detailed descriptions and leveling guides. Job matching is how you map your internal roles to those benchmarks.

A good match means your internal job description matches the survey's benchmark on:

- **Scope** (size of organization, span of control)
- **Level** (individual contributor → manager → director → VP → executive)
- **Function** (engineering, finance, sales)
- **Specialization** (e.g., backend engineer vs. data engineer)

A typical job is matched 70–90% accurately to a survey benchmark. The remaining gap is what slot- or hybrid-matching addresses.

Bad matches are the single largest source of compensation-benchmarking error. Most major survey vendors offer matching support as part of the subscription. Use it.`,
    seeAlso: [
      "job-leveling",
      "incumbent-based-survey",
      "job-match-based-survey",
      "market-percentile",
    ],
  },
  {
    slug: "job-leveling",
    term: "Job leveling",
    aliases: ["leveling", "career level", "job level framework"],
    category: "Survey Methodology",
    oneliner:
      "A framework that classifies jobs into consistent levels (e.g., entry, senior, principal, manager, director) for benchmarking and internal equity.",
    definition: `Job leveling is the system you use to classify jobs into consistent tiers. A typical IC framework runs from L1 (entry / associate) through L7 (principal / fellow); a typical management framework runs from M1 (manager) through M5 (SVP).

Leveling matters because survey data is reported by level. If your "Senior Engineer" is matched to a survey's "Engineer III" cut but your scope of work matches their "Engineer IV," your benchmarking will systematically underpay the role.

Major survey vendors (Mercer, Aon Radford, WTW) each have their own leveling framework. Most large employers either adopt one of those frameworks wholesale or build a hybrid that maps cleanly to two or three of them.`,
    seeAlso: [
      "job-matching",
      "pay-grade",
      "salary-structure",
      "broadbanding",
    ],
  },
  {
    slug: "incumbent-based-survey",
    term: "Incumbent-based survey",
    aliases: ["per-incumbent survey", "individual-data survey"],
    category: "Survey Methodology",
    oneliner:
      "A survey methodology where employers submit data per employee (per incumbent) rather than per role.",
    definition: `Incumbent-based surveys collect compensation data at the individual-employee level. Each row in the submitted dataset is one employee, with their job, location, tenure, base salary, bonus, equity, etc.

Incumbent data lets the survey vendor compute statistics (medians, percentiles) across thousands of actual employees, which produces much sharper benchmarks than role-level averages. Most major comp surveys (Mercer MBD, Aon Radford, WTW) use incumbent-based methodology.

The tradeoff: incumbent surveys require more participant effort to submit, and the published reports are typically reported at the role level rather than at the individual level (for confidentiality).`,
    seeAlso: ["job-match-based-survey", "job-matching", "market-percentile"],
  },
  {
    slug: "job-match-based-survey",
    term: "Job-match-based survey",
    aliases: ["per-job survey", "summary-data survey"],
    category: "Survey Methodology",
    oneliner:
      "A survey methodology where employers submit one data row per role, summarizing the pay across all employees in that role.",
    definition: `Job-match-based surveys collect compensation data at the role level. Each row in the submitted dataset is a job (matched to a benchmark), with summary statistics (number of incumbents, average base salary, median bonus, etc.) for that job at the participating employer.

Job-match surveys are easier for participants to complete than incumbent-based surveys, and they're often the format used for industry-association surveys (e.g., CUPA-HR, MGMA, PAS). Newer specialty surveys also tend to start in this format before maturing to incumbent-based.

Tradeoff: job-match data is summary data, so the published percentiles are statistics-of-summaries rather than statistics-of-incumbents. Confidence intervals are typically wider per role.`,
    seeAlso: ["incumbent-based-survey", "job-matching", "market-percentile"],
  },
  {
    slug: "participant-pricing",
    term: "Participant pricing",
    aliases: [
      "participation discount",
      "participant rate",
      "submitter discount",
    ],
    category: "Survey Methodology",
    oneliner:
      "A discounted price (or sometimes free access) offered to employers who submit data to a salary survey.",
    definition: `Most major compensation surveys offer two prices: a non-participant price (typically the full retail rate) and a participant price (typically 30–60% lower). To qualify for the participant rate, the employer submits their compensation data during the survey's data-collection window.

Participation has two costs: HR-team time to prepare the submission, and the small risk that your data could be triangulated by a competitor (mitigated by safe-harbor protections that suppress small-cell data).

Participation has three benefits: lower price, better-quality benchmarks (your job matches inform the methodology), and a validation check (the survey vendor will surface discrepancies in your submission, helping you catch your own data issues).

Most large employers participate in the surveys they buy. Smaller employers often don't have the HR bandwidth and pay the non-participant rate.`,
    seeAlso: [
      "incumbent-based-survey",
      "job-matching",
      "effective-date",
    ],
  },
  {
    slug: "market-percentile",
    term: "Market percentile",
    aliases: ["percentile", "P50", "P75", "75th percentile"],
    category: "Survey Methodology",
    oneliner:
      "A statistical cut that shows where a given pay level sits in the overall market distribution.",
    definition: `Compensation surveys report data at multiple percentiles, typically the 25th, 50th, 75th, and 90th. Each percentile means the same thing it does in any statistical distribution — at the 50th percentile (median), half the market pays more and half pays less.

Common percentile choices for benchmarking:

- **25th percentile** — used by lag-market employers (intentionally below median)
- **50th percentile (median)** — used by match-market employers
- **75th percentile** — used by lead-market employers (paying above median to attract talent)
- **90th percentile** — used by employers paying premium for hot roles or key talent

Most surveys also report an "average" (mean), but the median is more commonly used for pay decisions because it's not skewed by outliers.`,
    seeAlso: ["pay-positioning", "compa-ratio", "range-midpoint"],
  },

  // ----------------------------- Compensation Elements -----------------------------
  {
    slug: "base-salary",
    term: "Base salary",
    aliases: ["base pay", "fixed pay", "annual salary"],
    category: "Compensation Elements",
    oneliner:
      "The fixed, non-variable annual or hourly compensation an employee earns before bonus, equity, or benefits.",
    definition: `Base salary is the predictable, contractually-set pay an employee receives for performing their job. It's the largest single component of total compensation for most non-executive roles and the foundation that variable pay components are built on top of.

Base is typically expressed annually for salaried employees and hourly for non-exempt employees. It's also the basis for benefit calculations (401k contribution percentages, life insurance multiples, severance multiples).

In compensation surveys, "base salary" specifically excludes any bonus, commission, or equity. It's the cleanest comparison metric because it doesn't fluctuate with performance.`,
    seeAlso: [
      "total-cash-compensation",
      "total-direct-compensation",
      "variable-pay",
      "short-term-incentive",
    ],
  },
  {
    slug: "total-cash-compensation",
    term: "Total cash compensation (TCC)",
    aliases: ["TCC", "total cash"],
    category: "Compensation Elements",
    oneliner:
      "Base salary plus any short-term cash bonus or commission earned in the same period.",
    definition: `Total cash compensation is base salary plus any bonus or commission paid in cash, typically over a 12-month period. It's the most common benchmarking metric for sales roles and any role with meaningful variable cash pay.

TCC excludes equity (RSUs, options, ESPP), benefits, and any long-term incentive. Some surveys distinguish between "TCC at target" (base + target bonus) and "TCC actual" (base + actual bonus paid).

Use TCC when comparing roles where cash incentives are a meaningful piece of total pay — sales, executive, investment management.`,
    example: `A sales rep earns $80,000 base + $40,000 commission. Their TCC is $120,000.`,
    seeAlso: [
      "base-salary",
      "total-direct-compensation",
      "short-term-incentive",
      "variable-pay",
    ],
  },
  {
    slug: "total-direct-compensation",
    term: "Total direct compensation (TDC)",
    aliases: ["TDC", "total direct comp"],
    category: "Compensation Elements",
    oneliner:
      "Total cash compensation plus the annualized value of long-term incentives like equity grants.",
    definition: `Total direct compensation captures everything an employee earns directly for their work: base salary, short-term cash incentive, and the annualized value of long-term incentives (equity, deferred cash, etc.).

For executives and tech employees with meaningful equity, TDC is the right benchmarking metric — using TCC alone systematically underestimates competitive pay. For non-equity-eligible roles, TDC equals TCC.

TDC explicitly excludes benefits, perquisites, and one-time payments (sign-on bonuses, retention bonuses), which are typically benchmarked separately.`,
    example: `A tech employee: $180,000 base + $40,000 bonus + $80,000 annualized RSU grant value = TDC of $300,000.`,
    seeAlso: [
      "total-cash-compensation",
      "long-term-incentive",
      "equity-compensation",
      "base-salary",
    ],
  },
  {
    slug: "short-term-incentive",
    term: "Short-term incentive (STI)",
    aliases: ["STI", "annual bonus", "annual incentive plan", "AIP"],
    category: "Compensation Elements",
    oneliner:
      "A cash bonus paid based on annual performance, typically expressed as a percentage of base salary.",
    definition: `Short-term incentive (STI) plans pay employees additional cash based on annual performance — usually a mix of company performance, business-unit performance, and individual performance.

STI design choices:

- **Target percentage**: 5–15% for early-career professionals, 15–30% for managers, 30–60% for executives, 100%+ for CEOs
- **Performance metrics**: revenue, EBITDA, OKR completion, individual goals
- **Payout curve**: typically pays 0% at threshold, 100% at target, 200% at maximum
- **Eligibility**: typically annual full-time employees in good standing as of payout date

STI is the largest annual variable-pay element for most professional roles below the executive level.`,
    seeAlso: [
      "long-term-incentive",
      "variable-pay",
      "total-cash-compensation",
      "base-salary",
    ],
  },
  {
    slug: "long-term-incentive",
    term: "Long-term incentive (LTI)",
    aliases: ["LTI", "long-term incentive plan", "LTIP"],
    category: "Compensation Elements",
    oneliner:
      "Compensation that vests or pays out over multiple years, typically delivered as equity grants.",
    definition: `Long-term incentive plans deliver compensation that vests or pays out over multiple years — typically 3–4 — to align employee retention and decision-making with sustained performance.

Most common LTI vehicles:

- **Restricted stock units (RSUs)** — most common at public companies
- **Stock options** — common at startups and pre-IPO companies
- **Performance shares (PSUs)** — common in executive plans, vest based on performance metrics
- **Deferred cash** — used at private companies without equity available

LTI is a major lever for total compensation in tech, biotech, and senior-leadership roles. For executives and board members, LTI typically exceeds base salary.`,
    seeAlso: [
      "equity-compensation",
      "total-direct-compensation",
      "short-term-incentive",
    ],
  },
  {
    slug: "variable-pay",
    term: "Variable pay",
    aliases: ["incentive pay", "at-risk pay", "performance pay"],
    category: "Compensation Elements",
    oneliner:
      "Any compensation that varies based on performance — typically bonuses, commissions, and equity grants.",
    definition: `Variable pay is the umbrella term for compensation that isn't guaranteed. Unlike base salary, variable pay only pays out when performance conditions are met. It includes:

- **Annual bonus / STI** — pays based on company and individual annual results
- **Sales commission** — pays based on bookings or revenue closed
- **Spot bonuses** — discretionary recognition payments
- **Equity grants / LTI** — vest over time and pay value based on stock performance
- **Profit-sharing** — pays a percentage of company profits

Variable-pay leverage (the ratio of variable to total pay) is highest in sales (often 50/50 base/variable) and executive roles (often 40/60 base/variable). It's lowest in operations and individual-contributor roles where pay is mostly fixed.`,
    seeAlso: [
      "short-term-incentive",
      "long-term-incentive",
      "base-salary",
      "total-cash-compensation",
    ],
  },
  {
    slug: "equity-compensation",
    term: "Equity compensation",
    aliases: ["stock comp", "equity grants", "equity award"],
    category: "Compensation Elements",
    oneliner:
      "Compensation paid in company stock or rights to acquire stock — typically RSUs, options, or PSUs.",
    definition: `Equity compensation transfers ownership in the company to employees as part of pay. The most common forms:

- **Restricted stock units (RSUs)** — promise to deliver shares on a vesting schedule (e.g., 25% per year over 4 years)
- **Stock options** — right to purchase shares at a fixed price for a fixed period; valuable only if stock appreciates
- **Performance shares (PSUs)** — units that vest based on company-performance metrics rather than time
- **Employee stock purchase plans (ESPP)** — let employees buy company stock at a discount

Equity is the dominant compensation lever in technology, biotech, and senior leadership. Annualizing it for benchmarking requires a "grant date fair value" or "expected value" calculation, which most surveys publish.`,
    seeAlso: ["long-term-incentive", "total-direct-compensation", "variable-pay"],
  },

  // ----------------------------- Market & Strategy -----------------------------
  {
    slug: "pay-positioning",
    term: "Pay positioning",
    aliases: [
      "pay strategy",
      "lead match lag",
      "pay positioning strategy",
    ],
    category: "Market & Strategy",
    oneliner:
      "An organization's stated strategy for paying above, at, or below market median.",
    definition: `Pay positioning describes where an organization deliberately positions itself versus the market. Three common stances:

- **Lead market** — pay at the 75th percentile or higher; used to attract scarce talent or differentiate as an employer
- **Match market** — pay at the 50th percentile (median); the most common stance, treats compensation as an equalizer rather than a differentiator
- **Lag market** — pay at the 25th percentile; used by cost-conservative organizations or those competing on non-cash factors (mission, equity, flexibility)

It's normal and common to have different pay-positioning stances for different functions: lead market for engineers, match market for ops, lag market for entry-level roles. Each organization should have a documented compensation philosophy that articulates this.`,
    seeAlso: [
      "market-percentile",
      "compensation-philosophy",
      "compa-ratio",
    ],
  },
  {
    slug: "compensation-philosophy",
    term: "Compensation philosophy",
    aliases: ["pay philosophy", "comp philosophy"],
    category: "Market & Strategy",
    oneliner:
      "A documented statement of how an organization makes pay decisions and why.",
    definition: `A compensation philosophy is a written statement that articulates how the organization pays. It typically covers:

- **Pay positioning** — lead, match, or lag market, by function
- **Pay mix** — typical balance of base, STI, and LTI
- **Geographic strategy** — single-structure, regional, or fully-localized pay
- **Equity grants** — who gets equity, what vehicle, what cadence
- **Pay equity commitments** — gender-pay-gap targets, audit cadence
- **Performance differentiation** — how high performers are differentiated from average performers

Compensation philosophy is the document HR points to when defending pay decisions to executives, employees, and regulators. Without one, every pay conversation becomes ad hoc and harder to defend.`,
    seeAlso: ["pay-positioning", "pay-equity", "merit-increase"],
  },
  {
    slug: "geographic-differential",
    term: "Geographic differential",
    aliases: [
      "geo differential",
      "location differential",
      "geographic pay differential",
    ],
    category: "Market & Strategy",
    oneliner:
      "A multiplier applied to a national pay range to reflect higher or lower pay levels in a specific geography.",
    definition: `Geographic differentials adjust national or HQ-anchored pay ranges to reflect local market rates. A national role priced at the 50th percentile of national data might be paid 110% of that in San Francisco and 92% in Atlanta.

Most multi-region employers either:

1. **Maintain regional structures** — separate ranges for SF, NYC, Seattle, etc.
2. **Use a national structure with multipliers** — one base structure × geographic factor
3. **Tier locations into pay zones** — 3–5 zones (e.g., Tier 1 = HQ metros, Tier 2 = secondary metros, Tier 3 = remote)

Survey vendors like Mercer publish dedicated "Geographic Salary Differential" surveys that quantify the multipliers metro-by-metro. Updating differentials annually is standard practice.`,
    seeAlso: ["pay-range", "salary-structure", "cost-of-labor"],
  },
  {
    slug: "cost-of-labor",
    term: "Cost of labor (COL)",
    aliases: ["labor cost", "wage cost"],
    category: "Market & Strategy",
    oneliner:
      "What employers pay for talent in a specific geography — distinct from cost of living.",
    definition: `Cost of labor (COL) is what employers actually pay for a given role in a given geography. It's an output of supply, demand, and competitive dynamics — not housing or grocery prices.

Compensation decisions should anchor on cost of labor, not cost of living. A role in San Francisco might pay 30% more than the same role in Atlanta because the *talent market* is more competitive there, not because rent is higher. (The two are correlated but not the same.)

Survey vendors report cost-of-labor data; cost-of-living data comes from sources like the Bureau of Labor Statistics, ACCRA, or Numbeo. Use COL for setting pay ranges; use cost-of-living for relocation packages and expense reimbursement.`,
    seeAlso: [
      "geographic-differential",
      "market-percentile",
      "pay-positioning",
    ],
  },

  // ----------------------------- Equity & Compliance -----------------------------
  {
    slug: "pay-equity",
    term: "Pay equity",
    aliases: ["pay equality", "equal pay"],
    category: "Equity & Compliance",
    oneliner:
      "The principle that employees doing similar work should be paid similarly, regardless of gender, race, or other protected characteristics.",
    definition: `Pay equity is both a legal requirement (under Equal Pay Act, Title VII, and state laws) and a compensation-design principle. It means employees doing substantially similar work get paid similarly, with any differences explained by legitimate factors (tenure, performance, scope, geography).

Most large employers conduct annual pay-equity audits — running statistical models to find unexplained pay gaps by gender, race, or other protected categories. Where gaps exist, employers either explain them (if defensible) or close them (if not).

Pay-transparency laws are sharpening this requirement. Employers can no longer rely on opacity; posted ranges and disclosure obligations make pay differences visible and challengeable.`,
    seeAlso: [
      "pay-transparency",
      "internal-equity",
      "compensation-philosophy",
    ],
  },
  {
    slug: "pay-transparency",
    term: "Pay transparency",
    aliases: ["salary transparency", "pay disclosure"],
    category: "Equity & Compliance",
    oneliner:
      "Practices and laws that require or encourage disclosing pay information to employees, candidates, and the public.",
    definition: `Pay transparency means making compensation information visible — typically a pay range on job postings, sometimes pay range on internal promotions, and sometimes individual pay scales.

State laws driving pay transparency in the US include California (2023), Colorado (2021), Washington (2023), New York (2023), Massachusetts (2025), and many others. The general direction is toward broader and stricter disclosure.

For comp teams, pay transparency raises the stakes on every pay decision. Posted ranges are public claims; employees compare ranges across roles; pay differences are visible. Defensible pay ranges, current market data, and documented methodology become essential rather than optional.

See our deep guide: [Pay Transparency Laws by State](/blog/pay-transparency-laws-by-state-2026).`,
    seeAlso: ["pay-equity", "pay-range", "compensation-philosophy"],
  },
  {
    slug: "internal-equity",
    term: "Internal equity",
    aliases: ["internal pay equity"],
    category: "Equity & Compliance",
    oneliner:
      "The principle that pay differences inside the organization should reflect legitimate differences in scope, level, performance, or tenure.",
    definition: `Internal equity is the discipline of keeping pay relationships inside the organization sensible. A senior accountant should make more than a junior accountant; a manager should make more than the individual contributors they manage; two senior accountants on different teams should make comparable pay.

Internal equity issues commonly show up as:

- **Compression** — new hires earning similar to (or more than) tenured peers
- **Inversion** — managers earning less than their direct reports
- **Function imbalance** — engineering paid 30% above finance for similar levels of scope
- **Tenure cliffs** — people with 10+ years tenure paid the same as 3-year tenure peers

Internal-equity issues are usually fixed via mid-cycle adjustments after they're identified. Surveys help by anchoring external pay; internal equity is largely an HR/comp diagnostic exercise.`,
    seeAlso: ["pay-compression", "pay-equity", "compa-ratio"],
  },

  // ----------------------------- Increases & Changes -----------------------------
  {
    slug: "merit-increase",
    term: "Merit increase",
    aliases: ["merit raise", "performance increase", "annual increase"],
    category: "Increases & Changes",
    oneliner:
      "A pay increase awarded for performance, typically as part of an annual review cycle.",
    definition: `Merit increases are pay adjustments tied to individual performance, awarded once per year as part of the comp cycle. They're distinct from market adjustments (which apply to ranges) and promotion increases (which apply when an employee changes level).

Typical merit-increase budgets in the US:

- **Average performers**: 2.5–3.5% in normal markets
- **Strong performers**: 4–6%
- **Top performers**: 7–10%+
- **Underperformers**: 0%

Merit budgets are set annually based on inflation, market movement, and the company's compensation philosophy. They're typically published in major comp surveys (Mercer, WTW, Gallagher) several months ahead of the comp cycle so HR can plan.`,
    seeAlso: ["aging-factor", "pay-compression", "pay-positioning"],
  },
  {
    slug: "promotion-increase",
    term: "Promotion increase",
    aliases: ["promo bump", "promotion bump"],
    category: "Increases & Changes",
    oneliner:
      "A pay adjustment given when an employee moves to a higher level or pay grade.",
    definition: `Promotion increases are pay adjustments awarded when an employee moves to a higher level. They're separate from and typically larger than merit increases — a promotion isn't a reward for sustained performance, it's a recognition of expanded scope and a re-anchoring of pay to a new market.

Typical promotion-increase ranges:

- **Lateral level change** (M3 → M4, similar scope): 5–10%
- **Standard promotion** (e.g., Senior to Staff): 10–15%
- **Material scope expansion** (IC to manager, manager to director): 15–25%

The new pay should land somewhere in the new range — typically near the bottom for emerging-into-the-role employees, near the midpoint for ready-now promotions. Surveys help calibrate the right pay landing spot for each level.`,
    seeAlso: ["merit-increase", "pay-grade", "pay-range"],
  },
  {
    slug: "sign-on-bonus",
    term: "Sign-on bonus",
    aliases: ["signing bonus", "hiring bonus"],
    category: "Increases & Changes",
    oneliner:
      "A one-time payment offered to new hires as an inducement to accept an offer.",
    definition: `Sign-on bonuses are one-time payments given to new employees, typically paid within 30 days of start date. They're used to:

- **Replace forfeited equity or unpaid bonus** at the candidate's prior employer (most common)
- **Close a base-salary gap** when posted pay can't go higher
- **Compete for hot talent** in tight markets
- **Cover relocation** without putting it on a separate budget line

Most sign-on bonuses are subject to a clawback provision — repay if you leave within 12 months. Survey data on sign-on bonus prevalence and amounts is typically reported separately from the regular comp data, often in pay-practices surveys.`,
    seeAlso: ["retention-bonus", "variable-pay", "base-salary"],
  },
  {
    slug: "retention-bonus",
    term: "Retention bonus",
    aliases: ["stay bonus", "retention award"],
    category: "Increases & Changes",
    oneliner:
      "A one-time payment offered to current employees in exchange for staying through a defined period.",
    definition: `Retention bonuses are paid to current employees in exchange for committing to stay through a specific date or milestone — often used during M&A integrations, leadership transitions, critical projects, or when a competitor is actively recruiting.

Typical structures:

- **Lump-sum** paid at the end of the retention period
- **Installment** paid in chunks across the retention period
- **Equity-based** vested at the end of the retention period

Retention bonuses are typically benchmarked separately from regular comp because they're situation-specific. Most major comp-surveys publish retention-bonus prevalence and average amounts as part of their pay-practices modules.`,
    seeAlso: ["sign-on-bonus", "variable-pay", "long-term-incentive"],
  },
];

export function getAllTerms(): GlossaryTerm[] {
  return [...TERMS].sort((a, b) => a.term.localeCompare(b.term));
}

export function getTermBySlug(slug: string): GlossaryTerm | undefined {
  return TERMS.find((t) => t.slug === slug);
}

export function getTermsByCategory(): {
  category: GlossaryTerm["category"];
  terms: GlossaryTerm[];
}[] {
  const order: GlossaryTerm["category"][] = [
    "Pay Structure",
    "Survey Methodology",
    "Compensation Elements",
    "Market & Strategy",
    "Equity & Compliance",
    "Increases & Changes",
  ];
  return order.map((category) => ({
    category,
    terms: TERMS.filter((t) => t.category === category).sort((a, b) =>
      a.term.localeCompare(b.term)
    ),
  }));
}
