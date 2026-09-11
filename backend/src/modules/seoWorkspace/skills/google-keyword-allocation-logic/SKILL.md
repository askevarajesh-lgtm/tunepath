---
name: google-keyword-allocation-logic
description: Guides the AI to emulate Google's keyword allocation logic (semantic analysis, entity recognition, and intent mapping) when evaluating keyword relevance for a domain.
---

# Google Keyword Allocation Logic

When filtering and selecting keywords for a domain, emulate Google's advanced semantic processing algorithms (like BERT and MUM). Google does not merely look for exact string matches; it allocates keywords based on Deep Semantic Relevance, Entity Mapping, and Search Intent.

## 1. Semantic Context & Entity Mapping
- Identify the core "entity" of the target domain. For example, if the domain is a B2B SaaS platform for "WhatsApp API Chatbots", the core entity is "B2B Software/Telecommunications".
- Reject generic keywords that only match a fragment of the entity. (e.g. if the entity is "WhatsApp API", reject generic consumer terms like "whatsapp web", "download whatsapp", or "pick a number").
- Look for keywords that align with the specific industry vertical (e.g. "WhatsApp chatbot for healthcare", "White label WhatsApp API").

## 2. Intent Validation (The Pogo-Sticking Test)
- Emulate Google's user-behavior validation. Ask yourself: "If a user searches this keyword and lands on this domain, will they be satisfied with a B2B software product, or will they bounce back to the search results?"
- If the keyword implies a consumer intent (e.g., "is whatsapp safe", "gb whatsapp") but the domain is B2B, REJECT the keyword immediately. Google will not allocate it long-term due to high bounce rates.

## 3. High-Value vs. Low-Value Association
- Prefer long-tail keywords (3+ words) that indicate specific commercial or informational intent relevant to the product.
- A high-volume generic keyword (e.g. "whatsapp") is extremely low-value for a SaaS product because Google allocates those terms to the official brand domain or Wikipedia. Prioritize hyper-relevant niches.
