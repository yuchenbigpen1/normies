# Context Gathering Strategies

How to gather context before asking clarifying questions. The goal is to avoid asking about things you already know or can infer.

## Strategy 1: Check Conversation History First

**Always do this before asking anything.**

Look for:
- Business goals already stated
- Tools or services mentioned (Stripe, Shopify, Slack, etc.)
- Team size or role mentioned
- Previous decisions or preferences
- Constraints (budget, timeline, existing tools)

**Example:**
```
History: "We use Shopify for our store and Slack for team communication"
Current: "Help me track orders"

→ No need to ask about tools. Proceed with Shopify + Slack context.
```

## Strategy 2: Check Connected Sources

Before asking "what tools do you use?", check what sources are already connected:
- MCP servers reveal existing integrations
- API sources show what services are available
- File system sources indicate local data

**Example:**
```
Connected sources: Stripe, Google Sheets
Current: "I need a revenue report"

→ No need to ask where revenue data is. Use Stripe.
```

## Strategy 3: Infer from Context Clues

Business operators often provide context indirectly:
- Job title implies responsibilities ("I'm the ops manager" → operational metrics)
- Industry implies common needs ("We're an e-commerce business" → orders, revenue, customers)
- Urgency implies priority ("This is for a meeting tomorrow" → quick, simple output)

**Example:**
```
Current: "I need to send our investors a monthly update"

→ Goal is clear: recurring report for investors
→ Can infer: formal, summary-level, probably revenue + growth metrics
→ Only ambiguity: what data to include → ask that one question
```

## Strategy 4: Use the Minimum Question Principle

For each potential question, ask yourself:
1. Can I answer this from conversation history? → Skip it
2. Can I answer this from connected sources? → Skip it
3. Can I reasonably infer the answer? → Skip it
4. Would getting this wrong lead to a very different outcome? → Ask it
5. Can I just proceed and adjust if needed? → Skip it

**Only questions that pass check #4 AND fail checks #1-3 should be asked.**

## Decision Framework

```
User request arrives
  │
  ├─ Check conversation history → Found context? → Use it
  │
  ├─ Check connected sources → Tools available? → Use them
  │
  ├─ Infer from context clues → Can guess confidently? → Proceed
  │
  ├─ Remaining ambiguity → Would it lead to a very different approach?
  │     ├─ No → Just proceed with best guess
  │     └─ Yes → Ask 1-3 focused questions
  │
  └─ All clear → Execute the request
```

## What NOT to Research

- **Technical implementation details** — the user doesn't care how it's built
- **Code architecture** — that's our job, not theirs
- **Library choices** — pick the best one and go
- **API specifics** — use what's available
- **Database schemas** — implementation detail

## What TO Understand

- **Business goal** — what outcome do they want?
- **Audience** — who benefits from this?
- **Existing workflow** — what do they do today?
- **Constraints** — budget, timeline, tool restrictions?
- **Success criteria** — how will they know it's working?

## Summary

1. Always check history and sources before asking
2. Infer when you can reasonably guess
3. Only ask when getting it wrong would lead somewhere very different
4. Focus on business context, never technical details
5. Maximum 3 questions, minimum 0
