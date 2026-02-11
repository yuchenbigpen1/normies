# Notion Design Patterns & Reference

Advanced patterns, formula cookbook, and API format reference for the Notion Expert skill.

## Database Design Decision Tree

Use this when a user asks "how should I structure this?"

```
Q: Will you have multiple similar items?
├── No → Use a page (freeform document)
└── Yes
    Q: Do items need different properties/columns?
    ├── No → Single database with views
    └── Yes
        Q: Are they related to each other?
        ├── No → Separate databases
        └── Yes → Separate databases with relations
            Q: Do you need to summarize data across the relation?
            ├── No → Relation only
            └── Yes → Relation + rollup
```

## Relation Architecture Patterns

### Hub and Spoke

One central database with multiple related databases radiating out.

```
                  ┌─── Tasks
                  │
Clients ──────── Projects ──── Milestones
                  │
                  └─── Time Entries
```

**Best for:** Project management, client work, any system with a clear hierarchy.

### Many-to-Many with Junction

When items from two databases can relate in multiple ways, use a junction database.

```
Students ←→ Enrollments ←→ Courses
```

**The Enrollments database** has:
- Relation to Students
- Relation to Courses
- Properties: Grade, Semester, Status

**Best for:** Complex mappings where the relationship itself has attributes.

### Self-Relation (Hierarchy)

A database related to itself for parent-child structures.

```
Team Members:
  CEO
  ├── VP Engineering (Manager → CEO)
  │   ├── Lead Dev (Manager → VP Eng)
  │   └── Lead QA (Manager → VP Eng)
  └── VP Sales (Manager → CEO)
      └── Sales Rep (Manager → VP Sales)
```

**Best for:** Org charts, task dependencies, category hierarchies.

### Shared Tags Database

A single Tags/Categories database related to multiple content databases.

```
Blog Posts ←→ Tags ←→ Help Articles
                ↕
            Newsletters
```

**Best for:** Consistent categorization across multiple content types.

## Formula Cookbook

### Date & Time

```
// Working days until deadline (Mon-Fri approximation)
let(
  totalDays, dateBetween(prop("Due Date"), now(), "days"),
  round(totalDays * 5 / 7)
)

// Quarter from date
"Q" + format(ceil(toNumber(formatDate(prop("Date"), "M")) / 3))

// Fiscal year (starting April)
if(toNumber(formatDate(prop("Date"), "M")) >= 4,
  "FY" + formatDate(prop("Date"), "YY"),
  "FY" + format(toNumber(formatDate(prop("Date"), "YY")) - 1))

// Time ago in human-readable format
let(
  days, dateBetween(now(), prop("Created"), "days"),
  if(days == 0, "Today",
    if(days == 1, "Yesterday",
      if(days < 7, format(days) + " days ago",
        if(days < 30, format(round(days / 7)) + " weeks ago",
          if(days < 365, format(round(days / 30)) + " months ago",
            format(round(days / 365)) + " years ago")))))
)
```

### Status & Progress

```
// Progress bar using emoji blocks
let(
  pct, round(prop("Completed") / prop("Total") * 10),
  slice("██████████", 0, pct) + slice("░░░░░░░░░░", 0, 10 - pct) +
  " " + format(round(prop("Completed") / prop("Total") * 100)) + "%"
)

// RAG status (Red/Amber/Green)
if(prop("Progress") >= 80 and dateBetween(prop("Due"), now(), "days") >= 0, "🟢 Green",
  if(prop("Progress") >= 50, "🟡 Amber", "🔴 Red"))

// Sprint velocity (story points per week)
let(
  weeks, max(dateBetween(now(), prop("Sprint Start"), "days") / 7, 1),
  round(prop("Completed Points") / weeks * 10) / 10
)
```

### Financial

```
// Monthly burn rate
prop("Total Expenses") / max(dateBetween(now(), prop("Start Date"), "months"), 1)

// Runway in months
round(prop("Cash Balance") / prop("Monthly Burn"))

// Revenue growth MoM
if(prop("Last Month Revenue") > 0,
  format(round((prop("This Month Revenue") - prop("Last Month Revenue")) /
    prop("Last Month Revenue") * 100)) + "%",
  "N/A")

// Deal weighted value (for pipeline forecasting)
prop("Value") * (
  if(prop("Stage") == "Lead", 0.1,
    if(prop("Stage") == "Contacted", 0.2,
      if(prop("Stage") == "Proposal", 0.4,
        if(prop("Stage") == "Negotiation", 0.7,
          if(prop("Stage") == "Closed Won", 1, 0)))))
)
```

### Text & Formatting

```
// Initials from full name
let(
  parts, split(prop("Name"), " "),
  if(length(parts) >= 2,
    upper(slice(at(parts, 0), 0, 1)) + upper(slice(at(parts, length(parts) - 1), 0, 1)),
    upper(slice(prop("Name"), 0, 2)))
)

// Slug from title (URL-friendly)
lower(replaceAll(replaceAll(prop("Title"), " ", "-"), "[^a-zA-Z0-9-]", ""))

// Truncated preview
if(length(prop("Description")) > 80,
  slice(prop("Description"), 0, 80) + "…",
  prop("Description"))
```

## Property Format Reference (API)

When creating or updating pages via the Notion API/MCP, properties must follow these exact formats.

### Creating a Page in a Database

```json
{
  "parent": { "database_id": "abc123..." },
  "properties": {
    "Name": {
      "title": [{ "text": { "content": "My Entry" } }]
    },
    "Status": {
      "status": { "name": "In progress" }
    },
    "Priority": {
      "select": { "name": "High" }
    },
    "Tags": {
      "multi_select": [
        { "name": "Marketing" },
        { "name": "Q1" }
      ]
    },
    "Due Date": {
      "date": {
        "start": "2026-03-15",
        "end": "2026-03-20"
      }
    },
    "Assignee": {
      "people": [{ "id": "user-uuid-here" }]
    },
    "Budget": {
      "number": 5000
    },
    "Approved": {
      "checkbox": true
    },
    "Website": {
      "url": "https://example.com"
    },
    "Contact Email": {
      "email": "hello@example.com"
    },
    "Phone": {
      "phone_number": "+1-555-0100"
    },
    "Notes": {
      "rich_text": [{ "text": { "content": "Some notes here" } }]
    },
    "Project": {
      "relation": [{ "id": "related-page-uuid" }]
    }
  }
}
```

### Adding Content Blocks to a Page

```json
{
  "children": [
    {
      "object": "block",
      "type": "heading_2",
      "heading_2": {
        "rich_text": [{ "text": { "content": "Section Title" } }]
      }
    },
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [{ "text": { "content": "Body text goes here." } }]
      }
    },
    {
      "object": "block",
      "type": "bulleted_list_item",
      "bulleted_list_item": {
        "rich_text": [{ "text": { "content": "List item" } }]
      }
    },
    {
      "object": "block",
      "type": "to_do",
      "to_do": {
        "rich_text": [{ "text": { "content": "Action item" } }],
        "checked": false
      }
    },
    {
      "object": "block",
      "type": "callout",
      "callout": {
        "rich_text": [{ "text": { "content": "Important note" } }],
        "icon": { "emoji": "💡" }
      }
    },
    {
      "object": "block",
      "type": "divider",
      "divider": {}
    },
    {
      "object": "block",
      "type": "toggle",
      "toggle": {
        "rich_text": [{ "text": { "content": "Click to expand" } }],
        "children": [
          {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
              "rich_text": [{ "text": { "content": "Hidden content" } }]
            }
          }
        ]
      }
    }
  ]
}
```

### Database Query Filters

```json
{
  "filter": {
    "and": [
      {
        "property": "Status",
        "status": { "does_not_equal": "Done" }
      },
      {
        "property": "Assignee",
        "people": { "contains": "user-uuid" }
      },
      {
        "property": "Due Date",
        "date": { "on_or_before": "2026-03-01" }
      }
    ]
  },
  "sorts": [
    { "property": "Priority", "direction": "descending" },
    { "property": "Due Date", "direction": "ascending" }
  ],
  "page_size": 20
}
```

**Filter operators by property type:**

| Type | Operators |
|------|-----------|
| **Text/Title/Rich text** | equals, does_not_equal, contains, does_not_contain, starts_with, ends_with, is_empty, is_not_empty |
| **Number** | equals, does_not_equal, greater_than, less_than, greater_than_or_equal_to, less_than_or_equal_to, is_empty, is_not_empty |
| **Select** | equals, does_not_equal, is_empty, is_not_empty |
| **Multi-select** | contains, does_not_contain, is_empty, is_not_empty |
| **Date** | equals, before, after, on_or_before, on_or_after, this_week, past_week, past_month, past_year, next_week, next_month, next_year, is_empty, is_not_empty |
| **Checkbox** | equals, does_not_equal |
| **People** | contains, does_not_contain, is_empty, is_not_empty |
| **Status** | equals, does_not_equal, is_empty, is_not_empty |
| **Relation** | contains, does_not_contain, is_empty, is_not_empty |

## Workspace Organization Best Practices

### Page Hierarchy

```
Workspace Root
├── 📋 Projects (database)
├── ✅ Tasks (database)
├── 👥 Team (database)
├── 📚 Knowledge Base (database)
├── 📝 Meeting Notes (database)
├── 🏢 Company
│   ├── Policies
│   ├── Processes
│   └── Templates
└── 📊 Dashboards
    ├── Weekly Review
    ├── Project Status
    └── Team Workload
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Databases | Plural nouns | Tasks, Projects, Clients |
| Pages | Descriptive titles | "Q1 Marketing Plan", "Onboarding Checklist" |
| Properties | Title Case | Due Date, Assigned To, Project |
| Select options | Consistent casing | High, Medium, Low (not HIGH, med, low) |
| Views | Purpose-based | "My Tasks", "Due This Week", "All Projects" |
| Templates | Prefixed | "[Template] Weekly Report" |

### Dashboard Pages

Create dashboard pages that embed linked views from multiple databases:

1. Create a new page called "Weekly Dashboard"
2. Add linked views (not copies) of key databases
3. Each linked view has its own filters/sorts
4. Arrange in a logical reading order

**Example Weekly Dashboard layout:**
- **Row 1:** Overdue tasks (filtered, sorted by priority) | This week's meetings
- **Row 2:** Active projects (board view by status) | Recent knowledge base updates
- **Row 3:** Team workload (tasks grouped by assignee) | Quick links

## Integration Tips

### Notion + Slack (via n8n)

Common pattern: Notify a Slack channel when Notion database entries change.

**Triggers to watch for:**
- New page created in a database
- Status changed to a specific value
- Due date is approaching (daily check)
- Page assigned to someone

**Message format tip:** Include a direct link to the Notion page using its URL: `https://notion.so/{page_id_without_hyphens}`

### Notion + Google Calendar (via n8n)

Sync Notion dates to Google Calendar events:
- Query Notion for entries with dates in the next 30 days
- Create/update Google Calendar events for each
- Include the Notion page link in the calendar event description

### Notion + Email (via n8n)

Capture emails as Notion pages:
- Monitor an inbox for emails matching criteria
- Parse subject, sender, body
- Create a page in a "Requests" or "Inbox" database
- Set properties: Sender (text), Date (from email date), Status (default: New)
