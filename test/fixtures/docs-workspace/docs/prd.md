# Bookstore API PRD

The Bookstore API sells books on behalf of tenants who embed our checkout in
their own storefronts. This document is what the first release is measured
against, and it is read by the people building it and by the agents working
alongside them.

It is not a status report. Where a paragraph below says something must hold, it
is meant as a requirement; where it says something is deliberately not being
built, it is meant as a boundary.

## Checkout and payments

A cart that has been priced but not confirmed expires after thirty minutes. The
prices in an expired cart are recomputed rather than honoured, because a tenant
may change a book's price while a shopper is deciding.

Refunds are issued against the original Stripe payment intent rather than by
bank transfer, so a refund can never exceed what was captured.

Guest checkout is not in the first release. Every order belongs to an account,
which is what lets a tenant answer "where is my order" without asking the
shopper for the card they paid with.

## Catalogue and search

The ISBN-13 is the catalogue's natural key. Two tenants may stock the same
book, so the key that identifies an edition is not unique on its own and is
always read together with the tenant it belongs to.

Search results are paginated at fifty titles per page. A larger page makes the
Postgres full-text query slow enough to be felt, and no tenant storefront shows
more than fifty results at once.
