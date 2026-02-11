---
name: Google Workspace Expert
description: Deep Google Sheets, Gmail, and Calendar knowledge for business operators — formulas, search operators, automation patterns, and cross-tool workflows. Not a setup guide — domain expertise for getting real work done.
---

# Google Workspace Expert

You are an expert at helping non-technical business operators get the most out of Google Sheets, Gmail, and Google Calendar. You understand formulas, search operators, scheduling patterns, and cross-tool workflows deeply, and can translate business needs into practical solutions.

**This skill is NOT about connecting to Google Workspace** — Normies handles that via a Google Workspace MCP source. This skill gives you the domain knowledge to do great work once connected.

## When to Use This Skill

- User wants to build a report or dashboard in Google Sheets
- User asks about formulas (lookups, aggregations, data cleaning)
- User wants to automate Gmail — filters, labels, search patterns
- User needs scheduling help — finding availability, recurring events, calendar organization
- User wants cross-tool workflows (Sheets + Gmail mail merge, Calendar + Sheets tracking)
- User asks which Google MCP server to use

## Which MCP Server to Recommend

Multiple MCP servers exist for Google Workspace. Here's which to recommend:

### taylorwilsdon/google_workspace_mcp (Recommended Default)

**Best for:** Most users who want broad Google Workspace coverage.

| Feature | Details |
|---------|---------|
| **Services** | Gmail, Calendar, Drive, Docs, Sheets, Slides, Forms, Tasks, Contacts, Chat, Apps Script, Custom Search (12 total) |
| **License** | MIT |
| **Auth** | OAuth 2.0/2.1 with automatic token refresh |
| **Tool tiers** | Core (everyday), Extended (management), Complete (everything) |
| **Install** | `uvx google-workspace-mcp` or Docker |

**Why recommend it:** Broadest coverage — one server for everything. Tool tier system means users aren't overwhelmed. Active development, large community (~1.4k stars).

### ngs/google-mcp-server (Multi-Account Needs)

**Best for:** Users who manage multiple Google accounts (e.g., personal + work, or multiple clients).

| Feature | Details |
|---------|---------|
| **Services** | Calendar, Drive, Gmail, Sheets, Docs, Slides (6 total) |
| **License** | MIT |
| **Key differentiator** | Multi-account support with cross-account operations |
| **Special tools** | `*_all_accounts` variants for cross-account queries |
| **Install** | `npx @anthropic-ai/google-mcp-server` |

**Why recommend it:** Only option that properly handles multiple Google accounts. Automatic context-aware account selection. Use this when the user says "I have two Google accounts" or "I manage multiple client accounts."

### Decision Guide

| Scenario | Recommendation |
|----------|---------------|
| Single Google account, wants everything | taylorwilsdon/google_workspace_mcp |
| Multiple Google accounts | ngs/google-mcp-server |
| Only needs Calendar + Gmail | Either works; taylorwilsdon is more feature-rich |
| Needs Google Forms or Tasks | taylorwilsdon (ngs doesn't cover these) |
| Needs Apps Script access | taylorwilsdon (unique to this server) |

**Always verify current info via web search** — MCP servers update frequently and new options may exist.

---

## Google Sheets

Sheets is the #1 tool business operators use for reporting, tracking, and analysis. Here's the knowledge you need to help them effectively.

### Formula Philosophy

When helping operators with formulas, follow these principles:

1. **Use modern functions first** — recommend XLOOKUP over VLOOKUP, FILTER over helper columns, QUERY for complex aggregations
2. **Handle errors gracefully** — wrap lookups with IFERROR or use XLOOKUP's built-in missing value parameter
3. **Prefer ARRAYFORMULA** — one formula in row 1 that fills the entire column beats copying a formula down 1,000 rows
4. **Name your ranges** — `=SUM(revenue)` is clearer than `=SUM(Sheet1!D2:D9999)`
5. **Keep it readable** — use LET() to name intermediate values in complex formulas

### Essential Formula Categories

#### Lookups — The Modern Way

**XLOOKUP** replaces VLOOKUP, HLOOKUP, and INDEX-MATCH for most use cases:

```
=XLOOKUP(what_to_find, where_to_look, what_to_return, "Not found")
```

Why it's better than VLOOKUP:
- Lookup column doesn't need to be on the left
- Built-in "not found" message (no IFERROR wrapper needed)
- Supports exact match, wildcards, and reverse search
- Works both vertically and horizontally

**When to still use INDEX-MATCH:**
- Multi-criteria lookups combining several columns
- Dynamic column references that change based on a cell value
- Bulk lookups with ARRAYFORMULA

```
=INDEX(return_range, MATCH(search_key, lookup_range, 0))
```

#### Conditional Aggregation

These are the workhorses of business reporting — "sum this, but only where that condition is true":

```
=SUMIFS(sum_range, criteria_range1, criterion1, criteria_range2, criterion2)
=COUNTIFS(criteria_range1, criterion1, criteria_range2, criterion2)
=AVERAGEIFS(average_range, criteria_range1, criterion1)
```

**Example:** Total revenue from the West region in Q1:
```
=SUMIFS(revenue, region, "West", quarter, "Q1")
```

#### QUERY — SQL for Spreadsheets

The most powerful function in Google Sheets. Lets you write SQL-like queries against your data:

```
=QUERY(data_range, "SELECT A, SUM(D) WHERE B='Active' GROUP BY A ORDER BY SUM(D) DESC")
```

Supports: SELECT, WHERE, GROUP BY, PIVOT, ORDER BY, LIMIT, OFFSET, LABEL, FORMAT

**Common business queries:**
```
-- Revenue by category, sorted highest first
=QUERY(A1:D100, "SELECT B, SUM(D) WHERE C='Paid' GROUP BY B ORDER BY SUM(D) DESC LABEL SUM(D) 'Revenue'")

-- Top 10 customers by spend
=QUERY(A1:D100, "SELECT A, SUM(D) GROUP BY A ORDER BY SUM(D) DESC LIMIT 10")

-- Monthly totals pivoted by category
=QUERY(A1:D100, "SELECT A, SUM(D) GROUP BY A PIVOT B")
```

#### Dynamic Filtering

FILTER returns rows that match your conditions — no helper columns needed:

```
=FILTER(data_range, condition1, condition2)
```

**Example:** All overdue invoices over $1,000:
```
=FILTER(A2:D100, C2:C100<TODAY(), D2:D100>1000)
```

Combine with SORT for ordered results:
```
=SORT(FILTER(A2:D100, C2:C100="Open"), 4, FALSE)
```

#### Array Formulas

One formula that fills an entire column automatically:

```
=ARRAYFORMULA(IF(A2:A="", "", B2:B * C2:C))
```

**Pro tip:** The empty check (`IF(A2:A="", "", ...)`) prevents the formula from filling empty rows with zeros.

#### Pivot-Like Summaries Without Pivot Tables

Sometimes operators want a summary table right in their sheet:

```
-- Unique categories with their totals (array formula combo)
={UNIQUE(B2:B100), ARRAYFORMULA(SUMIF(B2:B100, UNIQUE(B2:B100), D2:D100))}

-- Or use QUERY for a cleaner pivot
=QUERY(A1:D100, "SELECT B, SUM(D) GROUP BY B PIVOT C")
```

### Common Business Reporting Patterns

#### Pattern 1: Monthly Revenue Dashboard

Set up a summary sheet that auto-calculates from raw transaction data:

```
-- Total revenue this month
=SUMIFS(amount, date, ">="&EOMONTH(TODAY(),-1)+1, date, "<="&EOMONTH(TODAY(),0))

-- Revenue by product (use QUERY for the full table)
=QUERY(Transactions!A:E, "SELECT B, SUM(E) WHERE MONTH(A)+1="&MONTH(TODAY())&" GROUP BY B ORDER BY SUM(E) DESC LABEL SUM(E) 'Revenue'")

-- Month-over-month growth
=current_month_total / previous_month_total - 1
```

#### Pattern 2: Customer Tracker

```
-- Days since last contact
=ARRAYFORMULA(IF(A2:A="", "", TODAY() - D2:D))

-- Flag stale accounts (no contact in 30+ days)
=ARRAYFORMULA(IF(A2:A="", "", IF(TODAY()-D2:D > 30, "Follow up needed", "OK")))

-- Total customers by status
=COUNTIF(status_range, "Active")
```

#### Pattern 3: Inventory/Stock Tracker

```
-- Reorder flag
=ARRAYFORMULA(IF(A2:A="", "", IF(C2:C <= D2:D, "REORDER", "OK")))

-- Days of stock remaining (based on daily usage rate)
=ARRAYFORMULA(IF(A2:A="", "", ROUND(C2:C / E2:E, 0)))
```

#### Pattern 4: Cross-Spreadsheet Data

Pull data from another spreadsheet:
```
=IMPORTRANGE("spreadsheet_url_or_id", "Sheet1!A1:D100")
```

First use requires granting permission. After that, data syncs automatically.

**Tip:** IMPORTRANGE + QUERY is powerful — query data from another spreadsheet:
```
=QUERY(IMPORTRANGE("url", "Sheet1!A:D"), "SELECT Col1, SUM(Col4) GROUP BY Col1")
```

### Sheets Tips for Operators

1. **Data Validation** — restrict what can be entered in a cell (dropdowns, date ranges, number limits). Prevents messy data before it starts.
2. **Conditional Formatting** — color cells based on rules (red for overdue, green for complete). Makes dashboards scannable.
3. **Named Ranges** — give a name to a range (like "revenue" for D2:D1000). Makes formulas readable and easier to maintain.
4. **Protected Ranges** — lock formula cells so nobody accidentally overwrites them.
5. **SPARKLINE** — tiny charts inside cells for quick visual trends: `=SPARKLINE(B2:M2)`

For the complete formula reference, see [references/sheets-formulas.md](references/sheets-formulas.md).

---

## Gmail

### Search Operators

Gmail's search is incredibly powerful when you know the operators. This is essential for finding emails programmatically and building filters.

#### Most-Used Operators

| Operator | Example | What It Does |
|----------|---------|-------------|
| `from:` | `from:boss@company.com` | Emails from a specific sender |
| `to:` | `to:team@company.com` | Emails sent to a specific address |
| `subject:` | `subject:invoice` | Search subject lines only |
| `has:attachment` | `has:attachment` | Emails with any attachment |
| `filename:` | `filename:pdf` or `filename:report.pdf` | Search by attachment type or name |
| `is:unread` | `is:unread` | Unread messages |
| `is:starred` | `is:starred` | Starred messages |
| `label:` | `label:clients` | Filter by label |
| `newer_than:` | `newer_than:7d` | Within last N days/months/years |
| `older_than:` | `older_than:1y` | Older than N days/months/years |
| `larger:` | `larger:5M` | Bigger than size (K, M suffixes) |
| `in:` | `in:sent` | Search in specific folder |

#### Boolean Logic

```
from:john OR from:jane          -- either sender
from:john AND has:attachment     -- both conditions
-from:newsletter@              -- exclude (NOT)
{from:john from:jane}           -- alternative OR syntax
subject:(budget OR forecast)    -- group terms
```

#### Date Ranges

```
after:2025/06/01 before:2025/12/31    -- date range
newer_than:30d                         -- relative (d=days, m=months, y=years)
older_than:6m                          -- older than 6 months
```

#### Practical Search Recipes

```
-- All PDFs from this month
has:attachment filename:pdf newer_than:30d

-- Unread emails from important senders
is:unread {from:boss@co.com from:client@co.com}

-- Large attachments (cleanup)
has:attachment larger:10M older_than:1y

-- Find invoices from Q4
subject:invoice after:2025/10/01 before:2026/01/01

-- All emails in a thread
rfc822msgid:message-id-here
```

For the complete operator reference, see [references/gmail-search-operators.md](references/gmail-search-operators.md).

### Label Strategies

Labels are Gmail's organizational backbone. Here are proven patterns:

#### Flat vs. Nested Labels

- **Flat** (simple): `clients`, `invoices`, `projects` — good for small businesses
- **Nested** (scalable): `clients/acme`, `clients/globex`, `projects/q1-launch` — better as volume grows

#### Recommended Label Systems

**By workflow stage:**
```
Action Required
Waiting On Reply
Delegated
Reference
```

**By business function:**
```
Clients/{client-name}
Projects/{project-name}
Finance/Invoices
Finance/Receipts
Legal/Contracts
```

**By priority:**
```
Priority/High
Priority/Normal
Priority/Low
```

### Filter Automation

Filters automatically label, archive, star, or forward incoming email based on rules.

#### High-Value Filter Patterns

| Rule | Action | Why |
|------|--------|-----|
| `from:@importantclient.com` | Label: Clients/ImportantClient, Star | Never miss client emails |
| `from:noreply@ OR from:notification@` | Skip Inbox, Label: Automated | Keep inbox clean |
| `subject:invoice OR subject:receipt` | Label: Finance/Invoices | Auto-organize financials |
| `list:team-updates@` | Label: Team, Skip Inbox | Mailing lists don't clutter inbox |
| `to:billing@yourdomain.com` | Label: Finance, Star | Route billing emails |
| `has:attachment filename:pdf from:@vendor.com` | Label: Vendor/Docs | Collect vendor documents |

#### Filter Tips

1. **Test your search first** — type the query in Gmail search to see what matches before creating a filter
2. **"Also apply to matching conversations"** — check this when creating a filter to retroactively apply to existing emails
3. **Avoid over-filtering** — too many filters become unmaintainable. Start with 5-10 high-value rules
4. **Export your filters** — Gmail lets you export filters as XML for backup

---

## Google Calendar

### Event Management Patterns

#### Recurring Events

Google Calendar uses RRULE (recurrence rule) syntax for repeating events:

| Pattern | Plain English |
|---------|--------------|
| Weekly team standup | Every Monday at 9am |
| Bi-weekly 1:1s | Every other Wednesday at 2pm |
| Monthly board meeting | First Tuesday of every month |
| Quarterly review | Every 3 months on the 15th |
| Weekday daily standup | Every Mon-Fri at 9am |

**Quick Add** — create events from natural language:
```
"Team standup every Monday at 9am"
"Lunch with Sarah tomorrow at noon at Cafe Milano"
"Flight to NYC on March 15 at 6am"
```

The Calendar API's `quickAdd` endpoint parses natural language into structured events — very useful for automation.

#### Color Coding Strategy

Use event colors to create a scannable calendar:

| Color | Category | Example |
|-------|----------|---------|
| Default (blue) | Regular meetings | Team standup, 1:1s |
| Green | Personal/wellness | Lunch, gym, breaks |
| Red | Critical/deadline | Client presentations, deadlines |
| Yellow | Tentative/TBD | Holds, maybe-meetings |
| Purple | External | Client calls, vendor meetings |
| Orange | Travel | Commute, flights, site visits |

### Scheduling Patterns

#### Finding Availability

When scheduling across multiple people:

1. **FreeBusy Query** — the API can check availability across multiple calendars at once
2. Supply a time range and list of attendees
3. Get back busy blocks for each person
4. Find gaps where everyone is free

**Pro tip:** When helping schedule via MCP, always check freebusy first rather than listing all events (it's faster and respects privacy — you only see busy/free, not event details).

#### Smart Scheduling Rules

Help operators set up calendars that protect their time:

1. **Focus blocks** — block 2-3 hour chunks for deep work, mark as "busy"
2. **Meeting-free days** — designate one day per week with no meetings
3. **Buffer time** — 15-minute gaps between meetings for travel/transition
4. **Office hours** — recurring open slots where anyone can book time
5. **End-of-day cutoff** — no meetings after 4pm (or whatever the operator prefers)

#### Shared Calendar Patterns

| Pattern | How | When |
|---------|-----|------|
| Team calendar | Create a shared calendar, add team members | Team events, PTO tracking |
| Resource calendar | Create calendars for rooms/equipment | Room booking, equipment scheduling |
| Client calendar | Share a calendar with a client | Joint project milestones |
| On-call rotation | Create recurring events assigned to different people | Support rotations |

### Calendar + Scheduling Automation

#### Pattern 1: Meeting Prep Automation

```
Trigger: 30 minutes before any meeting with label "Client"
Action: Pull client info from Sheets CRM, create prep summary
```

#### Pattern 2: PTO Tracking

```
All-day events on a shared "PTO" calendar
→ n8n polls the calendar daily
→ Updates a Sheets tracker with who's out
→ Posts daily availability summary to Slack
```

#### Pattern 3: Appointment Booking

```
Check freebusy for available slots
→ Present options to the requester
→ Create event with attendees and video link
→ Send confirmation email via Gmail
```

---

## Cross-Tool Workflows

The real power of Google Workspace comes from combining tools. Here are proven patterns:

### Sheets + Gmail: Mail Merge

**Use case:** Send personalized emails to a list of contacts from a spreadsheet.

**How it works:**
1. Spreadsheet has columns: Name, Email, Company, Custom Field
2. For each row, compose a personalized email using the column values
3. Send via Gmail API

**Template approach:**
```
Subject: {{Company}} — Your Q1 Report is Ready
Body: Hi {{Name}}, I've attached your Q1 summary for {{Company}}...
```

**Safety rules:**
- Always preview before bulk sending
- Send in batches (50 at a time, not 500)
- Include unsubscribe mechanism for marketing emails
- Test with your own email first

### Sheets + Calendar: Event Tracking

**Use case:** Track meeting outcomes in a spreadsheet automatically.

**How it works:**
1. Calendar event ends → automation triggers
2. Creates a row in a "Meetings" spreadsheet with: date, title, attendees, duration
3. Operator fills in notes and action items after

**Reverse direction:**
1. Spreadsheet has a list of events to create (conference schedule, training sessions)
2. Automation reads each row and creates Calendar events
3. Useful for bulk event creation

### Gmail + Calendar: Meeting Prep

**Use case:** Before any meeting, pull together relevant email context.

**How it works:**
1. Check today's calendar for upcoming meetings
2. For each meeting, search Gmail for recent threads with attendees
3. Summarize relevant email context
4. Present as a daily briefing

### Sheets + Gmail + Calendar: Full CRM Workflow

**Use case:** Lightweight CRM entirely in Google Workspace.

**How it works:**
1. **Sheets** = the database (contacts, deals, activities)
2. **Gmail** = communication tracking (search for emails with each contact)
3. **Calendar** = meeting scheduling (create follow-up meetings from Sheets data)

**Automation flow:**
```
New lead added to Sheets
→ Send welcome email via Gmail
→ Create follow-up meeting in Calendar for 3 days later
→ Update Sheets with "Welcome sent" status
```

---

## Working with Google Workspace MCP Tools

When the user has a Google Workspace MCP source connected, here are the key patterns.

### Gmail Operations

| Action | Approach |
|--------|----------|
| Find specific emails | Use search with operators (see search reference) |
| Read an email | Get message by ID after searching |
| Send an email | Compose with to, subject, body; supports HTML |
| Manage labels | Create, rename, or delete labels |
| Batch operations | Modify up to 50-100 messages at a time |

**Important:** Gmail batch operations should be chunked (50-100 per batch) to avoid rate limits and timeouts.

### Sheets Operations

| Action | Approach |
|--------|----------|
| Read data | Get values from a range (e.g., `Sheet1!A1:D100`) |
| Write data | Update values in a range |
| Get structure | Read spreadsheet metadata for sheet names and properties |

**Range notation:** `SheetName!A1:D100` — always include the sheet name for clarity.

### Calendar Operations

| Action | Approach |
|--------|----------|
| List events | Query by date range, supports filtering |
| Create event | Specify summary, start/end, attendees, recurrence |
| Check availability | FreeBusy query across multiple calendars |
| Update event | Modify any event property by ID |
| Quick add | Create from natural language text string |

### Common Gotchas

1. **Dates must be ISO 8601** — `2026-02-11T14:00:00-05:00` not "Feb 11 at 2pm"
2. **Gmail message IDs are NOT the same as thread IDs** — a thread contains multiple messages
3. **Sheet ranges are 1-indexed** — `A1` is the first cell, not `A0`
4. **Calendar times need timezone** — always include timezone offset or use the user's timezone
5. **Rate limits exist** — Gmail allows ~250 messages/day for regular accounts, Sheets has per-minute quotas
6. **Token refresh** — if you get 401 errors, the auth token may need refreshing

---

## Common Mistakes and How to Fix Them

### 1. Using VLOOKUP When XLOOKUP Is Better

**Symptom:** Formula breaks when columns are rearranged, or user needs to look left.

**Fix:** Replace with XLOOKUP. It doesn't care about column order and has built-in error handling.

### 2. Manually Copying Formulas Down Columns

**Symptom:** Formula works in row 2 but user has to copy it down to row 1000 every time data is added.

**Fix:** Use ARRAYFORMULA in row 2. It auto-fills the entire column.

### 3. Hardcoded Date Ranges in Reports

**Symptom:** Monthly report formula uses `A2:A31` and breaks in February or months with 31 days.

**Fix:** Use EOMONTH() for dynamic month boundaries:
```
=SUMIFS(amount, date, ">="&EOMONTH(TODAY(),-1)+1, date, "<="&EOMONTH(TODAY(),0))
```

### 4. Gmail Inbox as a To-Do List

**Symptom:** Hundreds of unread emails, important items buried.

**Fix:** Set up labels + filters. Use "Action Required" / "Waiting" / "Reference" labels. Filter automated notifications to skip inbox. Star only truly urgent items.

### 5. No Calendar Boundaries

**Symptom:** Back-to-back meetings all day with no breaks.

**Fix:** Create recurring focus blocks and buffer times. Use "default meeting duration" of 25 or 50 minutes instead of 30/60.

### 6. One Giant Spreadsheet for Everything

**Symptom:** A single sheet with 50 columns and 10,000 rows that's slow and hard to navigate.

**Fix:** Split into multiple sheets or spreadsheets. Use IMPORTRANGE to connect them. Each sheet should have one clear purpose.

---

## Reference

For detailed formula syntax, operator lists, and code patterns:
- [references/sheets-formulas.md](references/sheets-formulas.md) — Complete Google Sheets formula reference with business examples
- [references/gmail-search-operators.md](references/gmail-search-operators.md) — Full Gmail search operator reference

## Attribution

This skill incorporates patterns and concepts adapted from:
- [the3asic/google-workspace-skill](https://github.com/the3asic/google-workspace-skill) (MIT License) — OAuth patterns and Calendar/Gmail API reference
- [taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp) (MIT License) — comprehensive tool capabilities and tier system reference
- [ngs/google-mcp-server](https://github.com/ngs/google-mcp-server) (MIT License) — multi-account patterns and cross-account operations reference
