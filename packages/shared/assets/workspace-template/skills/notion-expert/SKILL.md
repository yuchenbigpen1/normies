---
name: Notion Expert
description: Deep Notion knowledge for business operators — databases, templates, property design, formulas, and automation patterns. Not a setup guide — domain expertise for getting real work done in Notion.
---

# Notion Expert

You are an expert at helping non-technical business operators design, build, and optimize Notion workspaces. You understand Notion's data model deeply and can translate business needs into well-structured Notion systems.

**This skill is NOT about connecting to Notion** — Normies handles that via the Notion MCP source. This skill gives you the domain knowledge to do great work once connected.

## When to Use This Skill

- User wants to create or restructure a Notion database
- User asks about properties, relations, rollups, or formulas
- User needs a business system (CRM, project tracker, content calendar, etc.)
- User wants to automate workflows involving Notion
- User is confused about how to organize information in Notion

## Notion's Data Model

Understanding how Notion organizes information is the foundation. Here's how to explain it to operators:

### The Building Blocks

| Concept | Plain English | Analogy |
|---------|--------------|---------|
| **Workspace** | Your company's Notion account | The filing cabinet |
| **Page** | A document that can contain anything | A sheet of paper |
| **Database** | A structured collection of pages | A spreadsheet with superpowers |
| **Property** | A column in a database | A field on a form |
| **Block** | Any piece of content (text, image, toggle, etc.) | A paragraph or widget |
| **View** | A different way to look at the same database | A filter/sort saved as a tab |

### Pages vs. Databases

This is the #1 source of confusion for new users:

- **Page** = a freeform document. Great for notes, meeting agendas, one-off docs.
- **Database** = a collection of structured entries. Each entry is itself a page. Great for anything you want to track, filter, sort, or report on.

**Rule of thumb:** If you'll have more than 5 similar items and want to filter/sort them, use a database. If it's a one-off document, use a page.

### Database Views

One database can have multiple views. Each view is just a different lens on the same data:

| View Type | Best For | Example |
|-----------|----------|---------|
| **Table** | Spreadsheet-style data entry and editing | Task list with all details visible |
| **Board** | Kanban workflow tracking | Tasks moving through stages (To Do → In Progress → Done) |
| **Calendar** | Date-based scheduling | Content calendar showing publish dates |
| **Timeline** | Gantt chart for project planning | Project milestones with start/end dates |
| **List** | Clean, minimal page listing | Meeting notes sorted by date |
| **Gallery** | Visual card layout | Product catalog with cover images |

**Tip:** Always create a "Master" table view that shows all entries (no filters), then create filtered views on top. This prevents accidentally losing track of items.

## Property Types

Properties are the columns in your database — they define what information you track for each entry.

### Core Property Types

| Property | What It Stores | When to Use |
|----------|---------------|-------------|
| **Title** | The name of the entry (required, one per database) | Every database has exactly one |
| **Text** | Free-form text | Notes, descriptions, short answers |
| **Number** | Numeric values | Prices, quantities, scores |
| **Select** | One choice from a list | Status, category, priority |
| **Multi-select** | Multiple choices from a list | Tags, skills, departments |
| **Date** | A date or date range | Due dates, event dates, created dates |
| **Person** | A workspace member | Assignee, reviewer, owner |
| **Checkbox** | True/false toggle | Done, approved, featured |
| **URL** | A web link | Website, document link |
| **Email** | An email address | Contact email |
| **Phone** | A phone number | Contact phone |
| **Files & media** | Uploaded files or links | Attachments, images |

### Advanced Property Types

These are where Notion gets powerful:

| Property | What It Does | Plain English |
|----------|-------------|---------------|
| **Relation** | Links entries between two databases | "This task belongs to Project X" |
| **Rollup** | Calculates values from related entries | "Show me the total cost of all tasks in this project" |
| **Formula** | Computes values from other properties | "Days until due date" or "Is this overdue?" |
| **Created time** | Auto-records when entry was created | Automatic timestamp |
| **Created by** | Auto-records who created the entry | Automatic attribution |
| **Last edited time** | Auto-records last modification | Track activity |
| **Last edited by** | Auto-records who last modified | Track who changed what |
| **Status** | Built-in workflow states (Not started → In progress → Done) | Task progress with grouping support |
| **Unique ID** | Auto-generated sequential ID | Reference numbers (TASK-001, BUG-042) |
| **Verification** | URL verification status | Verify links are still live |

### Relations & Rollups — The Power Combo

Relations and rollups are what make Notion more than a spreadsheet. Here's how they work together:

**Relations** connect entries across databases. Example:
- Database: **Projects** ↔ Database: **Tasks**
- Each task has a relation property pointing to its parent project
- Each project automatically shows all its related tasks

**Rollups** aggregate data from related entries. Example:
- In the Projects database, add a rollup that counts tasks from the related Tasks database
- Or sum the estimated hours, or show the percentage of completed tasks

**Common relation patterns:**

| Pattern | Databases | Relation | Useful Rollups |
|---------|-----------|----------|----------------|
| Project → Tasks | Projects ↔ Tasks | Tasks belong to a project | Task count, % complete, total hours |
| Client → Projects | Clients ↔ Projects | Projects belong to a client | Project count, total revenue |
| Person → Tasks | Team ↔ Tasks | Tasks assigned to a person | Workload count, overdue count |
| Content → Tags | Articles ↔ Tags | Articles tagged with topics | Article count per tag |

## Database Design Patterns

### Pattern 1: The Status Workflow

Every tracking database needs a clear workflow. Use the built-in **Status** property (not a regular Select):

```
Not started → In progress → Done
```

**Why Status over Select?** The Status property type has built-in grouping (To-do, In progress, Complete) that powers Board views and progress tracking. Select properties don't have this.

**Custom status values** — adapt to your workflow:

| Use Case | Stages |
|----------|--------|
| Task management | Not started → In progress → In review → Done |
| Content pipeline | Idea → Drafting → Editing → Scheduled → Published |
| Sales pipeline | Lead → Contacted → Proposal → Negotiation → Closed Won / Closed Lost |
| Bug tracking | Reported → Triaged → In progress → Testing → Resolved |
| Hiring | Applied → Phone screen → Interview → Offer → Hired / Rejected |

### Pattern 2: The Master-Detail Structure

For complex systems, use a hierarchy of linked databases:

```
Clients (master)
  └── Projects (detail, related to Clients)
       └── Tasks (detail, related to Projects)
            └── Time entries (detail, related to Tasks)
```

Each level has rollups summarizing the level below. This gives you data at any zoom level: per-task hours, per-project totals, per-client summaries.

### Pattern 3: The Tag System

Use multi-select for simple tags. Use a separate Tags database with relations for complex tag systems where you need:
- Tag descriptions
- Tag categories or hierarchies
- Rollups showing "most used tags" or "articles per tag"

### Pattern 4: The Template Database

Create template entries (with a "Template" checkbox) inside your database. When creating new entries, duplicate a template to start with pre-filled properties and content. This ensures consistency without Notion's built-in template feature limitations.

## Formulas

Formulas let you compute values from other properties. Here are the most useful patterns for business operators.

### Date Formulas

```
// Days until due date (negative = overdue)
dateBetween(prop("Due Date"), now(), "days")

// Is this overdue?
if(prop("Due Date") < now() and prop("Status") != "Done", true, false)

// Days since created
dateBetween(now(), prop("Created"), "days")

// Format date as "Jan 15, 2026"
formatDate(prop("Due Date"), "MMM D, YYYY")

// Business days between two dates (approximation)
round(dateBetween(prop("End Date"), prop("Start Date"), "days") * 5 / 7)
```

### Text Formulas

```
// Combine first and last name
prop("First Name") + " " + prop("Last Name")

// Create an email from name (simple pattern)
lower(prop("First Name")) + "." + lower(prop("Last Name")) + "@company.com"

// Truncate long text
if(length(prop("Description")) > 100,
  slice(prop("Description"), 0, 100) + "...",
  prop("Description"))

// Extract domain from URL
replaceAll(replaceAll(prop("Website"), "https://", ""), "http://", "")
```

### Number Formulas

```
// Percentage complete (with related tasks via rollup)
round(prop("Completed Tasks") / prop("Total Tasks") * 100)

// Revenue with tax
prop("Subtotal") * 1.1

// Weighted score (e.g., for lead scoring)
prop("Company Size Score") * 0.3 + prop("Engagement Score") * 0.5 + prop("Budget Score") * 0.2

// Format as currency (Notion 2.0 formula syntax)
"$" + format(round(prop("Amount") * 100) / 100)
```

### Conditional Formulas

```
// Priority label based on score
if(prop("Score") >= 80, "🔴 High",
  if(prop("Score") >= 50, "🟡 Medium", "🟢 Low"))

// Status emoji
if(prop("Status") == "Done", "✅",
  if(prop("Status") == "In progress", "🔄", "⬜"))

// SLA status (overdue warning)
if(empty(prop("Due Date")), "No deadline",
  if(dateBetween(prop("Due Date"), now(), "days") < 0, "🚨 Overdue",
    if(dateBetween(prop("Due Date"), now(), "days") <= 3, "⚠️ Due soon", "✅ On track")))
```

### Formula Tips

1. **Use `prop("Name")`** to reference any property by its exact name
2. **Notion has two formula versions** — older databases use Notion formula v1, newer ones use v2 (which supports `lets`, `ifs`, and more). When in doubt, ask what the user sees in their formula editor
3. **Formulas can't modify data** — they're read-only computed values
4. **Empty checks matter** — always handle the case where a property might be empty: `if(empty(prop("Due Date")), "No date", ...)`

## Filters and Sorts

### Common Filter Patterns

When helping users set up database views, suggest these filter combinations:

| View Purpose | Filters |
|-------------|---------|
| My tasks | Person "Assignee" = Me AND Status is not "Done" |
| Overdue items | Date "Due" is before Today AND Status is not "Done" |
| This week's work | Date "Due" is this week |
| High priority only | Select "Priority" is "High" or "Urgent" |
| Recently updated | Last edited time is within past 7 days |
| Unassigned work | Person "Assignee" is empty |
| Active projects | Status is "In progress" AND Checkbox "Archived" is unchecked |

### Sort Best Practices

- **Task lists:** Sort by Status (ascending), then Priority (descending), then Due Date (ascending)
- **Content calendars:** Sort by Publish Date (ascending)
- **CRM:** Sort by Last Contacted (ascending) to surface stale leads
- **Meeting notes:** Sort by Date (descending) to show most recent first

## Business Templates

When a user needs a business system, start with these proven structures. Customize based on their specific needs.

### CRM-Lite (Customer Relationship Manager)

See [references/templates.md](references/templates.md) for the full database schemas. Here's the overview:

**Databases:** Contacts, Companies, Deals, Activities

**How it works:**
- **Contacts** are people. Each contact is related to a Company and has properties for email, phone, role, and lead source
- **Companies** are organizations. Each company shows all its related contacts and deals via rollups
- **Deals** track revenue opportunities. Each deal is related to a contact and company, with stage, value, and expected close date
- **Activities** log touchpoints (calls, emails, meetings). Each activity is related to a contact and/or deal

**Key views:**
- Pipeline board (deals grouped by stage)
- Stale leads (contacts not contacted in 30+ days)
- Revenue forecast (deals by expected close month)
- Activity timeline (recent activities sorted by date)

### Project Tracker

**Databases:** Projects, Tasks, Milestones

**How it works:**
- **Projects** are the top level. Properties: owner, status, start/end dates, priority
- **Tasks** belong to projects (via relation). Properties: assignee, status, due date, estimated hours, actual hours
- **Milestones** are checkpoints within projects. Properties: target date, status, related tasks

**Key views:**
- Active projects board (projects by status)
- My tasks (filtered to current user, sorted by due date)
- Timeline view (projects as Gantt bars)
- Workload view (tasks grouped by assignee)

### Content Calendar

**Databases:** Content, Channels, Topics

**How it works:**
- **Content** entries are individual pieces (blog posts, social posts, videos). Properties: title, type, status, publish date, author, channel, topic
- **Channels** define where content goes (Blog, Twitter, LinkedIn, Newsletter)
- **Topics** categorize content themes for planning

**Key views:**
- Calendar view (content by publish date)
- Pipeline board (content by status: Idea → Writing → Review → Scheduled → Published)
- By channel (filtered views per channel)
- This week's schedule (filtered to current week)

### Meeting Notes System

**Database:** Meetings

**Properties:** Title, Date, Attendees (Person), Type (Select: standup/weekly/1:1/all-hands), Project (Relation), Action Items (Text), Notes (page content)

**Key views:**
- Upcoming meetings (Date is after today, sorted ascending)
- My meetings (Attendees contains Me)
- By project (grouped by related project)
- Action items (filtered to entries with non-empty action items, status not "Done")

**Page template inside each meeting entry:**
```
## Agenda
- [ ] Topic 1
- [ ] Topic 2

## Notes
(captured during meeting)

## Decisions
- Decision 1: [what was decided]

## Action Items
- [ ] @Person — Do the thing — by [date]
```

### Knowledge Base

**Database:** Articles

**Properties:** Title, Category (Select), Tags (Multi-select), Author (Person), Status (Status: Draft → Review → Published), Last Reviewed (Date), Audience (Select: Internal/External/Both)

**Key views:**
- By category (grouped by category)
- Needs review (Last Reviewed is more than 90 days ago)
- Recently updated (sorted by Last Edited Time descending)
- Published articles (Status is "Published")

**Structure tip:** Use sub-pages within each article for sections. Use a "Related Articles" relation for cross-linking.

### Employee Directory

**Database:** Team Members

**Properties:** Name (Title), Role (Text), Department (Select), Manager (Relation to self), Start Date, Location, Email, Phone, Skills (Multi-select), Bio (page content)

**Key views:**
- By department (grouped by department)
- Org chart (Timeline view by start date, or use a separate relation-based hierarchy)
- New hires (Start Date within past 90 days)
- Skills directory (grouped or filtered by skills)

## Automation Patterns with n8n

Notion becomes much more powerful when connected to automation. Here are common patterns using n8n workflows.

### Pattern 1: Incoming Data → Notion Database

**Use case:** Automatically capture data from external sources into Notion.

**Examples:**
- New form submission (Typeform, Google Forms) → Create Notion page in Leads database
- New email (Gmail) matching a filter → Create Notion page in Support Tickets database
- New Stripe payment → Create Notion page in Transactions database

**n8n structure:**
```
Trigger (Webhook/Poll) → Transform Data → Notion: Create Page
```

**Tips:**
- Map external fields to Notion property types carefully (dates must be ISO format, select values must match exactly)
- Use n8n's "Set" node to transform data before sending to Notion
- Handle errors with a fallback (e.g., send to Slack if Notion creation fails)

### Pattern 2: Notion Changes → External Actions

**Use case:** When something changes in Notion, trigger actions elsewhere.

**Examples:**
- Task status changes to "Done" → Send Slack message to channel
- New page added to Content Calendar → Create draft in WordPress
- Deal stage changes to "Closed Won" → Create invoice in Stripe, notify team

**n8n structure:**
```
Schedule Trigger (poll Notion every 5 min) → Filter Changed Items → Action
```

**Note:** Notion doesn't have real-time webhooks. Use polling (query the database on a schedule and compare with previous results) or use a third-party webhook service.

### Pattern 3: Periodic Reports from Notion

**Use case:** Generate and send regular reports based on Notion data.

**Examples:**
- Every Monday: Query active tasks, summarize by assignee, send to Slack
- Every month: Query deals database, calculate revenue metrics, send email report
- Every day: Check for overdue tasks, ping assignees via Slack

**n8n structure:**
```
Schedule Trigger → Notion: Query Database → Aggregate/Transform → Send Report (Slack/Email)
```

### Pattern 4: Two-Way Sync

**Use case:** Keep Notion in sync with another system.

**Examples:**
- Notion Tasks ↔ Linear Issues (status sync)
- Notion Contacts ↔ CRM (field sync)
- Notion Content Calendar ↔ Google Calendar (date sync)

**n8n structure:**
```
Trigger from System A → Check if exists in System B → Create or Update
Trigger from System B → Check if exists in System A → Create or Update
```

**Warning:** Two-way sync is genuinely complex. Common pitfalls:
- Infinite loops (A updates B, B updates A, repeat)
- Conflict resolution (both changed at the same time)
- Field mapping mismatches

**Recommendation:** Start with one-way sync. Only go two-way if the user truly needs it, and implement loop detection (e.g., ignore updates made by the automation's own bot user).

## Working with the Notion MCP Server

When the user has the Notion MCP source connected, you have access to these capabilities:

### What You Can Do

| Action | MCP Tool | Notes |
|--------|----------|-------|
| **Search pages/databases** | `post-search` | Search by title, filter by type |
| **Read a page** | `retrieve-a-page` | Get properties and metadata |
| **Read page content** | `get-block-children` | Get the blocks (text, lists, etc.) inside a page |
| **Create a page** | `post-page` | Create in a database or as a sub-page |
| **Update page properties** | `patch-page` | Change any property value |
| **Query a database** | `query-data-source` | Filter, sort, paginate results |
| **Create a database** | `create-a-data-source` | Build a new database with defined properties |
| **Update a database** | `update-a-data-source` | Modify schema (add/rename properties) |
| **Add content to a page** | `patch-block-children` | Append text, lists, toggles, etc. |
| **Move a page** | `move-page` | Relocate to a different parent |
| **Read/create comments** | `retrieve-a-comment` / `create-a-comment` | Page-level discussion |
| **List users** | `get-users` | See workspace members |

### What You Can't Do (Limitations)

- **No file uploads** — can't attach files directly, only link to URLs
- **No database deletion** — databases can only be archived, not permanently deleted
- **No real-time webhooks** — must poll for changes
- **No permission management** — can't change sharing settings via API
- **No block reordering** — can append blocks but can't rearrange existing ones
- **No page content replacement** — to "edit" content, delete old blocks then append new ones
- **Comments are permanent** — can create but not edit or delete comments

### Common Operations

**Creating a database entry:**
1. First, query the database to understand its schema (`retrieve-a-data-source`)
2. Build the properties object matching the schema exactly
3. Create the page with `post-page`, setting the database as parent

**Important property format rules:**
- **Title:** `{ "title": [{ "text": { "content": "Entry name" } }] }`
- **Select:** `{ "select": { "name": "Option Name" } }` — value must match exactly
- **Date:** `{ "date": { "start": "2026-02-11" } }` — ISO 8601 format
- **Number:** `{ "number": 42 }`
- **Checkbox:** `{ "checkbox": true }`
- **Person:** `{ "people": [{ "id": "user-id" }] }` — use user IDs from `get-users`
- **Relation:** `{ "relation": [{ "id": "page-id" }] }` — use page IDs from query results
- **Multi-select:** `{ "multi_select": [{ "name": "Tag1" }, { "name": "Tag2" }] }`
- **URL:** `{ "url": "https://example.com" }`
- **Email:** `{ "email": "hello@example.com" }`
- **Rich text:** `{ "rich_text": [{ "text": { "content": "Some text" } }] }`

## Common Mistakes and How to Fix Them

### 1. Using Pages When You Need a Database

**Symptom:** User has 20+ similar pages (meeting notes, tasks, etc.) scattered around with no way to filter or sort them.

**Fix:** Create a database, define properties for the key attributes they want to track, then migrate existing pages as database entries.

### 2. Too Many Properties

**Symptom:** Database has 15+ columns, most are rarely filled in.

**Fix:** Audit which properties are actually used. Archive unused properties (hide them, don't delete). Keep the "create new entry" experience to 3-5 essential fields.

### 3. Flat Structure (No Relations)

**Symptom:** User duplicates information across databases (e.g., client name typed into every project, every task, every invoice).

**Fix:** Create a Clients database with a single source of truth. Relate other databases to it. Use rollups to surface client info where needed.

### 4. No Views, Just One Big Table

**Symptom:** User scrolls through hundreds of entries to find what they need.

**Fix:** Create purpose-specific views: "My tasks," "Due this week," "By status," "By project." Each view filters and sorts for a specific use case.

### 5. Inconsistent Select Options

**Symptom:** Same category appears as "marketing," "Marketing," "Mktg," etc.

**Fix:** Clean up select values (Notion lets you merge them). Then educate the team to pick from existing options rather than creating new ones. Consider using the Status property type for workflow states (it's more structured than Select).

### 6. Ignoring Templates

**Symptom:** Every new entry requires manually filling in the same boilerplate content.

**Fix:** Create database templates with pre-filled content and default property values. This ensures consistency and saves time.

## Reference

For detailed database schemas, property configurations, and code patterns:
- [references/templates.md](references/templates.md) — Full property schemas for all business templates
- [references/patterns.md](references/patterns.md) — Design patterns, formula cookbook, and API format reference

## Attribution

This skill incorporates patterns and concepts adapted from:
- [tommy-ca/notion-skills](https://github.com/tommy-ca/notion-skills) (MIT License) — knowledge capture and documentation workflow patterns
- [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server) — official Notion MCP server capabilities reference
