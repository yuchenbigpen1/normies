# Notion Business Templates — Full Schemas

Detailed property definitions for each business template referenced in the main skill.

## CRM-Lite

### Contacts Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Name | Title | — | Full name of the contact |
| Company | Relation | → Companies | Which company they belong to |
| Email | Email | — | Primary email |
| Phone | Phone | — | Primary phone |
| Role | Text | — | Job title / role |
| Lead Source | Select | Options: Referral, Website, Cold Outreach, Event, Social Media, Partner | How they found you |
| Status | Status | Not started, Contacted, Qualified, Customer, Churned | Lifecycle stage |
| Last Contacted | Date | — | When you last reached out |
| Notes | Text | — | Quick notes (detail goes in page content) |
| Deals | Relation | → Deals | Associated deals (auto-populated) |
| Activities | Relation | → Activities | All logged touchpoints |

### Companies Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Name | Title | — | Company name |
| Website | URL | — | Company website |
| Industry | Select | Options: SaaS, E-commerce, Agency, Consulting, Manufacturing, Healthcare, Finance, Education, Other | Industry category |
| Size | Select | Options: 1-10, 11-50, 51-200, 201-500, 500+ | Employee count range |
| Contacts | Relation | → Contacts | All people at this company |
| Deals | Relation | → Deals | All deals with this company |
| Total Revenue | Rollup | Sum of Deals → Value (where Stage = Closed Won) | Lifetime revenue |
| Active Deals | Rollup | Count of Deals (where Stage ≠ Closed Won, Closed Lost) | Open pipeline |

### Deals Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Deal Name | Title | — | Descriptive deal name |
| Contact | Relation | → Contacts | Primary contact |
| Company | Relation | → Companies | Associated company |
| Value | Number | Format: USD | Deal dollar amount |
| Stage | Select | Options: Lead, Contacted, Proposal, Negotiation, Closed Won, Closed Lost | Pipeline stage |
| Expected Close | Date | — | When you expect to close |
| Priority | Select | Options: High, Medium, Low | Deal priority |
| Owner | Person | — | Sales rep responsible |
| Activities | Relation | → Activities | Related touchpoints |
| Created | Created time | — | When deal was created |

### Activities Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Title | Title | — | Activity description ("Call with John re: pricing") |
| Type | Select | Options: Call, Email, Meeting, Note, Demo, Follow-up | Activity type |
| Date | Date | — | When it happened |
| Contact | Relation | → Contacts | Who was involved |
| Deal | Relation | → Deals | Related deal (if any) |
| Logged By | Person | — | Who logged this |
| Outcome | Text | — | Brief result ("Interested, sending proposal Friday") |

---

## Project Tracker

### Projects Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Project Name | Title | — | Descriptive project name |
| Owner | Person | — | Project lead |
| Status | Status | Not started, Planning, In progress, On hold, Complete | Project lifecycle |
| Priority | Select | Options: Critical, High, Medium, Low | Priority level |
| Start Date | Date | — | Project start |
| End Date | Date | — | Target completion |
| Tasks | Relation | → Tasks | All tasks in this project |
| Milestones | Relation | → Milestones | Key checkpoints |
| Task Count | Rollup | Count of Tasks | Total tasks |
| Completed Tasks | Rollup | Count of Tasks (where Status = Done) | Done tasks |
| Progress | Formula | `round(prop("Completed Tasks") / prop("Task Count") * 100)` | Percentage complete |
| Total Hours | Rollup | Sum of Tasks → Actual Hours | Time invested |

### Tasks Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Task | Title | — | What needs to be done |
| Project | Relation | → Projects | Parent project |
| Assignee | Person | — | Who's doing it |
| Status | Status | Not started, In progress, In review, Blocked, Done | Task workflow |
| Priority | Select | Options: Urgent, High, Medium, Low | Task priority |
| Due Date | Date | — | Deadline |
| Estimated Hours | Number | — | Time estimate |
| Actual Hours | Number | — | Time spent |
| Milestone | Relation | → Milestones | Related milestone |
| Dependencies | Relation | → Tasks (self-relation) | Blocked by these tasks |
| Unique ID | Unique ID | Prefix: TASK | Auto-generated (TASK-001, etc.) |

### Milestones Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Milestone | Title | — | Milestone name |
| Project | Relation | → Projects | Parent project |
| Target Date | Date | — | When this should be reached |
| Status | Status | Upcoming, At risk, Achieved, Missed | Milestone status |
| Tasks | Relation | → Tasks | Tasks that must be done for this milestone |
| Task Progress | Rollup | % of Tasks where Status = Done | Completion percentage |

---

## Content Calendar

### Content Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Title | Title | — | Content headline / working title |
| Type | Select | Options: Blog Post, Social Post, Newsletter, Video, Podcast, Case Study | Content format |
| Status | Status | Idea, Assigned, Writing, Editing, Review, Scheduled, Published | Pipeline stage |
| Publish Date | Date | — | Target or actual publish date |
| Author | Person | — | Content creator |
| Channel | Relation | → Channels | Where this will be published |
| Topic | Relation | → Topics | Content theme/category |
| SEO Keywords | Multi-select | — | Target keywords |
| Word Count | Number | — | Target or actual word count |
| URL | URL | — | Published URL (filled after publishing) |
| Performance | Text | — | Quick metrics note after publishing |

### Channels Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Channel | Title | — | Channel name (Blog, Twitter, etc.) |
| Platform | Select | Options: Website, Twitter/X, LinkedIn, Instagram, YouTube, Newsletter, Podcast | Platform type |
| Posting Cadence | Text | — | "2x/week" or "Monthly" |
| Content | Relation | → Content | All content for this channel |
| Published Count | Rollup | Count of Content (where Status = Published) | Total published |

### Topics Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Topic | Title | — | Theme name |
| Description | Text | — | What this topic covers |
| Content | Relation | → Content | All content under this topic |
| Content Count | Rollup | Count of Content | How many pieces per topic |
| Pillar? | Checkbox | — | Is this a pillar/cornerstone topic? |

---

## Meeting Notes

### Meetings Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Title | Title | — | Meeting name |
| Date | Date | — | Meeting date/time |
| Type | Select | Options: Standup, Weekly Sync, 1:1, All Hands, Client Call, Workshop, Retrospective | Meeting category |
| Attendees | Person | — | Who attended |
| Project | Relation | → Projects | Related project (if applicable) |
| Status | Status | Scheduled, In progress, Completed, Cancelled | Meeting state |
| Action Items Count | Number | — | Manually updated or use formula |
| Recording URL | URL | — | Link to recording if available |
| Unique ID | Unique ID | Prefix: MTG | Auto-generated |

**Page template for each meeting:**

```markdown
## Agenda
- [ ] Item 1
- [ ] Item 2

## Notes


## Decisions
1.

## Action Items
- [ ] @Person — Task — by Date
```

---

## Knowledge Base

### Articles Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Title | Title | — | Article title |
| Category | Select | Options: How-to, Policy, Process, FAQ, Troubleshooting, Reference | Content type |
| Tags | Multi-select | — | Searchable tags |
| Author | Person | — | Who wrote it |
| Status | Status | Draft, In review, Published, Archived | Article lifecycle |
| Audience | Select | Options: Internal, External, Both | Who can see this |
| Last Reviewed | Date | — | When content was last verified |
| Related Articles | Relation | → Articles (self-relation) | Cross-linking |
| Needs Review | Formula | `if(dateBetween(now(), prop("Last Reviewed"), "days") > 90, true, false)` | Auto-flag stale content |

---

## Employee Directory

### Team Members Database

| Property | Type | Config | Notes |
|----------|------|--------|-------|
| Name | Title | — | Full name |
| Role | Text | — | Job title |
| Department | Select | Options: Engineering, Design, Marketing, Sales, Operations, Finance, HR, Leadership | Department |
| Manager | Relation | → Team Members (self-relation) | Reports to |
| Direct Reports | Relation | → Team Members (self-relation, reverse) | Who reports to them |
| Start Date | Date | — | Employment start date |
| Location | Select | Options: Remote, NYC, SF, London, Berlin | Work location |
| Email | Email | — | Work email |
| Phone | Phone | — | Work phone |
| Skills | Multi-select | — | Key skills/expertise |
| Timezone | Select | Options: PT, MT, CT, ET, GMT, CET | Working timezone |
| Tenure | Formula | `dateBetween(now(), prop("Start Date"), "months")` | Months at company |
