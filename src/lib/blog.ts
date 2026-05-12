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
  {
    slug: "best-healthcare-salary-surveys-2026",
    title: "Best Healthcare Salary Surveys for 2026",
    description:
      "An independent guide to the best healthcare salary surveys for 2026: SullivanCotter, MGMA, Mercer IHN/IHP, Gallagher, Pearl Meyer. Picks by use case.",
    date: "2026-05-05",
    readTime: "7 min read",
    author: "CompShop",
    tags: ["Buyer's Guide", "Healthcare"],
    keywords: [
      "best healthcare salary surveys",
      "healthcare compensation surveys 2026",
      "physician compensation survey",
      "nursing salary survey",
      "hospital executive compensation",
      "MGMA vs SullivanCotter",
      "best salary surveys for hospitals",
    ],
    body: `Last verified: May 2026. CompShop is an independent directory and does not take placement fees from survey publishers.

The healthcare compensation market is fragmented across hospital systems, physician practices, nursing, health plans, and specialty settings. No single survey covers everyone well. Here's the short version, then the detail.

## TL;DR by use case

| You're benchmarking... | Start with |
|---|---|
| Physician compensation & productivity | SullivanCotter, MGMA |
| Advanced practice providers (NPs, PAs, CRNAs) | SullivanCotter APP, MGMA |
| Nursing | SullivanCotter Registered Nursing, Gallagher National Nursing |
| Hospital staff & non-clinical | Mercer IHN suite |
| Hospital executives | SullivanCotter Health Care Mgmt & Exec, Pearl Meyer Hospitals & Health Systems |
| Health plans / insurers | Mercer IHP suite |
| Specialty (cancer, children's, behavioral) | Gallagher specialty surveys |

## How to pick

Three questions decide most of it.

### Is your population mostly clinical or mostly support / admin?

Clinical pulls you to SullivanCotter and MGMA. Support and admin go to Mercer IHN or a regional cut from Gallagher.

### Are you a single hospital, a system, a medical group, or a payer?

Each survey is built around one structure. SullivanCotter is system-grade. MGMA is medical-group-native. Mercer IHP is payer-grade.

### Do you need a single source or a layered comp stack?

Most health systems run two to three sources: SullivanCotter or MGMA for clinical, Pearl Meyer or Mercer IHN for executives, and Gallagher for specialty or regional context. A single source rarely covers all three populations defensibly.

## Detailed picks

### SullivanCotter

**Best for:** hospital systems and academic medical centers running a defensible comp program.

**Coverage:** Physician Comp & Productivity, APP Comp & Productivity, Registered Nursing, Health Care Mgmt & Exec, Health Care Staff, Hospital-Based Physician On-Call, Workforce Metrics, Benefits Practices, plus Endowment & Foundation Investment Staff.

**Why it's a top pick:** the most-cited source in physician comp committee minutes. Built around the way health systems actually structure roles.

[See all SullivanCotter reports](/surveys/sullivancotter)

### MGMA

**Best for:** medical groups, physician practices, and provider-comp benchmarking down to specialty and CPT level.

**Coverage:** Provider compensation, productivity, work RVUs, and practice operations.

**Why it's a top pick:** the practice-side counterpart to SullivanCotter. If you're a medical group rather than a system, this is usually your primary source. Many large systems use both.

[See all MGMA reports](/surveys/mgma)

### Mercer (IHN and IHP)

**Best for:** large systems and payers needing breadth across clinical and non-clinical roles.

**Coverage (IHN):** Healthcare Individual Contributors, Advanced Practice Clinicians & Nurses, Healthcare Mgmt & Supervisory, Hospital & System Executives, Home Health & Hospice, Physician Practices & Clinics, Skilled Nursing & Assisted Living, Healthcare Informatics & Technology.

**Coverage (IHP):** Health Plan Executives, Health Plan Operations, Health Plan Sales & Marketing.

**Effective date:** April 1.

**Why it's a top pick:** the most comprehensive one-stop source if you also use the Mercer Benchmark Database for corporate roles. Methodology consistency across clinical and corporate is the unlock.

[See all Mercer reports](/surveys/mercer-benchmark-database)

### Gallagher

**Best for:** specialty and regional benchmarking the national surveys miss.

**Coverage:** National Healthcare Leadership, National Nursing, Physician & Medical Director, Behavioral Health, Cancer Centers, Children's Hospitals, Community Health Centers, Advanced Practice Providers, plus regional cuts (Delaware Valley, Illinois Statewide, Indiana, Midwest Regional, and others).

**Why it's a top pick:** the deepest list for specialty hospitals and regional cuts. If you run a children's hospital or a cancer center, Gallagher is often the only source that benchmarks your true comparator group.

[See all Gallagher reports](/surveys/gallagher)

### Pearl Meyer

**Best for:** hospital and health-system executive compensation, especially board-level pay.

**Coverage:** Hospitals & Health Systems Executive Compensation & Benefits Survey.

**Why it's a top pick:** a comp-committee staple, particularly for not-for-profit health systems where IRS Form 990 disclosures mean exec pay decisions need defensible market data.

[See all Pearl Meyer reports](/surveys/pearl-meyer)

## Comparison at a glance

| Survey | Best for | Effective |
|---|---|---|
| SullivanCotter | Health systems, clinical + exec | Varies by report |
| MGMA | Medical groups, provider productivity | Annual |
| Mercer IHN | Large systems, breadth | April 1 |
| Mercer IHP | Health plans / payers | April 1 |
| Gallagher | Specialty + regional | Varies |
| Pearl Meyer | Hospital executive comp | April 1 |

## FAQ

### What's the difference between MGMA and SullivanCotter?

MGMA is built for the medical-group and physician-practice perspective. It is the standard for productivity benchmarking (wRVUs, collections per FTE, panel size). SullivanCotter is built for the health-system perspective and is the standard for comp-committee defensibility. Most large systems use both.

### Which survey is best for a 200-bed community hospital?

The most common stack is SullivanCotter for clinical and Pearl Meyer or Mercer IHN for executives. Adding a regional cut from Gallagher gives you geographic context for staff and non-clinical roles.

### Which survey covers nurse compensation?

SullivanCotter Registered Nursing and Gallagher National Nursing are the two most-cited dedicated nursing surveys. Mercer IHN includes nurses inside its broader healthcare data. MGMA covers nurses in physician-practice settings.

### Which survey covers advanced practice providers?

SullivanCotter APP Compensation & Productivity is the most-cited dedicated APP survey. Mercer IHN Advanced Practice Clinicians & Nurses covers APPs alongside nurses. MGMA covers APPs in medical-group settings.

### When do healthcare salary surveys publish?

Most publish in spring or early summer. Mercer IHN and IHP have April 1 effective dates. SullivanCotter publishes most surveys in spring. Gallagher schedules vary by report.

### What about free healthcare salary data?

Free sources can give directional numbers but typically lack the role leveling, productivity tie-in, and statistical depth that comp committees expect. They're useful for initial scoping or candidate-side conversations, not for defensible pay decisions or 990 disclosures.

### Do I need more than one survey?

Usually yes. Most health systems run a primary source for clinical (SullivanCotter or MGMA), a primary source for executives (Pearl Meyer, SullivanCotter, or Mercer), and a primary source for staff and non-clinical roles (Mercer IHN or a regional Gallagher cut). Layering two to three sources is the norm.

## How we built this

CompShop is an independent directory. We don't take placement fees from publishers and we don't resell the data. We list every healthcare survey we can verify, with the publisher's pricing model and a direct link to the publisher's product page.

Found a survey that should be on this list? Use the Contact link in the footer to drop us a note.

[Browse all healthcare surveys](/surveys)`,
    faq: [
      {
        q: "What's the difference between MGMA and SullivanCotter?",
        a: "MGMA is built for the medical-group and physician-practice perspective. It is the standard for productivity benchmarking (wRVUs, collections per FTE, panel size). SullivanCotter is built for the health-system perspective and is the standard for comp-committee defensibility. Most large systems use both.",
      },
      {
        q: "Which survey is best for a 200-bed community hospital?",
        a: "The most common stack is SullivanCotter for clinical and Pearl Meyer or Mercer IHN for executives. Adding a regional cut from Gallagher gives you geographic context for staff and non-clinical roles.",
      },
      {
        q: "Which survey covers nurse compensation?",
        a: "SullivanCotter Registered Nursing and Gallagher National Nursing are the two most-cited dedicated nursing surveys. Mercer IHN includes nurses inside its broader healthcare data. MGMA covers nurses in physician-practice settings.",
      },
      {
        q: "Which survey covers advanced practice providers?",
        a: "SullivanCotter APP Compensation & Productivity is the most-cited dedicated APP survey. Mercer IHN Advanced Practice Clinicians & Nurses covers APPs alongside nurses. MGMA covers APPs in medical-group settings.",
      },
      {
        q: "When do healthcare salary surveys publish?",
        a: "Most publish in spring or early summer. Mercer IHN and IHP have April 1 effective dates. SullivanCotter publishes most surveys in spring. Gallagher schedules vary by report.",
      },
      {
        q: "What about free healthcare salary data?",
        a: "Free sources can give directional numbers but typically lack the role leveling, productivity tie-in, and statistical depth that comp committees expect. They're useful for initial scoping or candidate-side conversations, not for defensible pay decisions or 990 disclosures.",
      },
      {
        q: "Do I need more than one healthcare salary survey?",
        a: "Usually yes. Most health systems run a primary source for clinical (SullivanCotter or MGMA), a primary source for executives (Pearl Meyer, SullivanCotter, or Mercer), and a primary source for staff and non-clinical roles (Mercer IHN or a regional Gallagher cut). Layering two to three sources is the norm.",
      },
    ],
  },
  {
    slug: "best-executive-compensation-surveys-2026",
    title: "Best Executive Compensation Surveys for 2026",
    description:
      "An independent guide to the best executive compensation surveys for 2026: Pearl Meyer, Empsight, Mercer Executive, Aon Radford and McLagan, SullivanCotter. Picks by use case, plus proxy data providers.",
    date: "2026-05-12",
    readTime: "9 min read",
    author: "CompShop",
    tags: ["Buyer's Guide", "Executive"],
    keywords: [
      "best executive compensation surveys",
      "executive compensation surveys 2026",
      "Pearl Meyer executive comp survey",
      "Empsight executive compensation",
      "Mercer executive compensation survey",
      "Radford executive equity",
      "McLagan financial services comp",
      "board of director compensation survey",
      "comp committee survey",
      "proxy data Equilar ISS",
    ],
    body: `Last verified: May 2026. CompShop is an independent directory and does not take placement fees from survey publishers.

Executive compensation benchmarking sits in its own category. The data is more granular (separating base, target bonus, LTI grant value, realized pay), the audience is sharper (comp committees, boards, proxy advisors), and the consequences of getting it wrong are bigger (Say-on-Pay results, IRS Form 990 scrutiny, founder dilution). Most general-industry surveys don't cut deeply enough for executive work, which is why exec-comp buyers reach for specialists.

A note on scope: this page covers traditional survey publishers. Public-company exec-comp work also relies on proxy data providers (Equilar, ISS, Glass Lewis) for peer-group benchmarking off DEF 14A filings. We cover those at the end as a complement, not a substitute.

## TL;DR by use case

| You're benchmarking... | Start with |
|---|---|
| Public-company NEOs (CEO, CFO, named officers) | Pearl Meyer, Empsight, plus proxy data (Equilar, ISS) |
| Board / non-employee director compensation | Pearl Meyer, plus proxy data (Equilar) |
| Mid-cap and large-cap corporate executives | Empsight, Mercer Executive Compensation Survey |
| General-industry executive benchmarking | Mercer Executive Compensation Survey |
| Tech / life sciences executives (with equity) | Aon Radford |
| Pre-IPO / PE-backed portfolio company executives | Aon Radford Private Equity Portfolio Company Survey |
| Financial services MDs, partners, and senior executives | Aon McLagan |
| Healthcare executives (hospitals, health systems, AMCs) | SullivanCotter Health Care Mgmt & Exec, Pearl Meyer Hospitals & Health Systems |
| Healthcare physician executives (CMOs, CMIOs) | SullivanCotter Physician Executive |
| Banking and credit union executives | Pearl Meyer Banking, Pearl Meyer Top Credit Unions CEO |

## How to pick

Three questions decide most of it.

### Public company or private / PE / not-for-profit?

Public-company comp committees lean on Pearl Meyer and Empsight for survey data, layered with proxy data from Equilar or ISS for direct peer-group benchmarking. Private and PE-backed companies pull toward Aon Radford (especially for equity and MIP design) and Mercer. Not-for-profit health systems live in SullivanCotter and Pearl Meyer Hospitals & Health Systems for 990-defensible pay.

### What's your industry?

The general-industry surveys (Pearl Meyer Multi-Industry, Mercer Executive) work for cross-sector benchmarking. Tech and life sciences pull toward Radford. Financial services pulls toward McLagan. Healthcare pulls toward SullivanCotter. Industry-specific surveys are nearly always sharper than general-industry cuts at the exec level because the role definitions actually match.

### Are you sizing base + bonus, or also pricing equity?

For base and target bonus, most of the survey market is interchangeable. Equity is where it gets specialized. Radford is the standard for tech and life sciences equity benchmarks (option refresh grants, RSU values, equity-as-percent-of-total-comp). For LTI design in public companies, Pearl Meyer and Mercer both have dedicated long-term incentive practices and survey data.

## Detailed picks

### Pearl Meyer

**Best for:** public-company comp committees, board-of-director compensation, not-for-profit health system executives, banks, and credit unions.

**Coverage:** Banking Compensation Survey, Energy Compensation Survey, Engineering & Construction Compensation Survey, Higher Education Compensation Survey, Hospitals & Health Systems Executive Compensation & Benefits Survey, Multi-Industry Compensation Survey, Real Estate Compensation Survey, Top Credit Unions CEO & Senior Executive Compensation Survey.

**Effective date:** April 1.

**Why it's a top pick:** Pearl Meyer is the survey publisher that comp committees cite most often in defensible exec-pay work. The combination of multi-industry coverage and dedicated industry cuts (banking, healthcare, credit unions, higher ed) means the same publisher can support a full board-level comp review.

[See all Pearl Meyer reports](/surveys/pearl-meyer)

### Empsight

**Best for:** mid-cap and large-cap public companies, especially in the NY metro region and across general industry, financial services, and healthcare supplements.

**Coverage:** Executive Compensation Survey, Executive Administrative Support Compensation Survey, Government Relations & Corporate Communications Compensation Survey, plus industry supplements for Financial Services, Insurance, Manufacturing, Renewable Energy, and Retail / E-Commerce. The Works (Full Access) bundles all of it.

**Effective date:** April 1.

**Why it's a top pick:** Empsight is the inside pick. Comp consultants and corporate comp teams who know the space lean on Empsight for proxy-comparable executive benchmarks and for hard-to-find roles (executive admin, government relations, corporate comms) that the big-three publishers don't price well. Strong NY metro coverage matters for finance and media headquarters.

[See all Empsight reports](/surveys/empsight)

### Mercer Executive Compensation Survey

**Best for:** general-industry executive benchmarking, especially for comp teams already using the Mercer Benchmark Database for non-executive roles.

**Coverage:** US MBD Executive Compensation Survey, plus the Long-Term Incentive & Equity Report, Short-Term Incentive Report, and dedicated exec cuts inside Health Plan Executives, Hospital & System Executives, and the Canadian and global MTRS series.

**Effective date:** April 1.

**Why it's a top pick:** the most comprehensive one-stop source if you also use the Mercer Benchmark Database for the rest of the workforce. Methodology consistency from individual contributor through CEO is the unlock, and the Long-Term Incentive Report adds equity-design context most cross-industry surveys lack.

[See all Mercer reports](/surveys/mercer-benchmark-database)

### Aon (Radford + McLagan)

**Best for:** tech and life sciences executive equity, PE-backed portfolio company exec design, and financial services MD- and partner-level comp.

**Coverage (Radford):** Radford Global Technology Survey, Radford Global Life Sciences Survey, Radford Private Equity Portfolio Company Survey, Radford Global Tech Survey (Startup Cut), Radford Global Sales Compensation Survey, Radford Cybersecurity Compensation Survey.

**Coverage (McLagan):** McLagan Investment Banking, Asset Management, Hedge Fund, Private Equity & Private Capital, Insurance, Retail Banking, Commercial Banking, Broker-Dealer, and Fintech Compensation Surveys.

**Effective dates:** April 1 and October 1 (semi-annual).

**Why it's a top pick:** if your executives are paid heavily in equity (tech, life sciences, pre-IPO, PE-backed), Radford's depth on option refresh grants, RSU values, MIP design, and stage-based leveling is unmatched. McLagan is the same story for financial services MDs and partners, where bonus pools and carried-interest mechanics drive total comp.

[See all Aon reports](/surveys/radford-mclagan)

### SullivanCotter

**Best for:** not-for-profit health systems, academic medical centers, and physician-executive compensation.

**Coverage:** Health Care Management & Executive Compensation Survey, Medical Group Executive Compensation Survey, Physician Executive Compensation Survey.

**Why it's a top pick:** for not-for-profit health system board comp committees navigating IRS Form 990 disclosures and intermediate-sanctions analysis, SullivanCotter is the standard. It is also the dominant source for physician executive roles (CMO, CMIO, Chief of Service) where general-industry surveys don't level the role correctly.

[See all SullivanCotter reports](/surveys/sullivancotter)

## Comparison at a glance

| Survey | Best for | Effective |
|---|---|---|
| Pearl Meyer | Public-company comp committees, multi-industry + dedicated industry cuts | April 1 |
| Empsight | Mid-cap and large-cap public companies, NY metro, hard-to-price exec roles | April 1 |
| Mercer Executive | General industry, methodology consistency with rest of workforce | April 1 |
| Aon Radford | Tech / life sciences equity, PE-backed portfolio companies | April 1 / October 1 |
| Aon McLagan | Financial services MDs, partners, senior executives | April 1 / October 1 |
| SullivanCotter | Not-for-profit health systems, physician executives | Varies by report |

## Beyond surveys: proxy data providers

Survey data and proxy data are different products that serve the same buyer. Survey data is confidential, role-leveled, and covers public and private companies across the full executive pyramid. Proxy data is sourced from public-disclosure filings (DEF 14A), covers only the top five named executive officers, and is limited to public companies. Comp committees use both: surveys for role-level benchmarks and proxy data for direct peer comparability and Say-on-Pay risk modeling.

The four most-cited proxy data providers:

- **Equilar** (TrueView, ExecAtlas, Equilar Insight). The most widely used proxy data platform for public-company comp work. Strong on peer-group construction, pay-for-performance modeling, and non-employee director compensation.
- **ISS Corporate Solutions** (Compensation Analytics, ExecComp Analyzer). Run by the same parent as the ISS proxy advisor that influences Say-on-Pay vote recommendations. Many comp teams subscribe specifically to model how ISS will view their proposed pay design before it goes to a shareholder vote.
- **Glass Lewis** (Compensation Insights). The second major proxy advisor with its own data services. Often paired with ISS for full Say-on-Pay risk coverage and contrarian-vote-risk analysis.
- **Main Data Group**. A mid-market alternative with strong director compensation and benefits coverage at a lower price point than Equilar.

These are not survey publishers and they are not listed on CompShop's main directory. They are the natural complement to the publishers above. Most public-company executive comp work pairs one to two surveys with one to two proxy providers: surveys for the role-level benchmarks (CFO, COO, division presidents) and proxy data for the NEO-level peer comparison the board's comp committee will actually vote on.

## FAQ

### What's the difference between Pearl Meyer and Mercer for executive compensation?

Pearl Meyer is a comp-committee-first publisher. Its surveys are built around the cuts a public-company board or a not-for-profit comp committee needs: named-officer benchmarks, board pay, industry-specific proxy peers. Mercer's Executive Compensation Survey is built on top of the Mercer Benchmark Database, which means it gives you methodology consistency from individual contributor through CEO. Many large companies use both: Mercer for cross-workforce calibration and Pearl Meyer for the comp-committee book.

### Which survey is best for a private company benchmarking executive compensation?

The most common stack is Mercer Executive for general-industry benchmarks plus an industry-specific source. If you're tech or life sciences, add Radford for equity. If you're financial services, add McLagan. Empsight covers mid-cap and large-cap private companies (especially in NY metro) and is often the inside pick for fast-growing private companies that out-grew startup-stage benchmarks.

### Which survey is best for a PE-backed portfolio company?

Radford's Private Equity Portfolio Company Survey is built for this. It covers compensation benchmarks across PE-backed portfolio companies with emphasis on equity design, MIP (management incentive plan) structures, and exit-linked compensation. Mercer Executive provides corporate-side context. McLagan covers the sponsor (PE firm) side if you also benchmark the deal team.

### Which survey covers board / non-employee director compensation?

Pearl Meyer is the most-cited survey source for non-employee director compensation, especially for public companies. For public-company director work, Pearl Meyer is typically paired with proxy data from Equilar, which pulls director pay directly from DEF 14A filings across a proxy-comparable peer group.

### Which survey covers equity grants and long-term incentives?

For tech and life sciences, Radford is the standard. The Global Technology and Global Life Sciences surveys go deep on option grants, RSU values, equity-as-percent-of-total-comp, and stage-based leveling for pre-IPO companies. Mercer's Long-Term Incentive & Equity Report covers public-company LTI design across general industry. Pearl Meyer's multi-industry survey reports LTI prevalence and grant values for proxy-comparable companies.

### Which survey is best for healthcare executive compensation?

SullivanCotter Health Care Management & Executive Compensation Survey is the standard for hospital and health-system executives. Pearl Meyer Hospitals & Health Systems Executive Compensation & Benefits Survey is the second source most comp committees layer on top. For physician executives specifically (CMO, CMIO, Chief of Service), SullivanCotter Physician Executive is the dedicated source.

### Which survey is best for financial services executive compensation?

McLagan covers nearly every sub-segment: Investment Banking, Asset Management, Hedge Fund, Private Equity, Insurance, Retail Banking, Commercial Banking, Broker-Dealer, and Fintech. The specific report depends on your business. Pearl Meyer Banking covers community and regional banks. For credit union executives, Pearl Meyer Top Credit Unions CEO is the standard.

### How is CEO pay benchmarked?

Public-company CEO pay is typically benchmarked against a proxy-disclosed peer group (revenue and industry comparable). Proxy data providers (Equilar, ISS Corporate Solutions, Glass Lewis) pull NEO comp directly from DEF 14A filings to build that peer view. Survey publishers (Pearl Meyer, Empsight, Mercer Executive) layer on top with role-level base, target bonus, and LTI grant-value benchmarks that proxy data alone can lag on. Most committees triangulate among at least two surveys and one or two proxy providers.

### Do I need both a survey and a proxy data provider?

For public-company work, almost always yes. The survey gives you role-level benchmarks for the full executive team (CFO, COO, CHRO, division leadership) and design context for LTI structures. The proxy data gives you direct peer-comparability for the top five named executive officers and the Say-on-Pay risk modeling the board's comp committee will want before voting. For private-company and PE-backed work, survey data alone is usually enough since there is no DEF 14A to pull from.

### Do I need more than one executive compensation survey?

Almost always yes. A typical exec-comp project uses one general-industry source (Pearl Meyer Multi-Industry or Mercer Executive) plus one industry-specific source (Radford for tech, McLagan for financial services, SullivanCotter for healthcare). For public-company board work, proxy data from Equilar or ISS is layered on top. For PE-backed and pre-IPO work, equity benchmarks from Radford typically sit alongside a corporate-side survey.

## How we built this

CompShop is an independent directory. We don't take placement fees from publishers and we don't resell the data. We list every executive compensation survey we can verify, with the publisher's pricing model and a direct link to the publisher's product page.

Working on a comp-committee book or a private-company exec review? The publishers above are the foundation. For public companies, pair with proxy data from Equilar, ISS, or Glass Lewis. For PE-backed and pre-IPO work, layer Radford equity benchmarks on top.

Found a survey that should be on this list? Use the Contact link in the footer to drop us a note.

[Browse all executive compensation surveys](/surveys?category=executive)`,
    faq: [
      {
        q: "What's the difference between Pearl Meyer and Mercer for executive compensation?",
        a: "Pearl Meyer is a comp-committee-first publisher. Its surveys are built around the cuts a public-company board or a not-for-profit comp committee needs: named-officer benchmarks, board pay, industry-specific proxy peers. Mercer's Executive Compensation Survey is built on top of the Mercer Benchmark Database, which means it gives you methodology consistency from individual contributor through CEO. Many large companies use both: Mercer for cross-workforce calibration and Pearl Meyer for the comp-committee book.",
      },
      {
        q: "Which survey is best for a private company benchmarking executive compensation?",
        a: "The most common stack is Mercer Executive for general-industry benchmarks plus an industry-specific source. If you're tech or life sciences, add Radford for equity. If you're financial services, add McLagan. Empsight covers mid-cap and large-cap private companies (especially in NY metro) and is often the inside pick for fast-growing private companies that out-grew startup-stage benchmarks.",
      },
      {
        q: "Which survey is best for a PE-backed portfolio company?",
        a: "Radford's Private Equity Portfolio Company Survey is built for this. It covers compensation benchmarks across PE-backed portfolio companies with emphasis on equity design, MIP (management incentive plan) structures, and exit-linked compensation. Mercer Executive provides corporate-side context. McLagan covers the sponsor (PE firm) side if you also benchmark the deal team.",
      },
      {
        q: "Which survey covers board or non-employee director compensation?",
        a: "Pearl Meyer is the most-cited survey source for non-employee director compensation, especially for public companies. For public-company director work, Pearl Meyer is typically paired with proxy data from Equilar, which pulls director pay directly from DEF 14A filings across a proxy-comparable peer group.",
      },
      {
        q: "Which survey covers equity grants and long-term incentives?",
        a: "For tech and life sciences, Radford is the standard. The Global Technology and Global Life Sciences surveys go deep on option grants, RSU values, equity-as-percent-of-total-comp, and stage-based leveling for pre-IPO companies. Mercer's Long-Term Incentive & Equity Report covers public-company LTI design across general industry. Pearl Meyer's multi-industry survey reports LTI prevalence and grant values for proxy-comparable companies.",
      },
      {
        q: "Which survey is best for healthcare executive compensation?",
        a: "SullivanCotter Health Care Management & Executive Compensation Survey is the standard for hospital and health-system executives. Pearl Meyer Hospitals & Health Systems Executive Compensation & Benefits Survey is the second source most comp committees layer on top. For physician executives specifically (CMO, CMIO, Chief of Service), SullivanCotter Physician Executive is the dedicated source.",
      },
      {
        q: "Which survey is best for financial services executive compensation?",
        a: "McLagan covers nearly every sub-segment: Investment Banking, Asset Management, Hedge Fund, Private Equity, Insurance, Retail Banking, Commercial Banking, Broker-Dealer, and Fintech. The specific report depends on your business. Pearl Meyer Banking covers community and regional banks. For credit union executives, Pearl Meyer Top Credit Unions CEO is the standard.",
      },
      {
        q: "How is CEO pay benchmarked?",
        a: "Public-company CEO pay is typically benchmarked against a proxy-disclosed peer group (revenue and industry comparable). Proxy data providers (Equilar, ISS Corporate Solutions, Glass Lewis) pull NEO comp directly from DEF 14A filings to build that peer view. Survey publishers (Pearl Meyer, Empsight, Mercer Executive) layer on top with role-level base, target bonus, and LTI grant-value benchmarks that proxy data alone can lag on. Most committees triangulate among at least two surveys and one or two proxy providers.",
      },
      {
        q: "Do I need both a survey and a proxy data provider?",
        a: "For public-company work, almost always yes. The survey gives you role-level benchmarks for the full executive team (CFO, COO, CHRO, division leadership) and design context for LTI structures. The proxy data gives you direct peer-comparability for the top five named executive officers and the Say-on-Pay risk modeling the board's comp committee will want before voting. For private-company and PE-backed work, survey data alone is usually enough since there is no DEF 14A to pull from.",
      },
      {
        q: "Do I need more than one executive compensation survey?",
        a: "Almost always yes. A typical exec-comp project uses one general-industry source (Pearl Meyer Multi-Industry or Mercer Executive) plus one industry-specific source (Radford for tech, McLagan for financial services, SullivanCotter for healthcare). For public-company board work, proxy data from Equilar or ISS is layered on top. For PE-backed and pre-IPO work, equity benchmarks from Radford typically sit alongside a corporate-side survey.",
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
