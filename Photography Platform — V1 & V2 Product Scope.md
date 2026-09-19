# Photography Platform — V1 & V2

## Product Direction

We will build this in **two deliberately separated versions**.

### V1 — Gallery MVP

The only job of V1:

> **Let a photographer upload an event's photos and send the client a beautiful, fast, branded gallery.**

V1 exists to validate the most basic question:

> **Will photographers use a dedicated gallery instead of Google Drive/WhatsApp?**

### V2 — Photographer Workflow Platform

V2 builds on the gallery and adds:

> **Client selection, feedback, approval, advanced sharing, monetization controls, and event management.**

This prevents us from spending months building features before knowing whether the basic gallery has demand.

---

# VERSION 1 — GALLERY MVP

## 1. V1 Objective

Build the simplest commercially usable photo gallery.

The photographer should be able to:

**Sign up → create event → upload photos → publish → share link → client views/downloads photos.**

Nothing else should be necessary.

---

# 2. V1 Target User

Primary:

- wedding photographer
- pre-wedding photographer
- event photographer
- small studio
- solo photographer

Do not optimize for videographers yet.

**V1 is photo-only.**

---

# 3. V1 Features

## A. Photographer Account

Required:

- sign up
- login
- logout
- basic profile

Profile fields:

- photographer/studio name
- logo
- primary brand color

Keep authentication simple.

No team accounts.

No roles.

No advanced account settings.

---

# 4. Brand Kit

Photographer sets:

- logo
- studio name
- primary color
- optional accent color

This branding automatically appears on every event gallery.

The photographer should not need to configure branding repeatedly.

---

# 5. Create Event

Required fields:

- event name
- client name
- event date

Example:

```text
Event:
Rahul & Priya Wedding

Client:
Rahul Sharma

Date:
12 September 2026
```

Creating an event generates a unique gallery URL.

Example:

```text
www.yourdomain.com/e/8fj29x
```

Use secure random event IDs.

Do not use predictable numeric IDs.

---

# 6. Bulk Upload

This is one of the most important parts of V1.

Required:

- drag and drop
- multiple-file selection
- upload progress
- total files
- successful uploads
- failed uploads
- retry failed files
- duplicate protection

Example:

```text
Uploading...

1,284 / 1,500

85.6%
```

The photographer should not have to manually upload individual photos.

---

# 7. Image Processing

For every uploaded image create:

- original
- optimized web image
- thumbnail

The gallery should **never load the original image for normal browsing**.

Originals are retained for download.

Use responsive image sizes and lazy loading.

---

# 8. Gallery

This is the core V1 product.

Required:

- responsive grid
- masonry-style layout if appropriate
- thumbnails
- full-screen viewer
- previous/next navigation
- mobile support
- desktop support
- lazy loading
- image download
- download-all option where practical

The gallery should feel polished enough that the photographer can comfortably send it directly to a paying client.

---

# 9. Guest/Client Access

V1 can use **one gallery experience**.

Do not build separate guest and client portals yet.

Anyone with the event link can view the gallery.

Optional:

- gallery password

The photographer should be able to enable/disable password protection.

---

# 10. Sharing

V1 should provide:

### Copy Link

Simple copy-to-clipboard.

### WhatsApp Share

Generate a prefilled WhatsApp message containing the gallery link.

Example:

> Hi Rahul, your wedding photos are ready. You can view them here: [link]

### QR Code

Generate a QR code for the event gallery.

Allow download as PNG.

QR is inexpensive to implement and useful for physical events, so it can stay in V1.

---

# 11. Basic Gallery Customization

Keep customization intentionally small.

Allow:

- logo
- brand name
- primary color
- gallery title
- optional welcome message

Do NOT build:

- drag-and-drop page builder
- multiple gallery layouts
- custom CSS editor
- custom fonts
- advanced themes

---

# 12. Downloads

V1 supports:

- individual image download
- download all photos

Original-resolution download should be available to the client unless the photographer disables it.

Watermarking can be deferred.

---

# 13. Event Management

Basic dashboard:

```text
My Events

Rahul & Priya Wedding
1,842 photos
8.4 GB
Published

Amit & Neha Pre-Wedding
764 photos
3.1 GB
Draft
```

Actions:

- open
- edit basic details
- publish/unpublish
- copy link
- view storage
- delete

That's enough.

---

# 14. Storage

Use Cloudflare R2.

Recommended structure:

```text
events/
    event_abc123/
        originals/
        web/
        thumbnails/
```

Do not create a physical R2 bucket for every event initially.

One bucket + event-specific prefixes is simpler.

---

# 15. V1 Storage Limits

No unlimited storage.

Initial pricing hypothesis:

### ₹399/event

Includes:

- one photo event
- up to 10 GB
- 30-day active gallery
- white-label branding
- downloads
- QR
- WhatsApp sharing

The 10 GB limit is a starting hypothesis.

We can change it after observing actual event sizes.

---

# 16. V1 Expiry

After the active period:

**Gallery expires.**

Do not permanently delete immediately unless our retention policy says so.

Initial implementation can simply:

- mark event expired
- disable public/client access
- retain data temporarily
- allow admin restoration

More sophisticated archive/restore logic belongs in V2.

---

# 17. V1 Internal Cost Tracking

Even though V1 is small, the architecture should record event-level usage.

Track:

- original storage bytes
- optimized image bytes
- thumbnail bytes
- image count
- upload operations
- downloads
- processing activity

This lets us estimate:

```text
Event Revenue
− Payment Cost
− Storage Cost
− Processing Cost
− Other Infrastructure
= Estimated Contribution
```

We do **not** need a polished profitability dashboard in V1.

The raw usage data is enough.

The full cost-analysis dashboard can be V2.

---

# 18. V1 Payments

For the first development build, payment can initially be:

### Option A

Manual activation by admin for beta photographers.

### Option B

Simple Razorpay event purchase.

For the first real-world beta, Option A may be faster.

Don't allow payment implementation to delay product validation.

Once the gallery is proven, automate everything.

---

# 19. What V1 Must NOT Have

Explicitly exclude:

- client favorites
- photo selection
- selection limits
- comments
- approval workflow
- client portal
- AI face search
- selfie search
- video
- CRM
- invoices
- subscription management
- affiliate system
- advanced analytics
- team accounts
- print marketplace
- portfolio website builder
- advanced archive management

These belong to V2 or later.

---

# VERSION 2 — DELIVERY & CLIENT WORKFLOW

Once V1 proves that photographers will use and pay for the gallery, add the workflow features.

V2's objective:

> **Turn the gallery into a photographer's delivery and client-selection workspace.**

---

# 20. V2 Features

## A. Private Client Selection

Create a dedicated private client mode.

Client can:

- open private selection link
- favorite photos
- select photos
- remove selections
- see selected count

Example:

```text
Selected: 287 / 300
```

---

# 21. Selection Limits

Photographer can define:

```text
Maximum selections:
300
```

When the client reaches the limit, additional selection is blocked until a photo is removed.

---

# 22. Comments

Clients can comment on individual photos.

Examples:

> Please replace this one.

> Use this for the album.

> Can you send a higher-resolution version?

Keep V2 comments simple.

No live chat.

No threads/mentions.

---

# 23. Selection Submission

Client presses:

**Submit Selection**

System records:

- selected photos
- submission time
- client identity/access ID
- comments

Photographer sees:

```text
Selection submitted

287 / 300 photos

Submitted:
18 Sep 2026, 8:42 PM
```

---

# 24. Photographer Approval

Photographer can:

- review selections
- make changes
- approve
- lock selection

Once locked, client cannot modify it unless the photographer unlocks it.

---

# 25. Separate Gallery & Client Portal

V2 introduces two distinct experiences:

### Guest Gallery

For browsing/sharing.

### Client Portal

For private selection and feedback.

Same underlying event, different access permissions.

---

# 26. Event Workflow

V2 introduces explicit event states:

```text
DRAFT
↓
UPLOADING
↓
READY
↓
PUBLISHED
↓
AWAITING_SELECTION
↓
SELECTION_SUBMITTED
↓
APPROVED
↓
EXPIRED
↓
ARCHIVED
↓
DELETED
```

Centralize this state logic.

---

# 27. Better Event Dashboard

V2 dashboard shows:

```text
Rahul & Priya Wedding

Photos:        1,842
Storage:       8.4 GB
Selected:      287 / 300
Status:        Awaiting Approval
Expires:       12 Oct 2026
```

This becomes the photographer's operational workspace.

---

# 28. Advanced Sharing

V2 can expand sharing:

- separate guest link
- private client link
- password protection
- QR customization
- downloadable QR assets
- customizable WhatsApp messages
- share tracking

---

# 29. Monetization

V2 introduces automated payments.

### Event Plan

Starting hypothesis:

**₹399/event**

Potential structure:

- 10 GB included
- 30-day active gallery
- branded gallery
- selection workflow
- downloads
- QR
- WhatsApp sharing

Then add paid extensions:

- additional storage
- additional active days
- larger events
- video
- archival retention

---

# 30. Subscription

Only once repeat event behavior is established:

### Monthly

₹999–₹1,199/month

### Annual

₹8,999–₹10,999/year

Subscription is an upgrade for photographers who repeatedly use the platform.

Do not force subscription-first pricing.

---

# 31. Archive System

V2 introduces:

### Active

Normal gallery access.

### Archived

Lower-cost retained storage.

### Restore

Bring an archived event back online.

### Delete

Permanently delete event and media.

This is important for controlling long-term storage costs.

---

# 32. Cost & Profitability Dashboard

V2 turns the raw V1 usage data into an internal business dashboard.

Example:

```text
Event
--------------------------------

Revenue                 ₹399

Payment fee              ₹9.42
Storage                  ₹14.20
Processing                ₹1.70
Other infra               ₹2.00

Estimated infra          ₹17.90

Affiliate                ₹0
--------------------------------

Estimated contribution  ₹311.68
```

Across all events:

```text
Average cost/event
Median cost/event
P95 cost/event
P99 cost/event

Average revenue/event
Average contribution/event
```

This data becomes the basis for future pricing decisions.

---

# 33. Video

V2 can introduce video carefully.

Do not put unlimited video into the ₹399 plan.

Possible model:

- paid video add-on
- separate storage allowance
- streaming-specific pricing

Video should only be launched after photo infrastructure is stable.

---

# 34. AI Face Search

V2+ only.

Before building:

- interview photographers
- test with real events
- measure actual usage
- test willingness to pay

Possible model:

**₹199–₹399/event add-on**

or included in a higher plan.

Strict limits on:

- photos processed
- event size
- retention
- face-search requests

---

# 35. Affiliate Program

Implement only after product-market signal exists.

Potential model:

- 25% of first payment
- optional recurring commission
- minimum payout threshold
- anti-self-referral controls
- manual review for suspicious activity

Potential affiliate partners:

- photography educators
- photo editors
- album designers
- camera rental businesses
- wedding planners
- photography communities

---

# 36. V1 vs V2 — One-Page Summary

| Capability           | V1             | V2          |
| -------------------- | -------------- | ----------- |
| Photographer account | ✅              |             |
| Brand kit            | ✅              |             |
| Create event         | ✅              |             |
| Bulk photo upload    | ✅              |             |
| Image processing     | ✅              |             |
| Branded gallery      | ✅              |             |
| Mobile gallery       | ✅              |             |
| Downloads            | ✅              |             |
| WhatsApp sharing     | ✅              |             |
| QR                   | ✅              |             |
| Password protection  | ✅ Basic        | ✅ Advanced  |
| Event dashboard      | ✅ Basic        | ✅ Advanced  |
| Client selection     | ❌              | ✅           |
| Favorites            | ❌              | ✅           |
| Selection limits     | ❌              | ✅           |
| Comments             | ❌              | ✅           |
| Client portal        | ❌              | ✅           |
| Approval workflow    | ❌              | ✅           |
| Event states         | Basic          | ✅ Full      |
| Automated payments   | Basic/optional | ✅           |
| Archive/restore      | Basic          | ✅           |
| Cost tracking        | Raw data       | ✅ Dashboard |
| Video                | ❌              | Later       |
| AI face search       | ❌              | Later       |
| Affiliates           | ❌              | Later       |
| Subscription         | ❌/manual       | ✅           |

---

# 37. V1 Success Criteria

Do not judge V1 by number of features.

The first goal is to get:

**10–20 real photographers**

using the product with **real client events**.

We want to observe:

- Do photographers actually upload real events?
- Do they send the gallery to clients?
- Do clients open it?
- Do clients download photos?
- Do photographers prefer it to Drive/WhatsApp?
- Do photographers come back for another event?
- What complaints appear repeatedly?

The strongest signal is:

> **A photographer pays for a second event.**

---

# 38. Development Rule

During V1 development, any feature that is not necessary for:

**upload → gallery → share → browse → download**

should be considered out of scope.

During V2 development, any feature that doesn't improve:

**delivery → selection → feedback → approval**

should be deferred.

---

# 39. Final Product Strategy

### V1

**Be a very good gallery.**

### V2

**Become the photographer's delivery workflow.**

### V3+

Potential expansion:

**AI discovery → video → advanced automation → higher-value studio features.**

This keeps development manageable while preserving the larger business opportunity.
