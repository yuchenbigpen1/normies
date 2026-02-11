# Stripe Common Operations Reference

Quick reference for Stripe API operations organized by what business operators commonly need to do.

## Customer Operations

### List Customers

```
GET /v1/customers?limit=10
GET /v1/customers?email=user@example.com
```

**Filters:** `email`, `created` (date range), `limit` (max 100)

### Create a Customer

```
POST /v1/customers

email=user@example.com
name=Jane Smith
description=Enterprise client, signed Feb 2026
metadata[crm_id]=CRM-12345
metadata[account_manager]=Sarah
```

### Update a Customer

```
POST /v1/customers/{customer_id}

name=Jane Smith-Jones
metadata[notes]=Upgraded to Enterprise Feb 2026
```

### Search Customers

```
GET /v1/customers/search?query=email:"user@example.com"
GET /v1/customers/search?query=name:"Jane Smith"
GET /v1/customers/search?query=metadata["crm_id"]:"CRM-12345"
```

## Subscription Operations

### List Subscriptions

```
GET /v1/subscriptions?status=active&limit=10
GET /v1/subscriptions?customer={customer_id}
```

**Status filters:** `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `trialing`, `paused`, `all`

### Create a Subscription

```
POST /v1/subscriptions

customer={customer_id}
items[0][price]={price_id}
trial_period_days=14
payment_behavior=default_incomplete
```

### Upgrade/Downgrade (Change Price)

```
POST /v1/subscriptions/{sub_id}

items[0][id]={existing_item_id}
items[0][price]={new_price_id}
proration_behavior=create_prorations
```

**Proration options:**
- `create_prorations` — charge/credit the difference (default, most common)
- `none` — no proration, new price starts at next billing cycle
- `always_invoice` — immediately invoice the proration amount

### Cancel a Subscription

```
# Cancel at period end (customer-friendly)
POST /v1/subscriptions/{sub_id}
cancel_at_period_end=true

# Cancel immediately
DELETE /v1/subscriptions/{sub_id}
prorate=true
```

### Apply a Coupon to Subscription

```
POST /v1/subscriptions/{sub_id}
coupon={coupon_id}
```

### Pause a Subscription

```
POST /v1/subscriptions/{sub_id}
pause_collection[behavior]=void
```

Resume:
```
POST /v1/subscriptions/{sub_id}
pause_collection=""
```

## Invoice Operations

### List Invoices

```
GET /v1/invoices?customer={customer_id}&limit=10
GET /v1/invoices?status=open
GET /v1/invoices?subscription={sub_id}
```

**Status filters:** `draft`, `open`, `paid`, `void`, `uncollectible`

### Create a One-Off Invoice

```
# Step 1: Create invoice item
POST /v1/invoiceitems
customer={customer_id}
amount=5000
currency=usd
description=Consulting services - February 2026

# Step 2: Create and finalize invoice
POST /v1/invoices
customer={customer_id}
auto_advance=true
collection_method=send_invoice
days_until_due=30
```

### Void an Invoice

```
POST /v1/invoices/{invoice_id}/void
```

### Mark Invoice as Uncollectible

```
POST /v1/invoices/{invoice_id}/mark_uncollectible
```

### Send Invoice Reminder

```
POST /v1/invoices/{invoice_id}/send
```

## Payment Operations

### List Payments

```
GET /v1/payment_intents?limit=10
GET /v1/payment_intents?customer={customer_id}
```

### List Charges

```
GET /v1/charges?limit=10
GET /v1/charges?customer={customer_id}
GET /v1/charges?created[gte]=1706745600&created[lte]=1709424000
```

**Date filters use Unix timestamps.** Use `created[gte]` (greater than or equal) and `created[lte]` (less than or equal).

### Issue a Full Refund

```
POST /v1/refunds
charge={charge_id}
```

### Issue a Partial Refund

```
POST /v1/refunds
charge={charge_id}
amount=2500
```

**Amount is in cents** — 2500 = $25.00

## Product and Price Operations

### List Products

```
GET /v1/products?active=true&limit=10
```

### Create a Product

```
POST /v1/products
name=Pro Plan
description=Full access to all features
metadata[tier]=pro
```

### Create a Recurring Price

```
POST /v1/prices
product={product_id}
unit_amount=4900
currency=usd
recurring[interval]=month
```

**Intervals:** `day`, `week`, `month`, `year`

### Create a One-Time Price

```
POST /v1/prices
product={product_id}
unit_amount=9900
currency=usd
```

### Archive a Price

```
POST /v1/prices/{price_id}
active=false
```

## Coupon and Promotion Operations

### Create a Percentage Coupon

```
POST /v1/coupons
percent_off=20
duration=repeating
duration_in_months=3
name=20% Off for 3 Months
```

### Create a Fixed Amount Coupon

```
POST /v1/coupons
amount_off=1000
currency=usd
duration=once
name=$10 Off First Month
```

### Create a Promotion Code

```
POST /v1/promotion_codes
coupon={coupon_id}
code=SAVE20
max_redemptions=100
expires_at=1735689600
```

## Dispute Operations

### List Disputes

```
GET /v1/disputes?limit=10
```

### Retrieve Dispute Details

```
GET /v1/disputes/{dispute_id}
```

Key fields in the response:
- `amount` — disputed amount (in cents)
- `status` — `warning_needs_response`, `needs_response`, `under_review`, `won`, `lost`
- `evidence_details.due_by` — deadline for submitting evidence (Unix timestamp)
- `reason` — `duplicate`, `fraudulent`, `product_not_received`, `product_unacceptable`, etc.

### Submit Dispute Evidence

```
POST /v1/disputes/{dispute_id}
evidence[customer_email_address]=user@example.com
evidence[customer_name]=Jane Smith
evidence[product_description]=Monthly SaaS subscription
evidence[uncategorized_text]=Customer used the service for 3 months...
evidence[service_date]=2026-01-15
```

**Tip:** Submit all evidence at once. You typically only get one chance.

## Balance and Payout Operations

### Check Balance

```
GET /v1/balance
```

Returns `available` (ready to pay out) and `pending` (still processing) amounts.

### List Payouts

```
GET /v1/payouts?limit=10
GET /v1/payouts?status=paid
GET /v1/payouts?arrival_date[gte]=1706745600
```

## Payment Links

### Create a Payment Link

```
POST /v1/payment_links
line_items[0][price]={price_id}
line_items[0][quantity]=1
after_completion[type]=redirect
after_completion[redirect][url]=https://example.com/thank-you
```

### Deactivate a Payment Link

```
POST /v1/payment_links/{link_id}
active=false
```

## Webhook Operations

### List Webhook Endpoints

```
GET /v1/webhook_endpoints
```

### Create a Webhook Endpoint

```
POST /v1/webhook_endpoints
url=https://your-domain.com/webhook
enabled_events[]=payment_intent.succeeded
enabled_events[]=customer.subscription.deleted
enabled_events[]=charge.dispute.created
```

## Important Notes

### Currency and Amounts

All monetary amounts in the Stripe API are in the **smallest currency unit**:
- USD: cents (5000 = $50.00)
- EUR: cents (5000 = €50.00)
- GBP: pence (5000 = £50.00)
- JPY: yen (5000 = ¥5000 — no decimal unit)

### Pagination

Stripe uses cursor-based pagination:
```
GET /v1/customers?limit=10
# Get next page using the last ID from previous response
GET /v1/customers?limit=10&starting_after={last_customer_id}
```

### Expand Related Objects

By default, related objects return only their ID. Use `expand[]` to include full objects:
```
GET /v1/charges/{charge_id}?expand[]=customer&expand[]=invoice
```

### Test Mode Card Numbers

| Card Number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 3220` | 3D Secure 2 required |

Use any future expiry date, any 3-digit CVC, and any postal code.

### Rate Limits

Stripe API rate limits:
- **Live mode:** 100 read requests/second, 100 write requests/second
- **Test mode:** 25 requests/second
- Rate limit headers: `Stripe-RateLimit-Limit`, `Stripe-RateLimit-Remaining`, `Stripe-RateLimit-Reset`

For bulk operations, implement backoff when you receive a 429 status code.
