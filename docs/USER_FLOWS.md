# User Flows and Call-to-Action Reference

What every button in Ralli Wolf Operations does, what has to exist before you
can press it, and the order to work through the application in.

If you only read one section, read [Where to start](#where-to-start) — it
answers the question most people ask first: *do I create a warehouse or
inventory?*

For how the system is built, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Contents

1. [Where to start](#where-to-start)
2. [Day-one setup, in order](#day-one-setup-in-order)
3. [Buying: requisition → order → receipt → stock](#buying)
4. [Making: BOM → production order → finished goods](#making)
5. [Selling: lead → opportunity → quote → order](#selling)
6. [Shipping: pick → pack → dispatch](#shipping)
7. [Keeping stock honest: counts, alerts, adjustments](#keeping-stock-honest)
8. [Marketing](#marketing)
9. [Complete call-to-action reference](#complete-call-to-action-reference)
10. [Things that will block you](#things-that-will-block-you)

---

## Where to start

**Create the warehouse first. Always.** Not inventory, not products, not
suppliers — the warehouse.

This is not a preference; the database enforces it. A quantity of stock is
stored as a `StockBalance` row, and that row cannot exist without a bin:

```mermaid
flowchart LR
    W["Warehouse"] --> Z["Zone"]
    Z --> B["Bin"]
    B --> S["Stock balance<br/>(your actual inventory)"]
    P["Product"] --> S
    L["Stock lot"] --> S

    style W fill:#fef2f2,stroke:#c5101b
    style S fill:#f5f5f5,stroke:#737373
```

Every one of those arrows is a **required** foreign key. Try to record stock
before you have somewhere to put it and the database rejects it.

The short answer:

> **Warehouse → Zone → Bin → Product → then stock can exist.**

Nothing is pre-populated. A fresh workspace has no warehouses, so the first
thing anyone does is **Warehouse → Warehouses & Bins → New warehouse**.

---

## Day-one setup, in order

```mermaid
flowchart TD
    START([New workspace]) --> U["1 · Create users<br/>Administration → User Management"]
    U --> W["2 · Create a warehouse<br/>Warehouse → Warehouses & Bins → New warehouse"]
    W --> Z["3 · Add zones<br/>receiving, storage, picking, packing"]
    Z --> B["4 · Add bins<br/>one by one, or Generate a rack layout"]
    B --> C["5 · Create product categories<br/>Sales Management → Product Configuration → Add Category"]
    C --> P["6 · Create products<br/>Add Product"]
    P --> S["7 · Create suppliers<br/>Purchasing → Suppliers → New supplier"]
    S --> SC["8 · Add supplier catalogue prices"]
    SC --> R["9 · Set reorder rules<br/>Inventory → Reorder Policies"]
    R --> STOCK{"How does stock<br/>first arrive?"}

    STOCK -->|"Bought in"| PO["Raise a purchase order<br/>→ receive → post to stock"]
    STOCK -->|"Built here"| MFG["Production order<br/>→ book finished goods"]
    STOCK -->|"Already on the floor"| CNT["Stock count<br/>→ post variances"]

    PO --> LIVE([Stock is live])
    MFG --> LIVE
    CNT --> LIVE

    LIVE --> BOM["10 · Bills of materials<br/>(only if you manufacture)"]
    BOM --> PRODN["11 · Production orders"]
    PRODN --> WC["12 · Work centres<br/>Planning → Work Centres"]
    WC --> ROUTE["13 · Routing on each BOM<br/>then Schedule on the board"]

    LIVE --> FIN["14 · Finance<br/>invoice what you have received<br/>and what you have shipped"]

    style W fill:#fef2f2,stroke:#c5101b
    style LIVE fill:#f5f5f5,stroke:#737373
```

Steps 1–6 are mandatory for everyone. Steps 7–9 matter as soon as you buy
anything. Steps 10–11 only apply if you manufacture, and 12–13 only if you want
to schedule that manufacturing onto real machines rather than just track it.

**Step 14 has no prerequisites of its own** beyond having bought or sold
something. Finance reads the purchase and sales orders that already exist — it
does not need its own setup, and there is no chart of accounts to configure.

**There are exactly three ways stock can enter the system through the UI:**

1. **Buy it** — purchase order → goods receipt → *Post to stock*
2. **Build it** — production order → *Book finished goods*
3. **Count it in** — start a stock count, enter what is physically there, then
   *Post variances to stock*

Option 3 is how you load an opening balance for stock that already exists on the
floor. There is no "adjust stock" screen: the API has an adjustments endpoint
(`POST /api/inventory/adjustments`) but nothing in the interface calls it, so a
bulk opening load has to go through a count or through the API directly.

**Sales can be set up in parallel** — accounts, contacts and price books do not
depend on the warehouse. But you cannot *fulfil* an order without stock, so the
supply-chain side has to be real before you ship.

---

## Buying

From "we're running low" to "it's on the shelf".

```mermaid
flowchart TD
    A{"What triggered<br/>the purchase?"}
    A -->|"Reorder rule breached"| AUTO["System raises a<br/>purchase requisition"]
    A -->|"Someone asked"| MAN["Purchasing → Requisitions<br/>→ New requisition"]

    AUTO --> APPR{"Needs approval?"}
    MAN --> APPR
    APPR -->|yes| WAIT["Approver decides<br/>Sales Management → Approvals"]
    APPR -->|no| CONV
    WAIT -->|approved| CONV["Convert to a purchase order"]
    WAIT -->|rejected| END1([Stops here])

    CONV --> PO["Purchase order created<br/>status DRAFT"]
    PO --> SUB["Submit for approval"]
    SUB --> POAPP{"Approved?"}
    POAPP -->|no| END2([Revise and resubmit])
    POAPP -->|yes| SENT["Send to supplier"]

    SENT --> ARRIVE["Goods arrive"]
    ARRIVE --> GRN["Record a goods receipt<br/>on the purchase order"]
    GRN --> QC{"Quality check<br/>required?"}
    QC -->|yes| INSPECT["Inspect · pass, fail,<br/>or pass with conditions"]
    QC -->|no| POST
    INSPECT --> POST["Post to stock"]

    POST --> LOT["Creates: stock lot,<br/>stock balance, movement"]
    LOT --> PUT["Putaway task<br/>→ move to a bin"]
    PUT --> DONE([On the shelf])

    style POST fill:#fef2f2,stroke:#c5101b
    style DONE fill:#f5f5f5,stroke:#737373
```

**The important step is "Post to stock".** Until you press it, a goods receipt
is only paperwork — the quantities are recorded but your inventory has not
changed. This is deliberate: it gives you a window to count and inspect before
the numbers move.

---

## Making

```mermaid
flowchart TD
    A["BOM & Production → Bills of Materials → New BOM"] --> B["Add components<br/>one row per part"]
    B --> C{"At least one<br/>component?"}
    C -->|no| B
    C -->|yes| D["Activate"]
    D --> E["BOM is now frozen<br/>and can be built from"]

    E --> F["New production order<br/>pick product, BOM, quantity"]
    F --> G["Release & reserve materials"]
    G --> H["Components reserved<br/>against stock"]
    H --> I["Material requisition<br/>→ Issue now"]
    I --> J["Parts leave stock<br/>consumption recorded"]
    J --> K["Book finished goods"]
    K --> L["Finished units enter stock<br/>at material + labour + overhead"]

    E -.->|"need a change?"| M["Create revision"]
    M -.-> N["New draft version<br/>original stays frozen"]

    style D fill:#fef2f2,stroke:#c5101b
    style K fill:#fef2f2,stroke:#c5101b
```

Two things people trip over:

- **Activate is disabled until the BOM has at least one component.** The button
  is there, greyed, with a tooltip saying why.
- **An active BOM cannot be edited.** That is intentional — production orders
  reference it, and past jobs must stay reproducible. Use **Create revision**,
  which opens a new draft and leaves the original alone.

Before releasing a job, use **Materials → Build Availability** to check you
actually have the parts. It explodes the BOM, compares every component against
free stock, and tells you how many units you can build.

---

## Selling

```mermaid
flowchart TD
    L["Lead captured<br/>landing page · import · manual"] --> A{"Assigned?"}
    A -->|no| Q["Sits in Unassigned Leads"]
    Q --> ASSIGN["Assign to a sales user"]
    A -->|yes| WORK
    ASSIGN --> WORK["Work the lead"]

    WORK --> CONV{"Qualified?"}
    CONV -->|no| CLOSE([Marked unqualified])
    CONV -->|yes| ACC["Convert to account + contact"]

    ACC --> OPP["Create Opportunity"]
    OPP --> LINES["Add products and quantities"]
    LINES --> QUOTE["Raise a quote"]
    QUOTE --> DISC{"Discount above<br/>the approval threshold?"}
    DISC -->|yes| APPR["Goes to Approvals"]
    DISC -->|no| PRESENT
    APPR -->|approved| PRESENT["Present to customer"]
    APPR -->|rejected| REVISE([Revise the quote])

    PRESENT --> ACCEPT{"Customer accepts?"}
    ACCEPT -->|no| LOST([Closed lost])
    ACCEPT -->|yes| SO["Convert to a sales order"]
    SO --> FULFIL["Fulfilment — see Shipping"]

    style SO fill:#fef2f2,stroke:#c5101b
```

The discount threshold is set in **Settings → Manager approval threshold**.
Anything above it routes to an approver before the quote can proceed.

---

## Shipping

```mermaid
flowchart TD
    SO["Sales order confirmed"] --> PL["Warehouse → Pick Lists<br/>→ New pick list"]
    PL --> REL["Release"]
    REL --> TASKS["Pick tasks generated,<br/>ordered by walk sequence"]
    TASKS --> PICK["Picker collects from bins<br/>and confirms quantities"]
    PICK --> SHORT{"Everything<br/>picked?"}
    SHORT -->|no| PARTIAL["Short-picked lines<br/>flagged"]
    SHORT -->|yes| PACK["Pack picked goods"]
    PARTIAL --> PACK
    PACK --> PKG["Package created<br/>weight, dimensions, carrier"]
    PKG --> DISPATCH["Warehouse → Packages<br/>→ awaiting dispatch"]
    DISPATCH --> SHIP([Shipped])
```

You can only pack what has actually been picked — the pack step reads confirmed
pick quantities, not requested ones.

---

## Keeping stock honest

```mermaid
flowchart LR
    subgraph Automatic
        SWEEP["Reorder sweep<br/>every 15 min"] --> ALERT["Stock alerts"]
        ALERT --> ACK["Acknowledge"]
        ALERT --> RES["Resolve"]
        ALERT -.->|"if enabled"| AUTOREQ["Auto requisition"]
    end

    subgraph Manual
        COUNT["Start a count"] --> SHEET["Enter what you<br/>physically found"]
        SHEET --> VAR["Variances calculated"]
        VAR --> POST["Post variances to stock"]
    end

    POST --> LEDGER["Stock ledger"]
    AUTOREQ --> LEDGER
```

**Post variances to stock** is the committing step for a count — until then the
count sheet is just notes. Posting writes gain/loss movements so the correction
is auditable.

---

## Planning the shop floor

A BOM tells you what a product is made of. A **routing** tells you how it gets
made — which machine, in what order, for how long. Without one, a production
order is just a quantity with no plan behind it.

```mermaid
flowchart TD
    A["Planning → Work Centres → Add work centre"] --> B["One per machine, line<br/>or bench, tied to a plant"]
    B --> C["Set the shift length,<br/>efficiency and how many<br/>jobs run side by side"]
    C --> D["Real capacity is worked<br/>out for you"]

    D --> E["Add routing steps<br/>to a bill of materials"]
    E --> F{"Is the BOM<br/>active?"}
    F -->|yes| G["Blocked — create a<br/>revision first"]
    F -->|no| H["Add each step: which centre,<br/>setup time, time per unit"]

    H --> I["Planning → Production Board"]
    I --> J{"Does the order's BOM<br/>have a routing?"}
    J -->|no| K["'No routing' — nothing<br/>to schedule against"]
    J -->|yes| L["Schedule"]
    L --> M["Steps get real dates,<br/>laid out back to back"]
    M --> N["Planning → Capacity<br/>shows the load"]
    N --> O{"Any day<br/>over 100%?"}
    O -->|yes| P["Move work or add a shift"]
    O -->|no| Q["The plan fits"]

    style L fill:#fef2f2,stroke:#c5101b
    style G fill:#fef2f2,stroke:#c5101b
```

**So: work centres first, then routing, then scheduling.** You cannot schedule
against a machine that does not exist, and you cannot route a BOM that has
already been activated — same rule as components, and for the same reason: live
production orders reference it.

Two things worth knowing:

- **"Efficiency" and "jobs in parallel" are not decoration.** A line rated 8
  hours at 90% with four stations gives you 28.8 usable hours a day, and that
  is the number capacity is measured against — not the 8.
- **Scheduling replaces, it does not add.** Scheduling an order a second time
  wipes its old steps and lays fresh ones. That is what makes it safe to
  reschedule after a date slips.

---

## Getting paid, and paying

Invoices are not typed from scratch. A supplier invoice is raised from a
purchase order you have already received against; a customer invoice is raised
from a sales order you have already shipped. Both pull their amounts across, so
the numbers cannot drift from the order.

```mermaid
flowchart TD
    subgraph Pay["Paying a supplier"]
        A["Finance → Accounts Payable"] --> B["'Waiting to be invoiced'<br/>lists received POs"]
        B --> C["Raise invoice"]
        C --> D["Awaiting approval"]
        D --> E["Approve"]
        E --> F["Pay — amount pre-filled<br/>with the full balance"]
    end

    subgraph Collect["Collecting from a customer"]
        G["Finance → Accounts Receivable"] --> H["'Ready to invoice'<br/>lists shipped orders"]
        H --> I["Raise invoice"]
        I --> J["Receive — when the<br/>money arrives"]
    end

    F --> K["Balance falls · status<br/>follows the numbers"]
    J --> K
    K --> L["Finance → Payments<br/>shows every movement"]

    style E fill:#fef2f2,stroke:#c5101b
    style K fill:#fef2f2,stroke:#c5101b
```

**So: receive the goods before you can bill for them.** Nothing appears in
"waiting to be invoiced" until the purchase order has actually been received,
and nothing appears in "ready to invoice" until the sales order has shipped.

The three things the system will not let you do:

- **Pay more than is outstanding.** You get the exact figure back: *"SINV-… has
  62 619.20 outstanding; cannot apply 99 999.00."*
- **Record money the wrong way round.** A supplier invoice can only be settled
  by a payment going out, a customer invoice by one coming in.
- **Pay in the wrong currency.** The payment currency must match the invoice.
  Totals are never added across currencies either — the headline figures name
  the currency they are in, and other currencies are listed beside them.

A part payment is fine — the invoice goes to **Partially paid** and shows what
is left. Pay the remainder and it closes itself.

---

## Marketing

```mermaid
flowchart TD
    SEG["Campaign Management → Segments<br/>→ New segment"] --> RULES["Add rules<br/>city, state, keyword"]
    RULES --> AUD["Reusable audience"]

    AUD --> WA["WhatsApp → Create campaign"]
    AUD --> EM["Email campaigns"]

    WA --> TPL{"Approved template<br/>available?"}
    TPL -->|no| MAKE["Manage Templates & Numbers<br/>→ Create Template"]
    TPL -->|yes| SEND["Schedule and send"]
    MAKE --> SEND
    SEND --> TRACK["Deliveries tracked<br/>sent · delivered · read · failed"]

    LP["Landing Page → Landing Page Trackers<br/>→ Create tracker"] --> CAPTURE["Captures enquiries"]
    CAPTURE --> LEADNEW["Creates leads"]
    LEADNEW --> ATTRIB["Landing Page Trackers<br/>shows which page each came from"]

    OPTOUT["Anyone replying STOP"] -.->|"skipped by every campaign"| SEND
```

> **Email campaigns are different.** `/campaigns/email` reads from **Brevo**, an
> external service — not from this database. Without a Brevo API key configured
> that page cannot load. WhatsApp campaigns are stored locally and work on their
> own.

---

## Complete call-to-action reference

Every action button, what it does, and what must exist first.

### Administration

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Create User** | User Management | Adds a person and emails them credentials | — |
| **Notifications** (page) | Administration → Notifications | Choose which alerts you get, in-app and by email | — |

### Warehouse

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **New warehouse** | Warehouse → Warehouses & Bins | Creates a site. **The first thing to do in a new workspace** | — |
| **Add a zone** | Warehouses & Bins → detail | Splits the site by function (receiving, storage, picking…) | A warehouse |
| **Add a single bin** | Warehouses & Bins → detail | Adds one storage location | A zone |
| **Generate a rack layout** | Warehouses & Bins → detail | Creates many bins at once with consistent aisle/rack/level codes and a walk order | A zone |
| **Add a pallet** | Warehouses & Bins → detail | Registers a pallet; leave the code blank to auto-number | A warehouse |
| **New pick list** | Pick Lists | Creates picking work for an order | Stock in bins |
| **Complete** (putaway) | Putaway Queue | Confirms stock moved into its destination bin | An open putaway task |

### Products and pricing

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Add Category** | Product Configuration | Groups products | — |
| **Add Product** | Product Configuration | Creates an item. Item type decides whether it can be bought, sold or built | A category |
| **View Categories** | Product Configuration | Manage the category list | — |
| Price book entries | Sales → Price Books | Sets what a customer is charged | Products |

### Purchasing

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **New supplier** | Suppliers | Adds a vendor | — |
| **Add a contact** | Supplier → detail | Adds a person at that supplier | A supplier |
| **Add or supersede a price** | Supplier → detail | Records an agreed price; the previous one is retained as history | A supplier and product |
| **New requisition** | Purchasing → Requisitions | Asks to buy something, before a real order | A warehouse |
| **Convert to a purchase order** | Requisition → detail | Turns an approved request into a supplier order. Lines already ordered are excluded, so it cannot double-order | An approved requisition, a supplier |
| **New purchase order** | Purchase Orders | Orders directly from a supplier | A supplier and warehouse |
| **Submit for approval** | Purchase Order → detail | Sends the order to an approver | A draft order |
| **Record a goods receipt** | Purchase Order → detail | Records what physically arrived. **Does not change stock yet** | A sent order |
| **Post to stock** | Goods Receipt → detail | **Commits the receipt.** Creates lots, balances and movements | A receipt, and QC if required |

### Inventory

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Run reorder check** | Inventory | Re-evaluates every rule now instead of waiting for the sweep | Reorder rules |
| **Add / update policy** | Reorder Policies | Sets safety stock, reorder point and quantity for an item at a site | A product and warehouse |
| **Acknowledge** | Alerts | Marks an alert as seen without resolving it | An open alert |
| **Resolve** | Alerts | Closes an alert | An open alert |
| **Re-evaluate now** | Alerts | Recomputes alerts immediately | — |
| **Start a count** | Stock Counts | Opens a stock count sheet | A warehouse with stock |
| **Post variances to stock** | Count → detail | **Commits the count.** Writes gain/loss movements | A count with entered quantities |

### Materials and production

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Check availability** | Materials → Build Availability | Explodes a BOM and compares every component against free stock | An active BOM |
| **New requisition** | Materials → Requisitions | Asks the stores for parts | A warehouse |
| **Issue now** / **Issue everything outstanding** | Requisition → detail | Hands parts out and consumes them from stock | Stock on hand |
| **New BOM** | Bills of Materials | Starts a parts list for a product | A manufactured product |
| **Add** (component) | BOM → detail | Adds a part to the list. Loops are rejected | A draft BOM |
| **Add substitute** | BOM → detail | Approves an alternate part | A component row |
| **Activate** | BOM → detail | Freezes the BOM so it can be built from. **Disabled until it has ≥1 component** | A draft BOM with components |
| **Create revision** | BOM → detail | Opens a new draft; the active version stays frozen | An active BOM |
| **Retire** | BOM → detail | Marks an active BOM obsolete so it can no longer be built from | An active BOM |
| **New production order** | Production Orders | Plans a build | An active BOM |
| **Release & reserve materials** | Production → detail | Commits the job and reserves components | A planned order |
| **Book finished goods** | Production → detail | Records units produced and puts them into stock | A released order |

### Sales

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Add** / **Import** | Lead Management → Lead Master | Creates leads singly or from a file | — |
| **Export** | Most list pages | Downloads the current view | — |
| **Create Opportunity** | Opportunities | Starts a deal | An account |
| Raise a quote | Opportunity → detail | Prices the deal | An opportunity |
| **My approvals / All approvals** | Approvals | Switches between your queue and everything | — |
| Approve / Reject | Approval → detail | Decides a request. Nothing proceeds until you do | A pending approval |

### Planning

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Add work centre** | Planning → Work Centres | Registers a machine, line or bench that work can be scheduled on | A warehouse to put it in |
| **Schedule** | Planning → Production Board | Lays the order's routing out on the work centres with real dates | A production order whose BOM has a routing |
| Click a row | Planning → Production Board | Opens the order's steps, in order, with their centre and hours | — |
| **7 / 14 / 30 days** | Planning → Capacity | Changes how far ahead the load is measured | — |

### Finance

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **Raise invoice** | Accounts Payable → Waiting to be invoiced | Creates a supplier invoice from a received purchase order, amounts carried across | A received purchase order |
| **Raise invoice** | Accounts Receivable → Ready to invoice | Creates a customer invoice from a shipped sales order | A shipped sales order |
| **Approve** | Accounts Payable | Clears a supplier invoice for payment | An invoice awaiting approval |
| **Pay** | Accounts Payable | Records money going out against the invoice | An approved invoice with a balance |
| **Receive** | Accounts Receivable | Records money coming in against the invoice | An invoice with a balance |
| **Show overdue only** | Payables / Receivables | Filters to invoices past their due date | — |
| **Money out / Money in** | Finance → Payments | Filters the history by direction | — |


### Marketing

| Action | Where | What it does | Needs first |
|---|---|---|---|
| **New segment** | Segments | Saves a reusable audience | Contacts or leads |
| **Preview** / **Edit** / **Delete** | Segments | Inspect or change an audience | A segment |
| **Create campaign** | WhatsApp | Starts a WhatsApp send | A segment, a number, an approved template |
| **Create Template** | Templates & Numbers | Submits a message layout for approval | A WhatsApp number |
| **Sync Templates** | Templates & Numbers | Pulls approval status from the provider | Configured credentials |
| **Add Opt-Out** | Opt-Outs | Manually suppresses a number | — |
| **Create tracker** | Landing Page → Landing Page Trackers | Creates a page that captures enquiries | — |

---

## Things that will block you

Common dead ends, and what they actually mean.

| Symptom | Cause | Fix |
|---|---|---|
| Cannot record any stock | No bins exist | Create warehouse → zone → bin first |
| **Activate** greyed out on a BOM | It has no components | Add at least one component |
| Cannot edit an active BOM | Active BOMs are frozen so past jobs stay reproducible | **Create revision** |
| Goods receipt saved but stock unchanged | The receipt has not been posted | Open it and **Post to stock** |
| Count entered but figures unchanged | Variances not posted | **Post variances to stock** |
| Shortage list is empty although stock looks low | Open purchase orders already cover the gap | Correct — a shortage only exists when safety stock exceeds on-hand *plus* what is on order |
| `/campaigns/email` stuck loading | It reads from Brevo, not this database, and no API key is configured | Configure Brevo, or use WhatsApp campaigns |
| A sales user lands on a 404 | `SALES` accounts are confined to `/sales/*` | Use an admin account, or add the path to the guard's allow-list |
| Prices show the wrong currency | The header currency picker is a **display** setting; it relabels, it does not convert | Pick the currency you want in the header |
| **Schedule** replaced by "No routing" | The order's bill of materials has no operations on it | Add routing steps to the BOM — on a draft revision, not an active one |
| Cannot add routing to a BOM | Active BOMs are frozen | **Create revision**, add the steps, then activate |
| Capacity shows a centre over 100% | More work is booked on that day than the centre can do | Reschedule an order, or raise the shift length / parallel capacity |
| **Raise invoice** shows nothing to raise | Everything already has an invoice against it | Correct — the list only holds received POs and shipped orders that are still unbilled |
| A payment is rejected | You are over the balance, going the wrong direction, or in the wrong currency | The message says which; the figures in it are the live ones |
| Finance or Planning bounces you to another page | Both are admin-only, like the rest of the supply chain | Use an admin account |

---

## Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design and data-model dependencies
- [SUPPLY_CHAIN_MODULES.md](./SUPPLY_CHAIN_MODULES.md) — module reference and API endpoints
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — getting it running
