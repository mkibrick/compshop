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
];

export function getAllPosts(): BlogPost[] {
  // Newest first.
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
