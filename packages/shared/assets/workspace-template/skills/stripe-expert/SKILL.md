---
name: Stripe Expert
description: Revenue operations knowledge for business operators — dashboard reading, subscription management, invoicing, reporting, and payment operations. Not a developer guide — domain expertise for running your business on Stripe.
---

# Stripe Expert

You are an expert at helping non-technical business operators manage their revenue operations in Stripe. You understand Stripe's products, dashboard, and business workflows deeply, and can translate business needs into the right Stripe actions.

**This skill is NOT about connecting to Stripe** — Normies handles that via the Stripe MCP source or API source. This skill gives you the domain knowledge to do great work once connected.

## When to Use This Skill

- User asks about revenue metrics (MRR, ARR, churn, etc.)
- User needs to manage subscriptions, invoices, or refunds
- User wants to understand their Stripe dashboard data
- User asks about payment operations (disputes, payment links, coupons)
- User needs help with Stripe reporting or data export
- User mentions payment processing, billing, or revenue questions

## Critical Safety Rules

Before doing ANYTHING in Stripe, follow these rules:

### Test Mode vs. Live Mode

This is the most important concept in Stripe. Getting it wrong costs real money.

| Mode | What It Does | API Keys Start With | Dashboard URL |
|------|-------------|---------------------|---------------|
| **Test mode** | Fake transactions, no real money moves | `sk_test_` / `pk_test_` | Shows "TEST DATA" banner |
| **Live mode** | Real transactions, real money | `sk_live_` / `pk_live_` | No banner — this is production |

**Rules:**
1. **Always confirm which mode you're in** before making any changes
2. **If the user's API key starts with `sk_live_`** — warn them before every write operation
3. **Never create test data in live mode** — always switch to test mode first
4. **When practicing or exploring** — always use test mode
5. **Test card numbers only work in test mode** — `4242 4242 4242 4242` is the standard test card

### What Operators Should NEVER Do

- **Never share or log API secret keys** (`sk_live_*` or `sk_test_*`) — these give full account access
- **Never store raw card numbers** — that violates PCI compliance (Stripe handles this for you)
- **Never delete customers with active subscriptions** — cancel subscriptions first
- **Never modify live webhooks** without understanding the downstream impact
- **Never ignore disputes** — you have limited time to respond (usually 7-21 days)

### PCI Compliance Basics

PCI compliance means following rules to keep credit card data safe. Here's what operators need to know:

- **Stripe handles the hard part** — card numbers never touch your servers if you use Stripe Checkout, Payment Links, or Elements
- **You are responsible for** — keeping your Stripe account secure (strong password, 2FA), not sharing API keys, not storing card data outside Stripe
- **If someone asks you to store card numbers in a spreadsheet or database — say no.** That's a PCI violation.

## Revenue Metrics

Understanding these numbers is fundamental to running a subscription business.

### Key Metrics Explained

| Metric | What It Means | Plain English | Where to Find It |
|--------|--------------|---------------|------------------|
| **MRR** | Monthly Recurring Revenue | How much subscription revenue comes in each month | Dashboard → Revenue |
| **ARR** | Annual Recurring Revenue | MRR × 12 — your yearly run rate | Calculate from MRR |
| **Churn rate** | % of subscribers who cancel per period | How fast you're losing customers | Dashboard → Revenue → Subscriber churn |
| **Net revenue** | Gross revenue minus refunds and disputes | What you actually keep | Dashboard → Revenue |
| **ARPU** | Average Revenue Per User | Total revenue ÷ number of customers | Calculate from data |
| **LTV** | Lifetime Value | Average revenue from a customer over their entire relationship | ARPU ÷ monthly churn rate |
| **Gross margin** | Revenue minus cost of goods sold | What's left after direct costs | Not in Stripe — calculate separately |

### MRR Movements

MRR doesn't just go up or down — it changes for specific reasons:

| Movement | What Happened | Example |
|----------|--------------|---------|
| **New MRR** | New subscriber signed up | Customer starts a $50/mo plan |
| **Expansion MRR** | Existing subscriber upgraded | Customer moves from $50 to $100/mo plan |
| **Contraction MRR** | Existing subscriber downgraded | Customer moves from $100 to $50/mo plan |
| **Churned MRR** | Subscriber canceled | Customer cancels their $50/mo plan |
| **Reactivation MRR** | Former subscriber came back | Previously canceled customer restarts |

**Net New MRR** = New + Expansion + Reactivation - Contraction - Churned

This is the single most important number for a subscription business. If it's positive, you're growing. If it's negative, you're shrinking.

### Reading the Stripe Dashboard

The Stripe Dashboard is your command center. Here's what each section shows:

**Home** — Overview of recent activity: payments, payouts, disputes, balance

**Payments** — Every transaction. Filter by status:
- **Succeeded** — Money collected
- **Failed** — Card declined or error
- **Incomplete** — Requires action (3D Secure, etc.)
- **Refunded** — Money returned to customer

**Customers** — Your customer directory. Each customer shows:
- Contact info, payment methods, subscriptions, invoices, payment history
- **Tip:** Use metadata to store your internal customer ID or CRM link

**Subscriptions** — All recurring billing:
- Active, past due, canceled, trialing, paused
- **Past due** means payment failed but subscription hasn't been canceled yet — Stripe will retry

**Invoices** — Every invoice generated (subscription or one-off):
- Draft, open, paid, void, uncollectible
- **Draft** invoices haven't been sent yet — you can still edit them

**Revenue** (Billing → Revenue) — Your key subscription metrics:
- MRR over time, subscriber count, churn rate, MRR movements

**Balance** — Money Stripe is holding before sending to your bank:
- Available balance (ready to pay out)
- Pending balance (waiting for processing, usually 2-7 days)

**Payouts** — When and how much Stripe sends to your bank account

## Customer Management

### Creating Customers

Every person or company who pays you should be a Stripe customer. This lets you:
- Save their payment methods for future charges
- Track their complete payment history
- Manage subscriptions and invoices in one place

**Essential customer fields:**
- **Email** (required for invoicing and receipts)
- **Name** (for invoices and identification)
- **Description** (your internal notes — "Enterprise client, signed Jan 2026")
- **Metadata** (key-value pairs for your internal data — CRM ID, account manager, etc.)

### Customer Lifecycle

```
New Lead → Trial (optional) → Active Subscriber → [Upgrade/Downgrade] → Churned → [Reactivated]
```

**Best practices:**
- Create the customer in Stripe when they sign up, not when they first pay
- Use metadata to link Stripe customers to your CRM or internal systems
- Set up email receipts and invoice notifications in Dashboard → Settings → Emails

### Managing Payment Methods

Customers can have multiple payment methods. One is marked as **default** and used for automatic charges.

**Common issues operators face:**
- **Expired card** — Stripe automatically updates cards via card account updater (for supported banks). You'll see failed payments if the update doesn't work
- **Declined payment** — Stripe's Smart Retries will automatically try again with optimal timing
- **Customer wants to switch cards** — Update default payment method through the dashboard or customer portal

## Subscription Management

Subscriptions are the core of recurring billing. Here's how they work in practice.

### Subscription Lifecycle

| Status | What It Means | What to Do |
|--------|--------------|------------|
| **Trialing** | Free trial period, no charges yet | Nothing — wait for trial to end |
| **Active** | Payment successful, subscription is running | Normal state — no action needed |
| **Past due** | Payment failed, Stripe is retrying | Check customer's payment method, contact if needed |
| **Unpaid** | All retry attempts failed | Contact customer or cancel subscription |
| **Canceled** | Subscription ended | Customer stopped paying or you canceled it |
| **Paused** | Temporarily stopped (if you enable this) | Subscription will resume later |
| **Incomplete** | First payment needs action (e.g., 3D Secure) | Customer needs to complete payment |

### Common Subscription Operations

**Upgrading a customer:**
- Change their subscription to a higher-priced plan
- Stripe automatically prorates — the customer pays the difference for the remaining billing period
- The next invoice will be at the new price

**Downgrading a customer:**
- Change to a lower-priced plan
- Proration creates a credit on the customer's account
- Choose when the downgrade takes effect: immediately or at end of billing period

**Canceling a subscription:**
- **Cancel immediately** — subscription ends now, optionally prorate a refund
- **Cancel at period end** — subscription stays active until the current period ends (most common, most customer-friendly)
- Always confirm with the user which approach they want

**Pausing a subscription (if enabled):**
- Temporarily stops billing without canceling
- Useful for seasonal businesses or customer retention ("pause instead of cancel")

**Offering a trial:**
- Set a trial period (e.g., 14 days) on the subscription
- No payment collected during trial
- Trial can require a payment method upfront (reduces no-shows) or not

### Pricing Models

| Model | How It Works | Best For |
|-------|-------------|----------|
| **Flat rate** | Same price every month ($50/mo) | Simple SaaS, memberships |
| **Per seat** | Price × number of users ($10/user/mo) | Team tools, collaboration software |
| **Tiered** | Price changes at quantity thresholds | API usage, volume discounts |
| **Usage-based** | Pay for what you use (metered billing) | Infrastructure, API calls |
| **Flat + usage** | Base fee plus metered overage | SaaS with usage limits |

**Tip for operators:** Start with flat-rate pricing. It's the easiest to understand, explain, and manage. Only add complexity when you have a clear business reason.

### Products and Prices

In Stripe, pricing is organized as:

```
Product (what you sell)
  └── Price (how much it costs — can have multiple prices per product)
       └── Subscription (a customer subscribed to this price)
```

**Example:**
- Product: "Pro Plan"
  - Price: $49/month (monthly billing)
  - Price: $470/year (annual billing — ~20% discount)
  - Price: $99/month (legacy price, archived)

**Important:** Once a price is used by a subscription, you can't change the amount. Instead, create a new price and migrate customers to it. You can archive old prices so they don't appear in new checkouts.

## Invoicing

Invoices are the paper trail of every charge. Stripe creates them automatically for subscriptions, and you can create them manually for one-off charges.

### Invoice Lifecycle

```
Draft → Open → Paid (success path)
Draft → Open → Void (canceled before payment)
Draft → Open → Uncollectible (gave up on collecting)
```

**Draft** — Invoice is being prepared. You can add/remove line items, change amounts. Not visible to customer yet.

**Open** — Invoice has been sent/finalized. Customer can see it and pay. The amount is locked.

**Paid** — Payment received. This is the end state you want.

**Void** — You decided not to collect. No money changes hands. Use this when an invoice was created by mistake.

**Uncollectible** — You've given up trying to collect. Use this after multiple failed attempts. It's an accounting marker, not a refund.

### One-Off Invoices

For charges outside of subscriptions:
1. Create a draft invoice for the customer
2. Add line items (description, quantity, unit price)
3. Review the total
4. Finalize and send

**Use cases:** consulting fees, setup charges, custom work, overages

### Invoice Settings Worth Knowing

- **Auto-advance** — Draft invoices automatically finalize after 1 hour (configurable)
- **Days until due** — How many days the customer has to pay (default: 30 for emailed invoices)
- **Payment methods** — Which payment types the invoice accepts (card, bank transfer, etc.)
- **Footer and memo** — Add custom text to invoices (terms, thank you messages)
- **Numbering** — Stripe auto-numbers invoices. You can set a prefix (e.g., "INV-") in settings

## Payment Operations

### Refunds

| Refund Type | What Happens | When to Use |
|-------------|-------------|-------------|
| **Full refund** | Entire amount returned to customer | Customer wants a complete undo |
| **Partial refund** | Part of the amount returned | Partial service, goodwill gesture |
| **Credit note** | Credit applied to future invoices (no cash back) | Subscription adjustments, future discount |

**Refund timelines:**
- Card refunds: 5-10 business days to appear on customer's statement
- Bank transfer refunds: can take longer
- Stripe refunds your processing fees on full refunds (not partial)

**Important:** Refunds don't automatically cancel subscriptions. If you refund and want to stop future billing, cancel the subscription separately.

### Disputes (Chargebacks)

A dispute happens when a customer asks their bank to reverse a charge. This is serious.

**Dispute timeline:**
1. Customer contacts their bank → bank creates dispute → Stripe notifies you
2. **You have 7-21 days to respond** (depends on card network)
3. You submit evidence (receipts, delivery proof, communication history)
4. Bank reviews and decides (takes 60-90 days)

**Dispute fees:** Stripe charges a $15 dispute fee. If you win the dispute, the fee is returned.

**How to reduce disputes:**
- Use clear, recognizable statement descriptors (what appears on the customer's bank statement)
- Send email receipts for every charge
- Make your cancellation/refund process easy and visible
- Respond to customer complaints quickly — a refund is cheaper than a dispute

**Evidence to submit when fighting a dispute:**
- Proof of delivery or service rendered
- Customer communication showing they authorized the charge
- Your refund policy / terms of service
- IP address or device info from the transaction

### Payment Links

Payment Links are the simplest way to collect payment — no code, no website needed.

**Creating a Payment Link:**
1. Dashboard → Payment Links → New
2. Choose product/price or enter a custom amount
3. Configure options (quantity adjustable, allow promo codes, collect shipping address)
4. Get a shareable URL

**Use cases:**
- Quick one-off payments (consulting, freelance work)
- Selling a product without a full website
- Event registration or workshop fees
- Donations or tips

**Tip:** Payment Links can be reused. Share them via email, text, social media, or embed on a website.

### Coupons and Promotion Codes

| Concept | What It Is | Example |
|---------|-----------|---------|
| **Coupon** | The actual discount rule (amount or percentage, duration) | 20% off for 3 months |
| **Promotion code** | A shareable code that applies a coupon | "SAVE20" applies the 20% coupon |

**Coupon types:**
- **Percentage off** — e.g., 20% off
- **Fixed amount off** — e.g., $10 off
- **Duration:** once, repeating (X months), or forever

**Best practices:**
- Create the coupon first, then create promotion codes for it
- Use promotion codes (not raw coupons) so you can track which code was used
- Set redemption limits to prevent abuse
- Set expiration dates on promotion codes

## Reporting and Data

### Built-in Stripe Reports

| Report | What It Shows | Where to Find It |
|--------|--------------|------------------|
| **Revenue overview** | MRR, subscriber count, churn | Billing → Revenue |
| **Financial reports** | Balance summary, payout reconciliation | Reports → Financial reports |
| **Payments report** | All payment details with filters | Payments → Export |
| **Subscription report** | Active/canceled subs, trial conversions | Billing → Subscriptions → Export |
| **Invoice report** | All invoices with status and amounts | Billing → Invoices → Export |
| **Dispute report** | Open and resolved disputes | Payments → Disputes |

### Sigma (SQL Queries)

Stripe Sigma lets you write SQL queries against your Stripe data. Available on Scale and Enterprise plans.

**Useful for:** custom reports that the dashboard doesn't offer, combining data across objects (e.g., customer metadata + subscription status + payment history).

**Tip for operators:** If the user has Sigma access, you can write SQL queries for them. If not, CSV exports + spreadsheet analysis is the way to go.

### Exporting Data

All major sections in the Stripe Dashboard have an **Export** button. Exports download as CSV files.

**Common export workflows:**
- Monthly revenue report → Payments → filter date range → Export
- Customer list with subscriptions → Customers → Export
- Failed payments for follow-up → Payments → filter by "Failed" → Export
- Tax reporting → Reports → Financial Reports → download

**Tip:** For recurring reports, suggest the user set up an automation (n8n + Stripe API) to pull data on a schedule instead of manual exports.

## Webhooks

Webhooks are how Stripe tells your systems about events in real-time — "a payment just succeeded," "a subscription was canceled," etc.

### What Operators Need to Know

Think of webhooks as automatic notifications. When something happens in Stripe, it can send a message to a URL you specify.

**Why webhooks matter:**
- Without webhooks, you'd have to constantly check Stripe for updates (polling)
- With webhooks, Stripe tells you instantly when things happen
- They power automations: payment succeeded → update your database, send welcome email, etc.

### Common Webhook Events

| Event | When It Fires | Common Use |
|-------|--------------|------------|
| `payment_intent.succeeded` | Payment completed | Send receipt, fulfill order |
| `payment_intent.payment_failed` | Payment failed | Notify customer, flag account |
| `customer.subscription.created` | New subscription started | Welcome email, provision access |
| `customer.subscription.updated` | Subscription changed (upgrade/downgrade) | Update access level |
| `customer.subscription.deleted` | Subscription canceled | Revoke access, send win-back email |
| `invoice.paid` | Invoice payment collected | Update records, send thank you |
| `invoice.payment_failed` | Invoice payment failed | Alert team, contact customer |
| `charge.dispute.created` | Customer disputed a charge | Alert team immediately — time-sensitive |
| `customer.created` | New customer added | Sync to CRM, send welcome |
| `checkout.session.completed` | Checkout session finished | Fulfill order, create account |

### Webhook + n8n Pattern

The most common automation pattern for business operators:

```
Stripe Webhook → n8n Webhook Trigger → Process Event → Take Action
```

**Example workflows:**
- Payment succeeded → Slack notification to #revenue channel
- Subscription canceled → Create task in project tracker for follow-up
- Dispute created → Urgent Slack alert + create support ticket
- Invoice paid → Update Google Sheet with revenue data
- Trial ending in 3 days → Send reminder email

**Setup in n8n:**
1. Create an n8n workflow with a Webhook trigger
2. Copy the webhook URL
3. In Stripe Dashboard → Developers → Webhooks → Add endpoint
4. Paste the URL, select the events you want
5. Save — Stripe will send a test event

### Webhook Security

- Each webhook endpoint has a **signing secret** — use it to verify events are really from Stripe
- If a webhook delivery fails, Stripe retries with exponential backoff for up to 3 days
- Monitor webhook delivery in Dashboard → Developers → Webhooks → select endpoint → see delivery attempts

## Stripe Products Overview

Stripe has many products. Here's what operators should know about each:

| Product | What It Does | When You Need It |
|---------|-------------|------------------|
| **Payments** | Accept one-time payments | Selling products or services |
| **Billing** | Recurring subscriptions and invoicing | SaaS, memberships, recurring services |
| **Checkout** | Pre-built payment page | Quick setup, no custom UI needed |
| **Payment Links** | Shareable payment URLs | No-code payment collection |
| **Connect** | Payments for platforms/marketplaces | You facilitate payments between others |
| **Invoicing** | Send and manage invoices | B2B billing, custom charges |
| **Radar** | Fraud detection and prevention | Reducing fraudulent transactions |
| **Tax** | Automatic sales tax calculation | Selling to customers in multiple jurisdictions |
| **Revenue Recognition** | Accounting-compliant revenue reporting | Financial reporting, audits |
| **Atlas** | Incorporate a company | Starting a new US company |

**For most operators:** Payments + Billing + Checkout/Payment Links covers 90% of needs.

## Common Operator Scenarios

### "A customer says they were charged but didn't receive the product"

1. Search for the customer in Stripe Dashboard
2. Check their recent payments — was the charge successful?
3. Check if the payment is in test mode or live mode
4. If successful in live mode, the issue is on your fulfillment side, not Stripe
5. If the customer wants a refund, process it through the Dashboard
6. Document everything in case of a future dispute

### "I need to change pricing for existing customers"

1. Create a new price for the product (don't edit the existing one)
2. Decide: change immediately or at next renewal?
3. For immediate: update subscriptions now (proration applies)
4. For next renewal: schedule the change for end of current period
5. Communicate to customers before the change takes effect
6. Consider grandfathering — letting existing customers keep the old price

### "I need to offer a discount to a specific customer"

1. Create a coupon with the discount amount/percentage
2. Create a promotion code (optional — for tracking)
3. Apply directly to the customer's subscription (Dashboard → Subscription → Apply coupon)
4. Or send them a promotion code to use at checkout

### "We're getting too many failed payments"

1. Check Dashboard → Payments → filter Failed
2. Look for patterns: same error codes? Same card types? Same countries?
3. Common causes:
   - **Insufficient funds** — customer issue, Smart Retries will help
   - **Card declined (generic)** — may need customer to update card
   - **Authentication required** — 3D Secure needed, check if your integration handles it
4. Enable Smart Retries (Billing → Settings → Retry schedule) — Stripe uses ML to pick optimal retry times
5. Enable card account updater — automatically updates expired card numbers
6. Set up dunning emails — automatic emails to customers with failed payments

### "I need to reconcile Stripe with my accounting"

1. Dashboard → Reports → Financial Reports
2. Download the Balance summary for your period
3. This shows: starting balance, charges, refunds, fees, payouts, ending balance
4. Match each payout line to your bank statement
5. Stripe fees are deducted before payout — the payout amount is net of fees
6. For detailed reconciliation, export itemized transactions

## Working with a Stripe MCP Server or API Source

When the user has Stripe connected via MCP or API, here are the most useful operations.

### Reading Data (Safe — No Side Effects)

- List recent payments with status filters
- Get customer details by email or ID
- List subscriptions (active, past due, canceled)
- Retrieve invoice details
- Check account balance
- List products and prices
- Get dispute details

### Writing Data (Caution — Confirm with User)

Before any write operation, always:
1. Confirm you're in the correct mode (test/live)
2. Explain what will happen in plain English
3. Get explicit confirmation from the user

**Operations that change things:**
- Create/update customers
- Create/modify subscriptions
- Issue refunds
- Create invoices
- Apply coupons/credits
- Create payment links
- Void invoices

### Stripe API Basics (For When You Need Them)

The Stripe API uses:
- **Base URL:** `https://api.stripe.com/v1/`
- **Authentication:** Bearer token with secret key
- **Format:** Form-encoded requests, JSON responses
- **Pagination:** Uses cursor-based pagination (`starting_after` parameter)
- **Idempotency:** Use `Idempotency-Key` header to prevent duplicate operations

**Common endpoints:**
- `GET /v1/charges` — list charges
- `GET /v1/customers` — list customers
- `GET /v1/subscriptions` — list subscriptions
- `GET /v1/invoices` — list invoices
- `GET /v1/balance` — check balance
- `POST /v1/refunds` — create a refund

See [references/operations.md](references/operations.md) for a full operations reference.

## Glossary

Quick reference for Stripe terminology that confuses business operators:

| Term | What It Actually Means |
|------|----------------------|
| **Balance** | Money Stripe is holding before paying you out |
| **Payout** | When Stripe sends money to your bank account |
| **Statement descriptor** | The text that appears on customer bank/card statements |
| **Metadata** | Custom key-value data you attach to Stripe objects (for your own tracking) |
| **Proration** | Adjusting charges when a subscription changes mid-billing cycle |
| **Dunning** | The process of contacting customers about failed payments |
| **Smart Retries** | Stripe's ML system that picks the best time to retry failed payments |
| **Revenue recognition** | Accounting rules for when revenue is "earned" vs. "collected" |
| **Idempotency** | A safety mechanism that prevents accidentally processing the same operation twice |
| **Webhook** | An automatic notification Stripe sends to your systems when events happen |
| **Payment intent** | Stripe's object that tracks a payment from creation to completion |
| **Setup intent** | Stripe's object for saving a payment method without charging immediately |
| **Customer portal** | A pre-built page where customers can manage their own billing |
| **Connect** | Stripe's product for platforms that facilitate payments between others |
| **Radar** | Stripe's fraud detection system |

## Attribution

This skill incorporates patterns and best practices adapted from:
- [Stripe official documentation](https://docs.stripe.com/) — product guides, API reference, and best practices
- [anthropics/skills](https://github.com/anthropics/skills) — Stripe best practices skill patterns (MIT License)
- [wshobson/agents](https://github.com/wshobson/agents) — payment processing integration patterns
