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
];

export function getAllPosts(): BlogPost[] {
  // Newest first.
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
