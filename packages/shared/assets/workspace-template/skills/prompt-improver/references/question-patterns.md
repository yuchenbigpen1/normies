# Question Patterns for Business Clarification

Templates and best practices for asking focused, business-relevant questions to non-technical users.

## Question Construction Principles

1. **Use Plain Language**: No code, APIs, or technical jargon
   - Bad: "Which API endpoint should we use?"
   - Good: "What data do you need to see?"

2. **Provide Concrete Options**: Multiple choice beats open-ended
   - Bad: "What do you want?"
   - Good: "Which of these best describes your goal?"

3. **Stay Focused**: One decision per question
   - Bad: "What and how often?"
   - Good: "What information?" (separate question for frequency)

4. **Keep it Brief**: One sentence max per option description

5. **Offer 2-4 Options**: Fewer than 2 isn't a choice, more than 4 is overwhelming

## AskUserQuestion Tool Format

```json
{
  "question": "Clear business question ending with ?",
  "header": "Short label (max 12 chars)",
  "multiSelect": false,
  "options": [
    {
      "label": "Plain language (1-5 words)",
      "description": "What this means for them (one sentence)"
    }
  ]
}
```

### Field Guidelines

**question:** Conversational, ending with `?`. No technical terms.
- "What outcome are you looking for?"
- "Who will use this?"
- "How often does this need to happen?"

**header:** Max 12 characters. Plain noun or noun phrase.
- "Goal" (4 chars)
- "Audience" (8 chars)
- "Frequency" (9 chars)
- "Data source" (11 chars)

**multiSelect:** Almost always `false`. Use `true` only when choices aren't mutually exclusive.

**options:** 2-4 per question. Each has `label` and `description`.

**label:** 1-5 words, scannable, non-technical.
- "Track sales numbers"
- "Notify my team"
- "Weekly email summary"

**description:** One sentence explaining what this means for them.
- "See how much revenue comes in each day, week, and month"
- "Get a Slack message whenever a new order comes in"

## Question Templates by Category

### Goal Clarification

**When:** The user's objective could mean very different things

```json
{
  "question": "What are you trying to accomplish?",
  "header": "Goal",
  "multiSelect": false,
  "options": [
    {
      "label": "Track customer activity",
      "description": "See what customers are doing — purchases, support requests, engagement"
    },
    {
      "label": "Reach out to customers",
      "description": "Send emails, messages, or notifications to customers"
    },
    {
      "label": "Analyze customer trends",
      "description": "Understand patterns like churn, growth, or seasonal changes"
    }
  ]
}
```

### Audience / Scale

**When:** Unclear who will use this or how many people are involved

```json
{
  "question": "Who will use this?",
  "header": "Audience",
  "multiSelect": false,
  "options": [
    {
      "label": "Just me",
      "description": "A personal tool for your own use"
    },
    {
      "label": "My team (2-10 people)",
      "description": "Shared with a small group who work together"
    },
    {
      "label": "The whole company",
      "description": "Available to everyone in the organization"
    },
    {
      "label": "External customers",
      "description": "Something your customers or clients will interact with"
    }
  ]
}
```

### Data Source

**When:** Unclear where the information lives

```json
{
  "question": "Where does this data currently live?",
  "header": "Data source",
  "multiSelect": true,
  "options": [
    {
      "label": "Spreadsheets",
      "description": "Google Sheets, Excel, or CSV files"
    },
    {
      "label": "An existing tool",
      "description": "Like Stripe, Shopify, HubSpot, or another service"
    },
    {
      "label": "Email or messages",
      "description": "Information that comes in through email, Slack, etc."
    },
    {
      "label": "I'm not sure",
      "description": "The data isn't organized anywhere yet"
    }
  ]
}
```

### Frequency / Timing

**When:** Unclear how often something needs to happen

```json
{
  "question": "How often should this run?",
  "header": "Frequency",
  "multiSelect": false,
  "options": [
    {
      "label": "Immediately each time",
      "description": "Triggered right when something happens"
    },
    {
      "label": "Daily summary",
      "description": "A once-a-day recap of what happened"
    },
    {
      "label": "Weekly report",
      "description": "A summary sent at the end of each week"
    },
    {
      "label": "On demand",
      "description": "Only when someone asks for it"
    }
  ]
}
```

### Output / Delivery

**When:** Unclear how the user wants to receive results

```json
{
  "question": "How would you like to see the results?",
  "header": "Output",
  "multiSelect": false,
  "options": [
    {
      "label": "Dashboard",
      "description": "A visual page with charts and numbers you can check anytime"
    },
    {
      "label": "Slack message",
      "description": "Delivered to a Slack channel automatically"
    },
    {
      "label": "Email",
      "description": "Sent to your inbox on a schedule"
    },
    {
      "label": "Spreadsheet",
      "description": "Exported to a Google Sheet or CSV you can work with"
    }
  ]
}
```

## Number of Questions Guidelines

### 1 Question: Simple Clarification

**Use when:** One clear ambiguity. Everything else is obvious.

Example: "Build me a dashboard" → Ask what data it should show.

### 2 Questions: Two Unknowns

**Use when:** Goal is partially clear but missing a key piece.

Example: "Help with customer tracking" → Ask what to track + who sees it.

### 3 Questions: Maximum

**Use when:** Request is genuinely vague with multiple possible directions.

Example: "Automate something for my business" → Ask what, how often, and where data lives.

**Never exceed 3 questions.** If the request is so vague you'd need more, the single most important question is probably "What outcome are you looking for?"

## Common Pitfalls

### Using Technical Language

**Bad:** "Which API should we integrate with?"
**Good:** "Which service has the data you need?"

### Asking About Implementation

**Bad:** "Should we use a cron job or webhook?"
**Good:** "Should this happen automatically or when you ask for it?"

### Too Many Options

**Bad:** 6 options covering every edge case
**Good:** 3-4 options covering the most likely scenarios. "Something else" is always available.

### Leading Questions

**Bad:** "Would you like the recommended dashboard approach?"
**Good:** "How would you like to see the results?"

### Asking What You Can Infer

**Bad:** Asking about team size when the user already said "my team of 5"
**Good:** Skipping that question and just proceeding

## Checklist

Before asking questions:

- [ ] Checked conversation history for answers already given
- [ ] Each question is in plain, non-technical language
- [ ] Options are concrete and scannable
- [ ] Descriptions are one sentence max
- [ ] Total questions: 1-3
- [ ] Each question has 2-4 options
- [ ] Header is 12 characters or fewer
- [ ] Question ends with `?`

**Remember:** Most prompts should pass through without questions. Only truly ambiguous requests need clarification. When in doubt, just proceed.
