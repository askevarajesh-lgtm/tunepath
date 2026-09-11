---
name: keyword-research
version: "1.0"
description: >
  Comprehensive keyword research methodology — from seed discovery through
  intent classification and prioritised opportunity ranking.
---

# Skill: Keyword Research

## Purpose
Guide the AI to systematically discover, evaluate, and prioritise target keywords
for a given website or project. Output must be structured, actionable, and directly
usable for content planning, on-page SEO, and rank-tracking.

---

## Core Methodology

### 1. Seed Discovery
- Start with the project domain/name and any seed keyword provided.
- Expand using common modifier patterns: intent prefixes (best, how to, buy, review),
  location modifiers, industry synonyms, and question-form variants (who, what, when, where, why).
- Extract candidate terms from the visible homepage text and meta description when available.

### 2. Volume & Difficulty Estimation
When exact data providers (DataForSEO, SEMrush) are unavailable, use relative estimation:
- **High volume**: widely searched commercial/informational phrases (likely > 1 000 searches/month)
- **Medium volume**: niche-specific phrases (100–1 000/month)
- **Low volume**: long-tail, highly specific (< 100/month)
- **Difficulty**: rate 0–100 based on competition level, domain authority needed, and SERP feature density.

### 3. Intent Classification
Classify every keyword into exactly one intent category:
| Intent | Signal words | Use case |
|---|---|---|
| `informational` | how to, what is, guide, tips | Blog / educational content |
| `commercial` | best, vs, review, top | Comparison / review pages |
| `transactional` | buy, price, order, hire, get | Landing / product pages |
| `navigational` | brand name, login, contact | Brand / homepage |

### 4. Opportunity Scoring (0–100)
Calculate a composite opportunity score:
```
opportunityScore = (volumeScore × 0.4) + (difficultyInverse × 0.35) + (intentRelevance × 0.25)
```
- `volumeScore`: 100 × (volume / maxVolume in set)
- `difficultyInverse`: 100 − difficulty
- `intentRelevance`: bonus +20 if transactional, +10 if commercial

### 5. Cluster Grouping
Group keywords by semantic theme. Each cluster should have:
- A primary/head keyword (highest volume, most general)
- 2–5 supporting long-tail keywords
- A recommended content type (blog post, landing page, FAQ, product page)

---

## Output Format

Return a JSON object with this structure:

```json
{
  "suggestedKeywords": [
    {
      "keyword": "example keyword",
      "intent": "informational",
      "estimatedVolume": 2400,
      "difficulty": 38,
      "opportunityScore": 71,
      "cluster": "getting started"
    }
  ],
  "clusters": [
    {
      "clusterName": "getting started",
      "primaryKeyword": "example keyword",
      "contentType": "blog_post",
      "keywords": ["example keyword", "long tail variant"]
    }
  ],
  "topOpportunities": ["example keyword"],
  "rationale": "Brief explanation of strategy"
}
```

---

## Quality Rules
- Return a minimum of 10 and maximum of 20 unique keywords per run.
- Do NOT return keyword duplicates (case-insensitive).
- Each keyword must be 2–6 words long.
- Reject single-word generic terms (e.g. "seo", "marketing").
- Prioritise keywords where the project website can realistically rank within 6 months.
