# Shifa Pro inventory and financial workflow

## Stock workflow

- Receiving a lot stores its lot number, expiry, SDG unit cost, quantity, purchase record, movement, and one queued sync event in a single local transaction.
- Sales consume non-expired lots in FEFO order. A sale with insufficient saleable stock is rejected and leaves no partial sale or stock movement behind.
- The sale stores the lot cost snapshot on each sale line. That snapshot is the basis for COGS; historical rows without a snapshot remain incomplete instead of using a current or guessed cost.
- Push sends each receipt, sale, adjustment, or exchange-rate event through an idempotent Supabase RPC. A repeated network request with the same event ID does not apply the balance twice.
- Reconciliation compares local lot quantities to the shared pharmacy product balance and opens exceptions for mismatches, missing shared rows, and unknown shared quantities. It does not overwrite either balance.

## Currency and reports

All stock costs, sales prices, and sale totals are entered and stored as SDG. Daily exchange rates are entered as **SDG per 1 USD**. Day, month, and year reports sum revenue and COGS in SDG and convert each day's amounts using that day's rate. USD totals are marked incomplete while any day with sales is missing a rate. Rate changes are retained in the local audit table and synchronized as append-only events.

## Deployment

Apply `supabase/migrations/20261017000001_inventory_operations.sql` to the project's Supabase database before using shared inventory sync. Until then, local receipts and sales remain queued; the app does not mark them as synced. This migration creates the private event ledger and the idempotent inventory and exchange-rate RPCs. Inventory cost and lot details remain in the private event ledger; the publicly readable inventory table receives only product quantity and availability.

Existing local lots receive local opening-balance movement records when the app opens. Existing sales are backfilled with their business date, but their missing lot costs are not inferred. Reconcile after migration and review opening-balance exceptions before relying on shared quantities.
