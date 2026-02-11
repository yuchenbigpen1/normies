# Google Sheets Formula Reference

Complete formula reference for business operators. Organized by category with real-world examples.

---

## Lookup Functions

### XLOOKUP (Recommended)

```
=XLOOKUP(search_key, lookup_range, result_range, [if_not_found], [match_mode], [search_mode])
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| search_key | Yes | The value to search for |
| lookup_range | Yes | The range to search in |
| result_range | Yes | The range to return values from |
| if_not_found | No | Value to return if no match (default: #N/A) |
| match_mode | No | 0=exact (default), -1=exact or smaller, 1=exact or larger, 2=wildcard |
| search_mode | No | 1=first to last (default), -1=last to first, 2=binary ascending, -2=binary descending |

**Examples:**

```
-- Look up a customer's email from their name
=XLOOKUP(A2, Customers!A:A, Customers!C:C, "Not found")

-- Find the price for a product (wildcard match)
=XLOOKUP("*Widget*", Products!A:A, Products!D:D, 0, 2)

-- Find the most recent entry (search from bottom)
=XLOOKUP(A2, Log!A:A, Log!D:D, "No entries", 0, -1)
```

### INDEX + MATCH

```
=INDEX(return_range, MATCH(search_key, lookup_range, match_type))
```

**Multi-criteria lookup:**
```
=INDEX(D:D, MATCH(1, (A:A=target_name)*(B:B=target_date), 0))
```
Note: This is an array formula — press Ctrl+Shift+Enter or wrap in ARRAYFORMULA.

### VLOOKUP (Legacy)

```
=VLOOKUP(search_key, range, col_index, [is_sorted])
```

**Limitation:** Lookup column MUST be the leftmost column in the range. Use XLOOKUP instead.

### HLOOKUP

```
=HLOOKUP(search_key, range, row_index, [is_sorted])
```

Horizontal lookup — searches the first row. Rarely needed; XLOOKUP handles both directions.

---

## Aggregation Functions

### Basic Aggregation

| Function | Syntax | Description |
|----------|--------|-------------|
| SUM | `=SUM(range)` | Total of all values |
| AVERAGE | `=AVERAGE(range)` | Mean of all values |
| MEDIAN | `=MEDIAN(range)` | Middle value |
| COUNT | `=COUNT(range)` | Count of numeric cells |
| COUNTA | `=COUNTA(range)` | Count of non-empty cells |
| COUNTBLANK | `=COUNTBLANK(range)` | Count of empty cells |
| MIN | `=MIN(range)` | Smallest value |
| MAX | `=MAX(range)` | Largest value |

### Conditional Aggregation

```
=SUMIF(criteria_range, criterion, sum_range)
=SUMIFS(sum_range, criteria_range1, criterion1, criteria_range2, criterion2, ...)
=COUNTIF(criteria_range, criterion)
=COUNTIFS(criteria_range1, criterion1, criteria_range2, criterion2, ...)
=AVERAGEIF(criteria_range, criterion, average_range)
=AVERAGEIFS(average_range, criteria_range1, criterion1, ...)
```

**Examples:**

```
-- Total sales for "West" region
=SUMIFS(E:E, B:B, "West")

-- Count of open deals over $10,000
=COUNTIFS(status, "Open", amount, ">10000")

-- Average order value for repeat customers
=AVERAGEIFS(order_total, customer_type, "Repeat")

-- Count unique values matching a condition
=COUNTUNIQUEIFS(A:A, B:B, "Active")
```

### Criteria Syntax

| Criteria | Meaning | Example |
|----------|---------|---------|
| `"text"` | Exact match | `"West"` |
| `">100"` | Greater than | `">100"` |
| `"<50"` | Less than | `"<50"` |
| `">="&B1` | Greater or equal to cell value | `">="&B1` |
| `"<>"` | Not empty | `"<>"` |
| `"*keyword*"` | Contains (wildcard) | `"*urgent*"` |
| `"?"` | Single character wildcard | `"A?"` matches "AB", "AC" |

---

## QUERY Function

The most powerful function in Google Sheets — SQL-like queries against spreadsheet data.

```
=QUERY(data, query_string, [headers])
```

### Supported Clauses

| Clause | Purpose | Example |
|--------|---------|---------|
| SELECT | Choose columns | `"SELECT A, B, D"` |
| WHERE | Filter rows | `"WHERE B = 'Active'"` |
| GROUP BY | Aggregate by category | `"GROUP BY A"` |
| PIVOT | Create cross-tab | `"PIVOT C"` |
| ORDER BY | Sort results | `"ORDER BY D DESC"` |
| LIMIT | Restrict row count | `"LIMIT 10"` |
| OFFSET | Skip rows | `"OFFSET 5"` |
| LABEL | Rename column headers | `"LABEL SUM(D) 'Total'"` |
| FORMAT | Format output values | `"FORMAT D '$#,##0'"` |

### Aggregate Functions in QUERY

| Function | Description |
|----------|-------------|
| `SUM(col)` | Sum of column |
| `AVG(col)` | Average of column |
| `COUNT(col)` | Count of values |
| `MAX(col)` | Maximum value |
| `MIN(col)` | Minimum value |

### WHERE Clause Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `WHERE A = 'NY'` |
| `!=` or `<>` | Not equals | `WHERE A != 'NY'` |
| `>`, `>=`, `<`, `<=` | Comparisons | `WHERE D > 100` |
| `contains` | Substring match | `WHERE A contains 'Corp'` |
| `starts with` | Prefix match | `WHERE A starts with 'A'` |
| `ends with` | Suffix match | `WHERE A ends with 'Inc'` |
| `matches` | Regex match | `WHERE A matches '.*@gmail.com'` |
| `like` | Pattern match (% wildcard) | `WHERE A like 'John%'` |
| `is null` | Empty check | `WHERE B is null` |
| `is not null` | Not empty check | `WHERE B is not null` |
| `and` | Logical AND | `WHERE A='NY' and D>100` |
| `or` | Logical OR | `WHERE A='NY' or A='CA'` |
| `not` | Logical NOT | `WHERE not A='NY'` |

### QUERY with Dates

Dates in QUERY use a special format:

```
-- Filter by specific date
=QUERY(A:D, "WHERE C = date '2026-02-11'")

-- Filter by date range
=QUERY(A:D, "WHERE C >= date '2026-01-01' AND C <= date '2026-03-31'")

-- Using cell references for dates
=QUERY(A:D, "WHERE C >= date '"&TEXT(B1,"yyyy-mm-dd")&"'")
```

### Common QUERY Recipes

```
-- Revenue by category, top 10
=QUERY(data, "SELECT B, SUM(D) WHERE C='Paid' GROUP BY B ORDER BY SUM(D) DESC LIMIT 10 LABEL SUM(D) 'Revenue'")

-- Monthly summary with formatted output
=QUERY(data, "SELECT YEAR(A), MONTH(A)+1, SUM(D) GROUP BY YEAR(A), MONTH(A)+1 ORDER BY YEAR(A), MONTH(A)+1 LABEL YEAR(A) 'Year', MONTH(A)+1 'Month', SUM(D) 'Total'")

-- Pivot table: categories as columns
=QUERY(data, "SELECT A, SUM(D) GROUP BY A PIVOT B")

-- Count with percentage
=QUERY(data, "SELECT B, COUNT(A), COUNT(A)/COUNT(A)*100 GROUP BY B LABEL COUNT(A) 'Count', COUNT(A)/COUNT(A)*100 'Percentage'")
```

---

## FILTER and SORT

### FILTER

```
=FILTER(range, condition1, [condition2], ...)
```

Multiple conditions act as AND. For OR, use `+`:

```
-- AND: active customers in West region
=FILTER(A:D, B:B="Active", C:C="West")

-- OR: customers in West OR East
=FILTER(A:D, (C:C="West")+(C:C="East"))
```

### SORT

```
=SORT(range, sort_column, is_ascending, [sort_column2], [is_ascending2], ...)
```

```
-- Sort by amount descending
=SORT(A2:D100, 4, FALSE)

-- Sort by status ascending, then date descending
=SORT(A2:D100, 2, TRUE, 3, FALSE)

-- Filter + Sort combined
=SORT(FILTER(A2:D100, B2:B100="Active"), 4, FALSE)
```

### UNIQUE

```
=UNIQUE(range)
```

Returns deduplicated values. Combine with other functions:

```
-- Unique categories with totals
={UNIQUE(B2:B100), ARRAYFORMULA(SUMIF(B2:B100, UNIQUE(B2:B100), D2:D100))}
```

### SORTN

```
=SORTN(range, n, display_ties_mode, sort_column, is_ascending)
```

Returns the top/bottom N items:

```
-- Top 5 customers by revenue
=SORTN(A2:D100, 5, 0, 4, FALSE)
```

---

## ARRAYFORMULA

Applies a formula to an entire range at once. Place in the first data row and it fills down automatically.

```
=ARRAYFORMULA(expression)
```

**Examples:**

```
-- Calculated column: quantity * price
=ARRAYFORMULA(IF(A2:A="", "", B2:B * C2:C))

-- Conditional text for entire column
=ARRAYFORMULA(IF(A2:A="", "", IF(D2:D>100, "High", "Normal")))

-- Lookup for entire column
=ARRAYFORMULA(IF(A2:A="", "", VLOOKUP(A2:A, reference_range, 2, FALSE)))
```

**Always include the empty check** (`IF(A2:A="", "", ...)`) to prevent filling empty rows.

---

## Date Functions

| Function | Syntax | Description |
|----------|--------|-------------|
| TODAY() | `=TODAY()` | Current date |
| NOW() | `=NOW()` | Current date and time |
| DATE | `=DATE(year, month, day)` | Create a date |
| YEAR/MONTH/DAY | `=YEAR(date)` | Extract component |
| WEEKDAY | `=WEEKDAY(date, [type])` | Day of week (1=Sun default) |
| WEEKNUM | `=WEEKNUM(date, [type])` | Week number |
| EOMONTH | `=EOMONTH(date, months)` | End of month N months away |
| EDATE | `=EDATE(date, months)` | Date N months from start |
| NETWORKDAYS | `=NETWORKDAYS(start, end, [holidays])` | Business days between dates |
| WORKDAY | `=WORKDAY(start, days, [holidays])` | Date N business days from start |
| DATEDIF | `=DATEDIF(start, end, unit)` | Difference in Y/M/D |

**Common date patterns:**

```
-- First day of current month
=EOMONTH(TODAY(), -1) + 1

-- Last day of current month
=EOMONTH(TODAY(), 0)

-- Days remaining in month
=EOMONTH(TODAY(), 0) - TODAY()

-- Quarter number
=ROUNDUP(MONTH(A2)/3, 0)

-- "Q1 2026" format
="Q" & ROUNDUP(MONTH(A2)/3, 0) & " " & YEAR(A2)

-- Is this date a weekday?
=WEEKDAY(A2, 2) <= 5

-- Business days between two dates (excluding holidays)
=NETWORKDAYS(start_date, end_date, holidays_range)

-- Age from birthdate
=DATEDIF(birth_date, TODAY(), "Y")
```

---

## Text Functions

| Function | Syntax | Description |
|----------|--------|-------------|
| CONCATENATE | `=A1 & " " & B1` | Join text (use & operator) |
| LEFT/RIGHT/MID | `=LEFT(text, n)` | Extract characters |
| LEN | `=LEN(text)` | Character count |
| TRIM | `=TRIM(text)` | Remove extra spaces |
| CLEAN | `=CLEAN(text)` | Remove non-printable characters |
| UPPER/LOWER/PROPER | `=PROPER(text)` | Change case |
| SUBSTITUTE | `=SUBSTITUTE(text, old, new)` | Replace text |
| REGEXMATCH | `=REGEXMATCH(text, regex)` | Test regex pattern |
| REGEXEXTRACT | `=REGEXEXTRACT(text, regex)` | Extract regex match |
| REGEXREPLACE | `=REGEXREPLACE(text, regex, replacement)` | Replace with regex |
| SPLIT | `=SPLIT(text, delimiter)` | Split into columns |
| JOIN | `=JOIN(delimiter, range)` | Combine into one cell |
| TEXT | `=TEXT(value, format)` | Format number/date as text |
| VALUE | `=VALUE(text)` | Convert text to number |

**Common text patterns:**

```
-- Extract domain from email
=REGEXEXTRACT(A2, "@(.+)$")

-- Clean phone numbers (remove non-digits)
=REGEXREPLACE(A2, "[^0-9]", "")

-- First name from full name
=LEFT(A2, FIND(" ", A2) - 1)

-- Last name from full name
=MID(A2, FIND(" ", A2) + 1, LEN(A2))

-- Format currency
=TEXT(A2, "$#,##0.00")

-- Format percentage
=TEXT(A2, "0.0%")
```

---

## LET and LAMBDA

### LET — Name Intermediate Values

```
=LET(name1, value1, name2, value2, ..., expression)
```

```
-- Revenue after tax and discount (readable version)
=LET(
  subtotal, B2 * C2,
  discount, subtotal * D2,
  after_discount, subtotal - discount,
  tax, after_discount * 0.1,
  after_discount + tax
)
```

### LAMBDA — Custom Functions

```
=LAMBDA(param1, param2, ..., expression)
```

```
-- Define and immediately call
=LAMBDA(price, qty, price * qty * 1.1)(B2, C2)

-- Use with MAP to apply across a range
=MAP(A2:A100, LAMBDA(val, UPPER(TRIM(val))))

-- Use with REDUCE for running total
=REDUCE(0, B2:B100, LAMBDA(acc, val, acc + val))

-- Use with BYROW for row-level calculations
=BYROW(B2:D100, LAMBDA(row, SUM(row)))
```

---

## Data Import Functions

| Function | Syntax | Description |
|----------|--------|-------------|
| IMPORTRANGE | `=IMPORTRANGE("url", "range")` | Pull data from another spreadsheet |
| IMPORTDATA | `=IMPORTDATA("url")` | Import CSV/TSV from URL |
| IMPORTHTML | `=IMPORTHTML("url", "table", index)` | Import HTML table |
| IMPORTXML | `=IMPORTXML("url", xpath)` | Import data via XPath |
| IMPORTFEED | `=IMPORTFEED("url")` | Import RSS/Atom feed |
| IMAGE | `=IMAGE("url", [mode])` | Display image in cell |
| SPARKLINE | `=SPARKLINE(range, {"charttype","bar"})` | Mini chart in cell |

**IMPORTRANGE tips:**
- First use requires clicking "Allow access" in the target sheet
- Combine with QUERY for filtered imports:
  ```
  =QUERY(IMPORTRANGE("url", "Sheet1!A:D"), "SELECT Col1, Col2 WHERE Col3='Active'")
  ```
- Performance: large IMPORTRANGE formulas can slow down sheets — limit to what you need

---

## Conditional Logic

```
-- Simple IF
=IF(condition, value_if_true, value_if_false)

-- Nested IF (avoid deep nesting — use IFS instead)
=IF(A2>90, "A", IF(A2>80, "B", IF(A2>70, "C", "F")))

-- IFS (cleaner alternative to nested IF)
=IFS(A2>90, "A", A2>80, "B", A2>70, "C", TRUE, "F")

-- SWITCH (match specific values)
=SWITCH(A2, "NY", "New York", "CA", "California", "TX", "Texas", "Unknown")

-- IFERROR (catch errors gracefully)
=IFERROR(B2/C2, 0)

-- IFNA (catch #N/A specifically)
=IFNA(VLOOKUP(...), "Not found")
```

---

## Useful Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+V | Paste values only (no formatting) |
| Ctrl+` | Toggle formula view |
| F2 | Edit active cell |
| Ctrl+Enter | Fill selected range with formula |
| Ctrl+Shift+1 | Format as number |
| Ctrl+Shift+4 | Format as currency |
| Ctrl+Shift+5 | Format as percentage |
| Alt+Enter | New line within a cell |
| Ctrl+; | Insert today's date |
