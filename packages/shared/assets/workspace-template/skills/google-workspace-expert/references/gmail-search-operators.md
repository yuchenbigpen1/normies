# Gmail Search Operators Reference

Complete reference for Gmail search operators. Use these for finding emails programmatically, building filters, and automating email workflows.

---

## Sender & Recipient

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:john@example.com` | Messages from a specific sender |
| `to:` | `to:jane@example.com` | Messages sent to a specific address |
| `cc:` | `cc:team@example.com` | Messages where address was CC'd |
| `bcc:` | `bcc:boss@example.com` | Messages where address was BCC'd |
| `deliveredto:` | `deliveredto:me@example.com` | Delivered to a specific address (useful for aliases) |
| `list:` | `list:info@mailing.example.com` | Messages from a mailing list |

**Tips:**
- `from:me` and `to:me` work as shortcuts for your own address
- Partial matches work: `from:@company.com` matches any sender from that domain
- Multiple addresses need OR: `from:john OR from:jane`

---

## Content Search

| Operator | Example | Description |
|----------|---------|-------------|
| `subject:` | `subject:invoice` | Search in subject line only |
| `"exact phrase"` | `"quarterly report"` | Match an exact phrase |
| `+word` | `+meeting` | Exact word match (no stemming) |
| `AROUND` | `budget AROUND 5 review` | Words within N words of each other |

**Notes:**
- Without an operator, search looks in subject, body, and sender
- Quoted phrases must match exactly (case-insensitive)
- `AROUND` is useful for finding related words that appear near each other

---

## Boolean Logic

| Operator | Example | Description |
|----------|---------|-------------|
| `AND` | `from:john AND has:attachment` | Both conditions (implicit between terms) |
| `OR` | `from:john OR from:jane` | Either condition |
| `{ }` | `{from:john from:jane}` | Alternative OR syntax |
| `-` | `-from:newsletter@` | Exclude (NOT) |
| `NOT` | `NOT label:archived` | Exclude (alternative to -) |
| `( )` | `subject:(budget OR forecast)` | Group terms |

**Precedence:** NOT > AND > OR. Use parentheses to be explicit.

**Examples:**
```
-- Emails from john OR jane with attachments
{from:john from:jane} has:attachment

-- Emails about budget but NOT from finance dept
subject:budget -from:@finance.company.com

-- Complex grouping
from:client (subject:urgent OR subject:critical) has:attachment
```

---

## Location & Labels

| Operator | Example | Description |
|----------|---------|-------------|
| `in:inbox` | `in:inbox` | Inbox only |
| `in:sent` | `in:sent` | Sent mail only |
| `in:drafts` | `in:drafts` | Drafts only |
| `in:trash` | `in:trash` | Trash only |
| `in:spam` | `in:spam` | Spam only |
| `in:anywhere` | `in:anywhere invoice` | Search everywhere including Spam and Trash |
| `in:snoozed` | `in:snoozed` | Snoozed messages |
| `in:chats` | `in:chats` | Google Chat messages |
| `label:` | `label:work` | Messages with a specific label |
| `has:userlabels` | `has:userlabels` | Messages with any user-created label |
| `has:nouserlabels` | `has:nouserlabels` | Messages without user labels |
| `category:` | `category:primary` | Messages in a category tab |

**Category values:** `primary`, `social`, `promotions`, `updates`, `forums`, `reservations`, `purchases`

**Nested labels:** Use `/` separator: `label:clients/acme`

---

## Status Flags

| Operator | Example | Description |
|----------|---------|-------------|
| `is:starred` | `is:starred` | Starred messages |
| `is:unstarred` | `is:unstarred` | Not starred |
| `is:read` | `is:read` | Read messages |
| `is:unread` | `is:unread` | Unread messages |
| `is:important` | `is:important` | Marked important (priority inbox) |
| `is:snoozed` | `is:snoozed` | Snoozed messages |
| `is:muted` | `is:muted` | Muted conversations |

**Star type variants:**
- `has:yellow-star`, `has:red-star`, `has:orange-star`, `has:green-star`, `has:blue-star`, `has:purple-star`
- `has:blue-info`, `has:green-check`, `has:red-bang`, `has:orange-guillemet`, `has:purple-question`

---

## Attachments

| Operator | Example | Description |
|----------|---------|-------------|
| `has:attachment` | `has:attachment` | Any attachment |
| `has:drive` | `has:drive` | Google Drive links |
| `has:document` | `has:document` | Google Docs attached |
| `has:spreadsheet` | `has:spreadsheet` | Google Sheets attached |
| `has:presentation` | `has:presentation` | Google Slides attached |
| `has:youtube` | `has:youtube` | YouTube links |
| `filename:` | `filename:report.pdf` | Specific filename |
| `filename:` | `filename:pdf` | File extension only |
| `filename:` | `filename:xlsx OR filename:csv` | Multiple types |

**Common file type searches:**
```
filename:pdf                -- PDF files
filename:xlsx               -- Excel files
filename:csv                -- CSV files
filename:png OR filename:jpg -- Images
filename:zip OR filename:rar -- Archives
filename:docx               -- Word documents
```

---

## Size

| Operator | Example | Description |
|----------|---------|-------------|
| `size:` | `size:5000000` | Larger than N bytes |
| `larger:` | `larger:10M` | Larger than (with K/M suffix) |
| `smaller:` | `smaller:1M` | Smaller than (with K/M suffix) |

**Size suffixes:** K (kilobytes), M (megabytes)

**Storage cleanup queries:**
```
larger:10M older_than:1y        -- Large old emails
has:attachment larger:5M         -- Big attachments
larger:25M                       -- Very large (near attachment limit)
```

---

## Date & Time

### Absolute Dates

| Operator | Example | Description |
|----------|---------|-------------|
| `before:` | `before:2025/01/01` | Before a date |
| `after:` | `after:2025/06/01` | After a date |
| `older:` | `older:2025/01/01` | Same as before: |
| `newer:` | `newer:2025/06/01` | Same as after: |

**Date format:** `YYYY/MM/DD` (year/month/day)

### Relative Dates

| Operator | Example | Description |
|----------|---------|-------------|
| `older_than:` | `older_than:7d` | Older than N units |
| `newer_than:` | `newer_than:2m` | Newer than N units |

**Time units:** `d` (days), `m` (months), `y` (years)

**Examples:**
```
newer_than:24h               -- Last 24 hours (note: hours work too)
newer_than:7d                -- Last week
newer_than:1m                -- Last month
older_than:1y                -- Over a year old
after:2025/01/01 before:2025/03/31  -- Q1 2025
```

---

## Message Properties

| Operator | Example | Description |
|----------|---------|-------------|
| `rfc822msgid:` | `rfc822msgid:<id>` | Find by Message-ID header |
| `is:chat` | `is:chat` | Google Chat messages |

---

## Business Recipes

### Inbox Management

```
-- Unread from important senders (customize the list)
is:unread {from:boss@co.com from:client@co.com from:partner@co.com}

-- Action required (unread with no label, in inbox)
is:unread in:inbox has:nouserlabels

-- Waiting for reply (sent by me, no reply yet)
in:sent to:client@co.com newer_than:7d -in:inbox
```

### Financial

```
-- All invoices this year
subject:invoice after:2026/01/01

-- Receipts with attachments
{subject:receipt subject:confirmation} has:attachment filename:pdf

-- Payment notifications
from:@stripe.com OR from:@paypal.com OR from:@square.com
```

### Client Communication

```
-- All emails with a specific client (any direction)
{from:@client.com to:@client.com}

-- Recent client emails with attachments
{from:@client.com to:@client.com} has:attachment newer_than:30d

-- Contracts and agreements
{subject:contract subject:agreement subject:SOW} has:attachment filename:pdf
```

### Storage Cleanup

```
-- Large old emails (safe to archive/delete)
larger:10M older_than:1y

-- Old promotional emails
category:promotions older_than:6m

-- Old social notifications
category:social older_than:3m

-- Large attachments from automated systems
has:attachment larger:5M from:noreply@
```

### Newsletter & Subscription Management

```
-- Find all newsletters
{subject:unsubscribe list:}

-- Automated notifications (often safe to bulk archive)
{from:noreply@ from:no-reply@ from:notification@}

-- Marketing emails
category:promotions newer_than:30d
```

### Team & Project

```
-- All emails in a project thread
subject:"Project Phoenix" newer_than:90d

-- Emails mentioning a specific person
"John Smith" -from:john@co.com newer_than:30d

-- Meeting-related emails
{subject:agenda subject:"meeting notes" subject:"action items"} newer_than:14d
```

---

## Filter Automation Rules

Use these searches as Gmail filter criteria. Create filters via Settings > Filters and Blocked Addresses > Create a new filter.

### Recommended Starter Filters

| Criteria | Action | Purpose |
|----------|--------|---------|
| `from:noreply@ OR from:notification@` | Skip Inbox, Apply label "Automated" | Keep inbox clean |
| `list:` (any mailing list) | Skip Inbox, Apply label "Lists" | Mailing lists don't clutter inbox |
| `from:@importantclient.com` | Star, Apply label "Clients/Name" | Never miss client emails |
| `subject:invoice OR subject:receipt` | Apply label "Finance" | Auto-organize financials |
| `has:attachment filename:pdf from:@vendor.com` | Apply label "Vendor/Docs" | Collect vendor documents |
| `to:billing@yourdomain.com` | Apply label "Finance/Billing", Star | Route billing emails |
| `from:calendar-notification@google.com` | Skip Inbox, Apply label "Calendar" | Calendar updates out of inbox |

### Filter Tips

1. **Test first** — type the search in Gmail to verify matches before creating a filter
2. **"Also apply to matching conversations"** — check this to retroactively organize existing emails
3. **Multiple actions** — one filter can label AND star AND skip inbox simultaneously
4. **Order doesn't matter** — Gmail applies all matching filters, not just the first one
5. **Export for backup** — Settings > Filters > Export to save as XML
6. **Keep it manageable** — 10-15 well-designed filters beats 50 overlapping ones
