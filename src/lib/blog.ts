/**
 * Blog post store. Posts live in this file as typed data so there's no
 * runtime markdown parser or filesystem read at request time. Add new
 * entries to the POSTS array; they flow through to /blog, /blog/[slug],
 * and the sitemap automatically.
 *
 * The `body` string is rendered by src/components/blog/PostBody.tsx.
 * It supports a tiny markdown subset:
 *   - Blank line separates paragraphs.
 *   - Line starting with `## ` becomes <h2>.
 *   - Line starting with `### ` becomes <h3>.
 *   - Consecutive lines starting with `- ` become a <ul>.
 *   - [link text](https://example.com) becomes an <a>.
 *   - **bold** becomes <strong>.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** Display date, ISO yyyy-mm-dd. */
  date: string;
  /** Short read-time hint, e.g. "4 min read". */
  readTime?: string;
  author?: string;
  tags?: string[];
  /** SEO target + secondary keywords. Becomes the <meta name="keywords">. */
  keywords?: string[];
  body: string;
  /**
   * Optional Q&A pairs that get emitted as schema.org FAQPage JSON-LD on
   * the post page. Increases citation rate when LLMs and AI Overviews
   * extract direct answers from the post.
   */
  faq?: Array<{ q: string; a: string }>;
}

const POSTS: BlogPost[] = [
  {
    slug: "ai-salary-data-vs-salary-surveys",
    title:
      "Can AI Replace Salary Surveys? What ChatGPT Gets Wrong About Compensation Data",
    description:
      "AI tools like ChatGPT give confident salary estimates, but they can't replace real compensation surveys for defensible pay decisions. Here's why.",
    date: "2026-04-23",
    readTime: "4 min read",
    author: "CompShop",
    tags: ["Compensation Strategy"],
    keywords: [
      "can AI replace salary surveys",
      "chatgpt salary data",
      "AI compensation data",
      "LLM salary benchmarks",
      "AI pay benchmarking",
      "salary survey vs AI",
    ],
    faq: [
      {
        q: "Can I use ChatGPT for salary benchmarking?",
        a: "For exploratory research, yes. For setting actual pay ranges or defending pay decisions, no. Large language models don't have access to primary survey data and can't verify what they generate.",
      },
      {
        q: "Is AI salary data accurate?",
        a: "AI salary estimates reflect what was in the training data, typically public sources that are self-reported and often stale. Accuracy varies widely by role and market, and it should not be treated as a primary data source.",
      },
      {
        q: "What's the difference between AI and a salary survey?",
        a: "A salary survey collects primary data from employers, applies job matching, and documents methodology. AI generates plausible responses based on public content. Different inputs, different reliability.",
      },
      {
        q: "Will AI replace salary surveys in the future?",
        a: "Unlikely for formal pay decisions. AI could make survey data easier to query and summarize, but without a verified, audited source of primary data underneath, the outputs won't be defensible.",
      },
    ],
    body: `If you've ever asked ChatGPT "what's the market rate for a senior software engineer in Boston," you've probably gotten a fluent, confident, specific-looking answer. It probably looked good enough to paste into a slide.

It almost certainly shouldn't be trusted for a pay decision. Here's why, and where AI does belong in a modern compensation workflow.

## What LLMs actually know about pay

Large language models like ChatGPT, Claude, and Gemini don't have access to proprietary salary survey data. They have:

- **Public web content** (Glassdoor, Indeed, Levels.fyi, news articles, blog posts).
- **Whatever their training cutoff captured**, often 6-18 months stale.
- **No ability to verify or job-match** the underlying data.

Ask the same model twice and you often get different numbers. Ask it about a niche role in a mid-sized city and it will confidently invent a range based on pattern matching, not data.

For a compensation professional, that's a research tool. It is not a benchmarking tool.

## Why AI salary answers look convincing

LLMs are fluent. They produce well-structured, confident, context-aware responses. A typical ChatGPT salary answer will include:

- A specific number or range.
- Geographic adjustment language.
- Years-of-experience tiering.
- Caveats about variance.

All of which sound like competent comp analysis. But the underlying data is still public, self-reported, unverified, and usually stale. Confident presentation of weak data is arguably worse than obviously weak data, because it invites misplaced trust.

## What real salary surveys do that AI can't

Paid salary surveys from vendors like Mercer, Radford, Culpepper, Willis Towers Watson, and CompData do five things LLMs fundamentally cannot:

1. **Collect primary data directly from HR teams**, not scraped from employee reviews.
2. **Match jobs** to a consistent leveling framework (incumbent-based or job description-based).
3. **Apply statistical cleaning** to remove outliers and reconcile reporting errors.
4. **Report transparently** on sample size, methodology, and participant mix.
5. **Produce defensible, auditable data** suitable for board review, pay equity analysis, and regulatory scrutiny.

No LLM can tell you that a specific Radford cut had 2,847 participants at a specific level, in a specific metro, in a specific industry. Real salary surveys can.

## The defensibility problem

Say a group of employees files a pay equity complaint. Your comp team is asked to show the market data behind your pay ranges. "ChatGPT said so" is not a defense. Neither is a Glassdoor screenshot.

Compensation decisions need to be backed by sourced, dated, methodologically documented data. That is not an AI capability today, and it isn't close.

## Where AI does help compensation teams

This isn't an anti-AI take. LLMs are genuinely useful in comp work:

- **Drafting and polishing job descriptions** before job matching.
- **Summarizing survey methodology documents** so you can compare vendors faster.
- **Exploring unfamiliar roles** before asking for structured data.
- **Writing compensation communications** to managers and employees.
- **Explaining pay philosophy** in natural language to non-HR audiences.

Use AI to accelerate the work around the data. Don't use it as the data.

## The verdict

AI doesn't replace salary surveys. It makes comp pros faster at the non-data parts of their work, which is a real productivity gain. The moment a decision has dollars and defensibility attached, real survey data is still non-negotiable.

If anything, the rise of AI is making primary, verified compensation data more valuable. When everyone can generate plausible-sounding numbers for free, the premium on auditable data goes up.

## FAQ

### Can I use ChatGPT for salary benchmarking?

For exploratory research, yes. For setting actual pay ranges or defending pay decisions, no. LLMs don't have access to primary survey data and can't verify what they generate.

### Is AI salary data accurate?

AI salary estimates reflect what was in the training data, typically public sources that are self-reported and often stale. Accuracy varies widely by role and market, and it should not be treated as a primary data source.

### What's the difference between AI and a salary survey?

A salary survey collects primary data from employers, applies job matching, and documents methodology. AI generates plausible responses based on public content. Different inputs, different reliability.

### Will AI replace salary surveys in the future?

Unlikely for formal pay decisions. AI could make survey data easier to query and summarize, but without a verified, audited source of primary data underneath, the outputs won't be defensible.

## Need defensible compensation data?

[Browse the CompShop directory of salary surveys.](/surveys)`,
  },
  {
    slug: "what-is-a-salary-survey",
    title:
      "What Is a Salary Survey? A Guide to Compensation Benchmarking and Pay Strategy",
    description:
      "A salary survey is the foundation of any defensible compensation program. Here's what they are, how they work, and how they power benchmarking and pay strategy.",
    date: "2026-04-27",
    readTime: "5 min read",
    author: "CompShop",
    tags: ["Compensation 101"],
    keywords: [
      "what is a salary survey",
      "salary survey definition",
      "compensation benchmarking",
      "compensation strategy",
      "market pricing",
      "salary benchmarking process",
    ],
    body: `A salary survey is the backbone of every defensible compensation program. Most HR and finance leaders don't think about them seriously until the first time someone asks "how did we set this pay range," and they don't have a good answer.

This post covers the basics: what a salary survey is, the different types, and how survey data feeds into compensation benchmarking and broader pay strategy.

## What is a salary survey?

A salary survey is a structured, third-party-collected dataset of compensation information for specific jobs at specific companies. Survey publishers gather pay data from participating employers, clean and validate it, and report it back as benchmarks: medians, percentiles, and comparison cuts by industry, geography, company size, and revenue.

The value of a salary survey is not just the numbers. It's the structure: standardized job descriptions, consistent leveling, and statistical cleaning that lets you compare your pay against the market on like-for-like terms.

## How salary surveys differ from free salary data

Free salary data sources rely on self-reported, unverified information. Salary surveys collect data directly from HR teams using a defined methodology, typically:

- **Incumbent-based:** data reported per employee (job, comp, tenure, location).
- **Job-match-based:** data reported per role, matched to a benchmark job description.

Both methodologies produce the standardized, defensible data you need for setting formal pay ranges, supporting board decisions, and answering pay equity questions.

## Types of salary surveys

Comp pros typically choose surveys across four dimensions:

1. **Scope.** Broad multi-industry vs. industry-specific (healthcare, tech, nonprofit, higher education, financial services).
2. **Methodology.** Incumbent-based vs. job-match-based.
3. **Geography.** US national, regional, global, or country-specific.
4. **Pay element coverage.** Base salary only, total cash compensation, or total direct compensation including equity and long-term incentives.

The right mix for your organization depends on your industry, geographic footprint, and the kinds of decisions you need to make.

## How salary surveys power compensation benchmarking

Compensation benchmarking is the process of comparing your internal pay against the external market. Salary surveys are the input.

The basic benchmarking workflow:

1. **Match jobs.** Map your internal roles to benchmark jobs in the survey using leveling and job descriptions.
2. **Pull market data.** Extract relevant percentiles (typically 25th, 50th, 75th, 90th) for each matched job.
3. **Age the data.** Adjust survey data forward by an aging factor to reflect current values.
4. **Cut by relevant dimensions.** Filter by industry, geography, company size, or revenue.
5. **Compare to internal pay.** Calculate compa-ratios, range penetration, and pay equity gaps.

Without survey data, benchmarking is guesswork. With survey data, it becomes a defensible, repeatable process you can re-run every year.

## How salary surveys shape compensation strategy

Once you have benchmarking data, you can make strategic decisions about how your organization positions itself in the market:

- **Pay positioning.** Will you pay at the 50th percentile (market median), 75th (above market to attract talent), or 25th (cost-conservative)? Different decisions for different roles is normal and common.
- **Pay range structure.** Survey data informs range minimums, midpoints, and maximums for each pay grade.
- **Geographic differentials.** How much should you pay an engineer in Atlanta vs. San Francisco? Surveys provide the answer.
- **Variable pay design.** Bonus targets, sales commission rates, and equity mix decisions all reference survey norms.
- **Long-term planning.** Year-over-year survey trends tell you whether your market is moving 3% or 15%, which drives merit budgets and total comp planning.

A compensation strategy without survey data is opinion. With survey data, it becomes a position you can defend to the board, employees, regulators, and candidates.

## A simple buying framework for first-time buyers

If you've never bought a salary survey before, the decision tree is straightforward:

1. **Define your scope.** Industry, geography, and the segments you most need data for.
2. **Shortlist vendors that match that scope.** Use a directory or peer recommendations to find providers covering your industry and geography.
3. **Compare on coverage and methodology** rather than headline price. The cheapest survey is the wrong choice if it doesn't cover your roles.
4. **Confirm publication cadence and aging factors.** Make sure the data refresh aligns with your comp cycle.
5. **Buy, match, benchmark, repeat annually.**

## FAQ

### How often should you buy a new salary survey?

Annually for primary surveys. Semi-annually or as needed for hot segments. Two-year-old survey data is generally too stale for setting current pay ranges.

### Do you need a salary survey if you already have free data?

Yes. Free data is self-reported and unverified, so it cannot support defensible pay decisions. Paid salary surveys are the standard for setting formal pay ranges, supporting board-level decisions, and meeting pay equity and pay transparency requirements.

### What is the most widely used salary survey?

There is no single dominant survey. Mercer, Radford (now part of Aon), Willis Towers Watson, and Korn Ferry are the largest by participant count. Industry-specific surveys (CUPA-HR for higher education, SullivanCotter for healthcare, CompData for general industry) often outperform general-market surveys within their domains.

### Can a small business buy a salary survey?

Yes. Many regional, association, and specialty surveys are sized for small to mid-sized employers. Some industry associations and regional chambers of commerce also offer compensation data as a member benefit.

## Looking for the right salary survey?

[Browse the CompShop directory](/surveys) and filter by industry, geography, and methodology.`,
    faq: [
      {
        q: "How often should you buy a new salary survey?",
        a: "Annually for primary surveys. Semi-annually or as needed for hot segments. Two-year-old survey data is generally too stale for setting current pay ranges.",
      },
      {
        q: "Do you need a salary survey if you already have free data?",
        a: "Yes. Free data is self-reported and unverified, so it cannot support defensible pay decisions. Paid salary surveys are the standard for setting formal pay ranges, supporting board-level decisions, and meeting pay equity and pay transparency requirements.",
      },
      {
        q: "What is the most widely used salary survey?",
        a: "There is no single dominant survey. Mercer, Radford (now part of Aon), Willis Towers Watson, and Korn Ferry are the largest by participant count. Industry-specific surveys (CUPA-HR for higher education, SullivanCotter for healthcare, CompData for general industry) often outperform general-market surveys within their domains.",
      },
      {
        q: "Can a small business buy a salary survey?",
        a: "Yes. Many regional, association, and specialty surveys are sized for small to mid-sized employers. Some industry associations and regional chambers of commerce also offer compensation data as a member benefit.",
      },
    ],
  },
  {
    slug: "get-salary-survey-approved-by-cfo",
    title: "How to Get Your CFO to Approve a Salary Survey Purchase",
    description:
      "Need budget for a compensation survey but finance is pushing back? Here's the ROI case, objection handling, and template to get your CFO to sign off.",
    date: "2026-05-03",
    readTime: "5 min read",
    author: "CompShop",
    tags: ["Compensation Strategy"],
    keywords: [
      "justify salary survey budget",
      "salary survey ROI",
      "CFO approval compensation data",
      "compensation budget justification",
      "HR budget salary survey",
      "how to expense a salary survey",
    ],
    body: `You know you need current, defensible market data. Finance wants to know why a paid compensation survey is worth budgeting for when "free salary sites are right there."

Here's the argument that works.

## Reframe the ask from cost to risk

The first mistake most HR leaders make is pitching salary surveys as a "data subscription." CFOs don't fund subscriptions. They fund risk reduction, revenue protection, and compliance.

Reframe it:

- **Instead of:** "We'd like to budget for a compensation survey."
- **Try:** "To protect against turnover, compression, and pay equity exposure, we need current third-party market data. The downside of not having it is materially higher than the cost."

## The four arguments CFOs respond to

### 1. Turnover cost

The cost to replace a professional employee, when you count recruiting, onboarding, and lost productivity, is substantial. Industry research consistently puts it at a meaningful fraction or multiple of annual salary.

If current market data prevents even one regrettable exit per year, the salary survey pays for itself several times over.

### 2. Compression and internal equity

Hiring at current market while ranges reflect last year's data creates compression: new hires earn more than tenured peers in the same role. The fix is usually a mid-cycle adjustment across affected employees, which dwarfs the cost of the survey that would have prevented it.

A small percentage compression adjustment across a department of fifty employees becomes a real payroll line item. The salary survey that would have kept ranges accurate is a small fraction of that adjustment.

### 3. Pay equity and regulatory exposure

States are tightening pay transparency and pay equity requirements (California, Colorado, New York, Washington, and more). Internal pay decisions increasingly need to be backed by defensible market data.

"We set this range using ChatGPT" or "we used free salary site averages" are not defenses. Third-party, dated, methodologically documented survey data is.

The cost of a single pay equity settlement or Department of Labor audit finding is orders of magnitude larger than any salary survey budget.

### 4. Hiring velocity and offer acceptance

Stale ranges mean stale offers. Stale offers mean rejected candidates and extended time-to-hire. Each additional week of open requisition has a measurable cost in revenue leakage or productivity loss.

If your recruiters are coming back asking for range exceptions every month, that's data confirming you're behind the market. Fresh salary survey data reduces exception frequency and accelerates offer acceptance.

## What to put in your budget request

A simple four-line business case most CFOs will sign off on:

1. **Purpose.** Maintain defensible, current market pay data for key roles.
2. **Cost.** The vendor quote for one primary survey, plus any specialized coverage you need.
3. **Avoided cost.** One regrettable turnover event at our typical replacement cost exceeds the full survey budget.
4. **Compliance angle.** Supports state pay transparency and pay equity requirements in the states where we operate.

Attach a one-pager citing turnover cost research and the specific state laws you need to comply with. Don't over-sell it.

## Common CFO objections and how to answer them

### Can't we just use free salary data sites?

Free sources are self-reported and unleveled. They cannot support defensible pay ranges or audit-ready decisions, and the cost of a single pay equity case dwarfs any survey budget.

### Why this vendor instead of a cheaper one?

Vendor choice should match your industry, job mix, and geography. A cheaper survey that doesn't cover your roles is more expensive, not less. Bring a comparison (using a directory like CompShop speeds this up).

### Can we buy it every other year to save money?

Two-year-old compensation data is meaningfully stale in normal markets and dramatically off in hot segments. The savings from skipping a year rarely outweigh the compression and turnover cost.

### Should Legal or Finance fund this instead?

If you have the HR budget, use it. If not, Finance and Legal both benefit from defensible comp data, so co-funding is common.

## One tactic that closes the deal

Bring the actual shortlist to the conversation. CFOs respond to specifics, not categories. Walking in with "we've narrowed it to Radford and Culpepper for tech, here's the coverage and methodology" is far more credible than "we'd like budget for compensation data."

## FAQ

### What if my company has unique jobs that aren't directly covered by the survey?

This is common. Survey job catalogs cannot capture every role at every company. The standard approach is hybrid matching: blending data from two or three similar surveyed jobs, adjusting for scope or level differences, and triangulating across multiple surveys where possible. Informed approximation, with documented reasoning, is materially more defensible than no market data at all. Match what you can directly, slot or blend the rest, and document your method.

### Can I justify a salary survey as an ROI investment?

Yes. Frame it as turnover prevention and compliance protection. One prevented regrettable exit typically covers the full annual cost.

### What department should pay for a salary survey?

Most commonly HR / People, but Finance and Legal often co-fund because defensible pay data supports financial planning and compliance. Talk to both stakeholders before submitting the request.

## Build your salary survey shortlist in one place

[Browse compensation surveys by industry, geography, and methodology.](/surveys)`,
    faq: [
      {
        q: "Can't we just use free salary data sites?",
        a: "Free sources are self-reported and unleveled. They cannot support defensible pay ranges or audit-ready decisions, and the cost of a single pay equity case dwarfs any survey budget.",
      },
      {
        q: "Why pick this vendor instead of a cheaper one?",
        a: "Vendor choice should match your industry, job mix, and geography. A cheaper survey that doesn't cover your roles is more expensive, not less. Bring a comparison.",
      },
      {
        q: "Can we buy a salary survey every other year to save money?",
        a: "Two-year-old compensation data is meaningfully stale in normal markets and dramatically off in hot segments. The savings from skipping a year rarely outweigh the compression and turnover cost.",
      },
      {
        q: "Should Legal or Finance fund the salary survey instead of HR?",
        a: "If you have the HR budget, use it. If not, Finance and Legal both benefit from defensible comp data, so co-funding is common.",
      },
      {
        q: "What if my company has unique jobs that aren't directly covered by the survey?",
        a: "Survey job catalogs cannot capture every role at every company. The standard approach is hybrid matching: blending data from two or three similar surveyed jobs, adjusting for scope or level differences, and triangulating across multiple surveys where possible. Match what you can directly, slot or blend the rest, and document your method.",
      },
      {
        q: "Can I justify a salary survey as an ROI investment?",
        a: "Yes. Frame it as turnover prevention and compliance protection. One prevented regrettable exit typically covers the full annual cost.",
      },
      {
        q: "What department should pay for a salary survey?",
        a: "Most commonly HR or People Operations, but Finance and Legal often co-fund because defensible pay data supports financial planning and compliance. Talk to both stakeholders before submitting the request.",
      },
    ],
  },
  {
    slug: "pay-transparency-laws-by-state-2026",
    title:
      "Pay Transparency Laws by State: A 2026 Guide for HR and Compensation Teams",
    description:
      "An easy state-by-state guide to U.S. pay transparency laws in 2026. Who's required to disclose, what salary range disclosures are required, and what HR teams need to do.",
    date: "2026-05-01",
    readTime: "6 min read",
    author: "CompShop",
    tags: ["Pay Transparency"],
    keywords: [
      "pay transparency laws by state",
      "pay transparency 2026",
      "state pay disclosure laws",
      "salary range disclosure requirements",
      "pay transparency compliance",
      "salary transparency law",
    ],
    body: `State pay transparency laws have multiplied over the past five years. As of mid-2026, the United States has no federal pay transparency requirement, but a growing patchwork of state and city laws now governs how employers must disclose salary information to applicants and employees.

This guide gives compensation and HR teams a quick reference for what each state requires, who's covered, and what to watch for.

## Quick reference: states with active pay transparency laws (2026)

| State | Effective | Posting Range Required | Employer Threshold | Key Notes |
|---|---|---|---|---|
| California | Jan 1, 2023 | Yes | 15+ employees | Pay scale on postings. Pay data reporting also required. |
| Colorado | Jan 1, 2021 (expanded) | Yes | All employers | Pay range, benefits, and notification of internal promotion opportunities. |
| Connecticut | Oct 1, 2021 | On request | All employers | Range disclosed at applicant request and at offer. |
| Hawaii | Jan 1, 2024 | Yes | 50+ employees | Hourly or salary range on postings. |
| Illinois | Jan 1, 2025 | Yes | 15+ employees | Pay range and benefits on postings. |
| Maine | Jan 1, 2026 | Yes | 10+ employees | Pay range on all postings, including third-party. |
| Maryland | Oct 1, 2024 | Yes | All employers | Good-faith range required on postings. |
| Massachusetts | Oct 29, 2025 | Yes | 25+ employees | Pay range on postings. Pay data reporting for 100+ employers. |
| Minnesota | Jan 1, 2025 | Yes | 30+ employees | Pay range and general benefits description on postings. |
| Nevada | 2021 | After interview | All employers | Range disclosed to applicants who have completed an initial interview. |
| New Jersey | 2025 | Yes | 10+ employees | Range cap of 60% spread between min and max. Promotion notifications required. |
| New York (state) | Sep 17, 2023 | Yes | 4+ employees | Pay range on internal and external postings. |
| Rhode Island | 2023 | On request | All employers | Range provided on request and at offer. |
| Vermont | 2025 | Yes | 5+ employees | Applies to remote roles tied to a Vermont office. |
| Washington | Jan 1, 2023 | Yes | 15+ employees | Pay scale, benefits, and other compensation on postings. |
| Washington D.C. | 2024 | Yes | All employers | Pay range on postings. |

**Coming soon:** Delaware's pay transparency law takes effect September 2027.

**City-level laws:** Several cities have additional or stricter rules including New York City, Jersey City (NJ), Cincinnati and Toledo (OH), and Ithaca (NY). Check local jurisdictions where you hire.

## What pay transparency laws typically require

Most state laws fall into one or more of the following buckets:

1. **Posting requirements.** Salary range must appear on internal and external job postings. Some states also require benefits and other compensation to be disclosed.
2. **On-request disclosure.** Employer must provide pay range to applicants on request, often after a defined point in the interview process.
3. **Promotion and transfer notifications.** Internal opportunities must be communicated to existing employees with associated pay information.
4. **Pay data reporting.** Employers above a defined size must submit pay data by job, race, and gender to the state.

## What this means for remote employers

If a remote role could be filled by someone living in a covered state, the law generally applies, even if your company is headquartered elsewhere. National postings are effectively governed by the strictest applicable state.

The practical implication: most multi-state employers should default to including pay ranges on every posting rather than trying to manage state-by-state exceptions.

## What compensation teams need to do

If you operate in any of the states above (or hire remotely from them), the practical to-do list:

- **Audit your job postings.** Every posting visible in a covered state needs a pay range. National postings need ranges if they're visible in any covered state.
- **Build defensible pay ranges.** Posted ranges trigger candidate negotiations, employee questions, and pay equity scrutiny. Ranges built on weak data become liabilities.
- **Document range methodology.** If asked how a range was set, your team needs a consistent answer rooted in third-party market data.
- **Coordinate with talent acquisition.** Recruiters often paste ranges from old templates. Build a single source of truth.
- **Plan for pay data reporting.** California and Massachusetts (and others on the way) require structured submissions. Reporting is harder than it looks.

## How salary surveys support compliance

Posting a pay range without supporting market data is risky. Pay equity counsel, employee challenges, and DOL audits can probe how a range was set. The defensible answer is "based on third-party market data with documented methodology" rather than "based on a manager's best guess."

Salary surveys provide:

- **Defensible, dated market data** that supports the range you posted.
- **Consistent methodology** across years, which matters when posting practices are challenged over time.
- **Job-matched benchmarks** that can be cited in pay equity proceedings.

In a transparency-heavy environment, the cost of weak market data goes up. Every posted range is a public claim about how you pay.

## Important caveat

State pay transparency laws change frequently. Several additional states are evaluating similar legislation in 2026. Always confirm current requirements with your employment counsel before posting jobs in any covered jurisdiction. This guide reflects publicly reported information and is not legal advice.

## FAQ

### Which states require pay transparency in 2026?

California, Colorado, Connecticut, Hawaii, Illinois, Maine, Maryland, Massachusetts, Minnesota, Nevada, New Jersey, New York, Rhode Island, Vermont, Washington, and Washington D.C. all have active laws. Delaware's law takes effect in 2027. Several major cities have additional or stricter requirements.

### Does pay transparency apply to remote roles?

Generally, yes. If a posting is visible in a covered state or open to candidates from that state, the law typically applies. Vermont, for example, explicitly extends to remote roles tied to a Vermont office.

### Is there a federal pay transparency law?

Not as of 2026. Federal contractors are subject to OFCCP requirements, but there is no broad federal law equivalent to the state-level ones.

### What is the penalty for non-compliance?

Penalties vary by state. Most include civil fines per violation and a private right of action for affected applicants or employees. California and Washington have been particularly active on enforcement.

### How wide can a posted pay range be?

Most states require a "good faith" range. New Jersey is more specific: the spread between minimum and maximum cannot exceed 60% of the minimum. Other states have not codified a numeric cap but enforce reasonableness through litigation and complaint processes.

## Building defensible pay ranges in a transparency-heavy environment?

[Browse salary surveys by industry, geography, and methodology on CompShop.](/surveys)`,
    faq: [
      {
        q: "Which states require pay transparency in 2026?",
        a: "California, Colorado, Connecticut, Hawaii, Illinois, Maine, Maryland, Massachusetts, Minnesota, Nevada, New Jersey, New York, Rhode Island, Vermont, Washington, and Washington D.C. all have active laws. Delaware's law takes effect in 2027. Several major cities have additional or stricter requirements.",
      },
      {
        q: "Does pay transparency apply to remote roles?",
        a: "Generally, yes. If a posting is visible in a covered state or open to candidates from that state, the law typically applies. Vermont, for example, explicitly extends to remote roles tied to a Vermont office.",
      },
      {
        q: "Is there a federal pay transparency law?",
        a: "Not as of 2026. Federal contractors are subject to OFCCP requirements, but there is no broad federal law equivalent to the state-level ones.",
      },
      {
        q: "What is the penalty for non-compliance with pay transparency laws?",
        a: "Penalties vary by state. Most include civil fines per violation and a private right of action for affected applicants or employees. California and Washington have been particularly active on enforcement.",
      },
      {
        q: "How wide can a posted pay range be under pay transparency laws?",
        a: "Most states require a good-faith range. New Jersey is more specific: the spread between minimum and maximum cannot exceed 60% of the minimum. Other states have not codified a numeric cap but enforce reasonableness through litigation and complaint processes.",
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  // Newest first.
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
