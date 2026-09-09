---
name: roadmap-roi-planning
version: "1.0"
description: >
  Build a prioritised SEO content and technical roadmap with estimated ROI
  for each initiative, enabling data-driven resource allocation.
---

# Skill: Roadmap & ROI Planning

## Purpose
Translate SEO analysis findings (keyword gaps, content gaps, technical issues,
competitor threats) into a concrete, time-phased execution roadmap with estimated
return-on-investment metrics to justify priorities and resource allocation.

---

## Core Methodology

### 1. Initiative Categorisation

Group all identified SEO opportunities into initiative types:

| Type | Examples | Typical timeline |
|---|---|---|
| Quick Win | Fix meta descriptions, title tags | 1–2 weeks |
| Content Creation | New blog post, landing page | 2–4 weeks |
| Technical Fix | Core Web Vitals, crawl errors | 1–4 weeks |
| Content Refresh | Update outdated articles | 1–2 weeks |
| Authority Building | Earn/create link-worthy assets | 4–12 weeks |
| Strategic Content | Comprehensive pillar pages | 4–8 weeks |

### 2. Effort Estimation

Assign effort points (1–5 scale):

| Effort Level | Points | Description |
|---|---|---|
| Trivial | 1 | Config change, meta tag update |
| Low | 2 | Short-form content (< 800 words) |
| Medium | 3 | Standard blog post (800–2 000 words) |
| High | 4 | Long-form content (2 000+ words) or technical audit |
| Very High | 5 | Pillar page, site architecture change |

### 3. Impact Scoring

Estimate organic traffic impact potential (1–5):

| Impact Level | Score | Expected lift |
|---|---|---|
| Minimal | 1 | < 5% traffic increase |
| Low | 2 | 5–15% traffic increase |
| Moderate | 3 | 15–35% traffic increase |
| High | 4 | 35–75% traffic increase |
| Transformative | 5 | > 75% traffic increase |

### 4. ROI Priority Formula

```
priorityScore = (impact² / effort) × confidenceMultiplier

where:
  confidenceMultiplier = 1.2 (if data-backed) | 1.0 (if estimated) | 0.8 (if speculative)
```

### 5. Roadmap Phasing

Organise initiatives into 3 phases:

- **Phase 1 (0–30 days)**: Quick wins with priorityScore ≥ 8
- **Phase 2 (31–90 days)**: Medium-effort, high-impact initiatives  
- **Phase 3 (91+ days)**: Strategic long-term investments

### 6. ROI Estimation

For each initiative, estimate:
- **Traffic uplift**: Additional monthly organic visits expected
- **Revenue impact**: If conversion rate and revenue per visitor are known; otherwise provide a relative index
- **Payback period**: Estimated weeks until investment is recovered

---

## Output Format

```json
{
  "roadmap": [
    {
      "initiative": "Optimise title tags and meta descriptions for 10 key pages",
      "type": "Quick Win",
      "effort": 1,
      "impact": 2,
      "priorityScore": 9.6,
      "phase": 1,
      "estimatedTimelineWeeks": 1,
      "estimatedTrafficUplift": "5–10%",
      "rationale": "High-confidence, zero-cost improvement immediately visible in SERPs"
    }
  ],
  "summary": {
    "totalInitiatives": 12,
    "phase1Count": 4,
    "phase2Count": 5,
    "phase3Count": 3,
    "estimatedTotalTrafficUplift": "40–70%",
    "estimatedTimeToFirstResults": "2–4 weeks"
  },
  "investmentPriority": "Focus Phase 1 on technical quick-wins and high-ROI content gaps. Phase 2 should prioritise pillar content that supports the topical authority strategy."
}
```

---

## Quality Rules
- Every initiative must have an assigned phase (1, 2, or 3).
- Phase 1 must only contain items with priorityScore ≥ 6.
- Effort and impact scores must be integers between 1 and 5.
- Roadmap must contain at minimum 6 and maximum 20 initiatives.
- Traffic uplift estimates must be presented as ranges, not exact numbers.
- Never promise specific revenue figures without explicit conversion data.
