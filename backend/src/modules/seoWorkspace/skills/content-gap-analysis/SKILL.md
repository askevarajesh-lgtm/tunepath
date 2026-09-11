---
name: content-gap-analysis
version: "1.0"
description: >
  Identify topics and keywords that competitor sites cover but the target site
  does not — generating a prioritised list of content opportunities.
---

# Skill: Content Gap Analysis

## Purpose
Systematically compare the target website's existing content coverage against
competitor content footprints to reveal high-value gaps the AI agent should
recommend closing.

---

## Core Methodology

### 1. Baseline Inventory
- Collect all known topic areas, categories, and keywords currently targeted or
  ranking for the project website (from crawler data, existing keywords, or domain analysis).
- Organise into topic clusters (e.g. "technical guides", "product comparisons").

### 2. Competitor Benchmarking
For each known or assumed competitor domain:
- Identify their top content categories (inferred from domain niche and common industry topics).
- Flag topics/keyword clusters where competitors likely publish content that the
  target site does not.

### 3. Gap Identification Rules
A **content gap** exists when:
- A topic cluster is commercially or informationally relevant to the project's niche, AND
- The target site has no known content targeting keywords in that cluster, AND
- At least one competitor (real or assumed) would logically cover that topic.

### 4. Gap Prioritisation Matrix

| Priority | Volume potential | Difficulty | Intent | Action |
|---|---|---|---|---|
| P1 — Quick Win | Medium–High | Low–Medium | transactional/commercial | Create immediately |
| P2 — Strategic | High | Medium–High | informational | Plan within 90 days |
| P3 — Long-term | Low | Any | any | Backlog |

### 5. Recommended Content Types
For each gap, recommend the most appropriate format:
- `long_form_blog` — informational intent, 1 500+ words
- `comparison_page` — commercial intent, feature table + pros/cons
- `landing_page` — transactional intent, CTA-driven
- `faq_page` — question-form keywords, featured-snippet optimised
- `category_page` — broad topic hubs

---

## Output Format

```json
{
  "contentGaps": [
    {
      "topic": "Topic cluster name",
      "exampleKeywords": ["keyword a", "keyword b"],
      "estimatedVolumePotential": "high",
      "difficulty": "medium",
      "priority": "P1",
      "recommendedContentType": "long_form_blog",
      "rationale": "Why this gap matters"
    }
  ],
  "summary": {
    "totalGapsIdentified": 8,
    "p1Gaps": 3,
    "p2Gaps": 4,
    "p3Gaps": 1
  }
}
```

---

## Quality Rules
- Identify a minimum of 5 content gaps per analysis.
- Every gap must include at least 2 example keywords.
- Prioritisation must be consistent — P1 gaps should always have low-to-medium
  difficulty and medium-to-high volume potential.
- Do not invent competitor data — infer from industry norms and topic relevance.
