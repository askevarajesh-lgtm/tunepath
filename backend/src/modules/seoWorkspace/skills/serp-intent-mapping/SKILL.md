---
name: serp-intent-mapping
version: "1.0"
description: >
  Analyse SERP features and ranking patterns to map search intent signals
  and determine the optimal content format for each target keyword.
---

# Skill: SERP Intent Mapping

## Purpose
Interpret SERP signals to understand what Google believes users want for a given
query, enabling the AI agent to recommend the right content format, depth, and
structure to outrank competitors.

---

## Core Methodology

### 1. SERP Feature Signal Interpretation

Map each SERP feature to an intent signal:

| SERP Feature | Dominant Intent | Content Implication |
|---|---|---|
| Featured Snippet (paragraph) | Informational | Direct answer, 40–60 words |
| Featured Snippet (list) | Informational | Step-by-step, numbered lists |
| Featured Snippet (table) | Informational/commercial | Comparison tables |
| People Also Ask | Informational | FAQ section with sub-questions |
| Shopping Ads | Transactional | Product page with schema |
| Knowledge Panel | Navigational | Entity/brand content |
| Video Carousel | Informational | Video + transcript content |
| Local Pack | Local transactional | NAP + local landing page |
| Image Pack | Informational/commercial | Visual content + alt text |
| Top Stories | Informational/news | Timely blog content |

### 2. Intent Confidence Scoring

For each keyword, score intent confidence (0–100):
- **≥ 80**: Dominant intent is clear — optimise content 100% for that intent.
- **50–79**: Mixed intent — create content that serves primary intent with secondary intent sections.
- **< 50**: Ambiguous — create comprehensive content covering multiple angles.

### 3. Content Format Recommendation Matrix

Based on intent mapping, recommend:

```
informational + paragraph snippet → long-form blog (1 500–3 000 words)
informational + list snippet      → how-to guide with numbered steps
commercial + comparison signals   → vs/comparison page with feature table
transactional + shopping results  → product/service landing page
local + local pack               → local service page with NAP schema
navigational                     → brand/homepage optimisation
```

### 4. Competitive Content Gap via SERP

Identify:
- **Format gap**: Are the top results all text? A video or infographic could rank.
- **Depth gap**: Are the top results thin (< 800 words)? Longer comprehensive content can displace them.
- **Freshness gap**: Are all top results 2+ years old? Fresh content with updated data can compete.
- **Feature gap**: Is there no featured snippet? Structure content to capture it.

---

## Output Format

```json
{
  "serpIntentMap": [
    {
      "keyword": "example keyword",
      "dominantIntent": "informational",
      "intentConfidence": 85,
      "detectedSerpFeatures": ["featured_snippet_paragraph", "people_also_ask"],
      "recommendedFormat": "long_form_blog",
      "recommendedWordCount": 2000,
      "featuredSnippetOpportunity": true,
      "competitiveGap": "Thin content gap — top results under 900 words",
      "actionableAdvice": "Write a comprehensive how-to guide targeting the featured snippet position"
    }
  ],
  "overallIntentProfile": {
    "informational": 60,
    "commercial": 25,
    "transactional": 10,
    "navigational": 5
  }
}
```

---

## Quality Rules
- Every keyword must receive exactly one dominant intent classification.
- Featured snippet opportunity must be flagged when confidence > 70 AND a paragraph snippet is detected.
- Word count recommendations must be realistic (500–5 000 words range).
- Competitive gap insights must be specific and actionable, not generic.
