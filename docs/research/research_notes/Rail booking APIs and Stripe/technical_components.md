# Technical backend components for a multi-operator European rail ticket reseller

Research date: 2026-11-21. Scope: OSDM API lifecycle, back-end architecture patterns (search, hold, pay, confirm, fulfil, after-sales), commercial and technical models (merchant of record vs agent, settlement, through-ticket liability).

## Q1. Exact OSDM endpoints and flows for offer → provisional booking → confirm → fulfil → refund; typical hold durations

### Takeaway
OSDM (UIC IRS 90918-10) is a REST/JSON API. The flow is: `POST /trip-collection` (optional), then `POST /offers`, then `POST /bookings` (pre-booking, state `PREBOOKED`, with a "ticket time limit" of about 30 minutes recommended). Payment happens outside OSDM. Then come confirm and fulfil via `/bookings/{id}/fulfillments`, and after-sales through refund-offers, exchange-offers and release-offers sub-resources. Offers live about 30 minutes. OSDM v3.x is stable (up to 3.11.0), v4.0.0 is a draft, and the revised EU Telematics TSI (2026/253) recognises it.

### Cited Findings

**Versions and status**
- osdm.io lists stable Online API versions 3.0.7, 3.1.3, 3.2.4, 3.3.3, 3.4.6, 3.5.6, 3.6.4, 3.7.1, 3.8.0, 3.9.0, 3.10.0 and 3.11.0, previous version 2.0.7, and a draft v4.0.0. There are separate webhook specs (3.2.0 to 3.9.0). The spec is published as UIC leaflet IRS 90918-10 and is split into Part I Offline Model (fares data exchange) and Part II Online API (technical principles, models, processes, pagination, errors and warnings, synchronization). Deep-dive pages cover reservations, return trips, PRM, fulfilment on wallets and chip cards, the "requested information grammar", authentication and two-phase commit — [OSDM spec index](https://osdm.io/spec/)
- The old GitHub Pages URL (unioninternationalcheminsdefer.github.io/OSDM/spec/...) now 301-redirects to osdm.io. The source repo is UnionInternationalCheminsdeFer/OSDM — [osdm.io/spec/processes](https://osdm.io/spec/processes/)
- There is a community Rust client (`osdm-sys`) generated from OSDM API version 3.7.0. Its docs show `PATCH /bookings/{bookingId}` "updates a booking but does not confirm the booking". Confirmation is done through the fulfillments call, and there is a `finalize_fulfillments` operation for asynchronous fulfilment when "the provider doesn't complete the asynchronous fulfillment automatically". The client also has an on-hold API and a booking-part API — [docs.rs osdm-sys BookingsApi](https://docs.rs/crate/osdm-sys/latest/source/docs/BookingsApi.md), [fulfillments_api.rs](https://docs.rs/crate/osdm-sys/latest/source/src/apis/fulfillments_api.rs), [on_hold_api.rs](https://docs.rs/crate/osdm-sys/latest/source/src/apis/on_hold_api.rs)
- The Booking model has `provisional_price`, `provisional_refund_amount`, `confirmed_price` and `fulfillment_status` — [docs.rs osdm-sys Booking.md](https://docs.rs/crate/osdm-sys/latest/source/docs/Booking.md)

**Endpoints and process (from the official Processes page)**
- Trips: `POST /trip-collection` creates a trip collection. Later and earlier trips are fetched with `GET` plus scrolling tokens. The overview also lists `/trips` — [OSDM Processes](https://osdm.io/spec/processes/)
- Offers: `POST /offers` with an OfferCollectionRequest — [OSDM Processes](https://osdm.io/spec/processes/)
- Bookings: `POST /bookings` creates a pre-booking, `PATCH /bookings` adds payment information or vouchers, and `DELETE /bookings` cancels an unconfirmed booking. Booked offers sit under `/bookings/{bookingId}/booked-offers/...`, including reservations and ancillaries — [OSDM Processes](https://osdm.io/spec/processes/)
- Fulfilment: `/bookings/{bookingId}/fulfillments` both confirms the booking and retrieves fulfilments. The page does not spell out the verb; the osdm-sys client indicates `POST` — [OSDM Processes](https://osdm.io/spec/processes/); [osdm-sys](https://docs.rs/crate/osdm-sys/latest/source/README.md)
- After-sales resources: `/bookings/{bookingId}/refund-offers`, `/exchange-offers`, `/exchange-operations`, `/release-offers`, and `/cancel-fulfillments-offers`. Each follows the pattern "get an offer, then accept it" — [OSDM Processes](https://osdm.io/spec/processes/)
- Flow quote: "The process flow starts with getting offers which can be chosen by the customer". Offers are then pre-booked, paid outside OSDM, and booked. "Initially, a booking will have the status `PREBOOKED`." Passenger or reservation data may be demanded via `requestedInformation` — [OSDM Processes](https://osdm.io/spec/processes/)
- `requestedInformation` uses "a notation akin to regular expressions" to state what passenger data the provider needs before booking, for example names, birth date or document — [osdm-sys BookingRequest docs](https://docs.rs/crate/osdm-sys/latest/source/docs/BookingRequest.md)
- Payment: "OSDM does not currently handle the payment process directly" — [OSDM Processes](https://osdm.io/spec/processes/)
- After confirmation the booking goes to `FULFILLED`, or to `CONFIRMED` if fulfilment is deferred. For multi-journey products a fulfilment can be `on hold`, and then `AVAILABLE`, which is activated to `FULFILLED`. Fulfilments "can be in state expired if they had been available but were not requested in time" — [OSDM Processes](https://osdm.io/spec/processes/); [OSDM State models](https://osdm.io/spec/state-models/)
- "The status applies to the booking parts, no booking state exists". In other words, state is tracked per booked offer or part, not per booking. The full state diagrams are images only — [OSDM State models](https://osdm.io/spec/state-models/)
- Cancelling an unconfirmed booking puts it in `CANCELLED` "for a short 'grace' period", whose length is up to the implementer — [OSDM Processes](https://osdm.io/spec/processes/)

**Hold and timeout semantics**
- Offers "should have a limited lifetime (recommended value 30 minutes)" — [OSDM Models](https://osdm.io/spec/models)
- Pre-booking ticket time limit: "A commonly accepted value would be around 30 minutes". The booking's limit "can never exceed the earliest ticket time limit of any of its offer parts". "An unconfirmed booking expires after the time limit of the pre-booking" — [OSDM Models](https://osdm.io/spec/models)
- If the booking is not confirmed, "the booking will be cancelled when the ticket time limit is reached". Confirmation sets the time limit to 0 — [OSDM Processes](https://osdm.io/spec/processes/)
- "The price of an offer is not guaranteed before the pre-booking step" — [OSDM Processes](https://osdm.io/spec/processes/)

**Offer structure**
- In Retailer Mode, offers are collections of `OfferParts`: Admissions, Reservations, Ancillaries and Fees. In Distributor Mode "an offer will not contain offer parts but it will contain a fare element". Distributor mode also returns fare information but otherwise works identically — [OSDM Models](https://osdm.io/spec/models); [osdm-sys README](https://docs.rs/crate/osdm-sys/latest/source/README.md)
- Coverage: "the tripLegs covered by a given offer are indicated through the `coveredTripLegIndexes` property", and "each `tripLeg` of the `trip` must be covered by at least one `offer` in each `TripOffer` (no gap)" — [OSDM Models](https://osdm.io/spec/models)
- Passengers: the birth date is sent as-is, and each provider maps it to its own age-based types. Railcards and other entitlements are "modelled as reductions". PRM and disability attributes are included — [OSDM Models](https://osdm.io/spec/models)
- After-sales models: "A release of a booking is an intermediate step toward a refund" and it "invalidates tickets and frees booked resources". The exchange balance is the fulfilment's returnable value minus the new offer price, plus exchange fees — [OSDM Models](https://osdm.io/spec/models)

**Fulfilment formats**
- OSDM's Models page says "Only electronic fulfillment is considered in the MVP scope". A fulfilment links to offer parts, carries a business ID (the Ticket Control Number), and links to documents or barcodes — [OSDM Models](https://osdm.io/spec/models)
- Fulfilment type codes come from a code list. RCT2, RCCST and UIC_PDF are named as official UIC standards, and ALLOCATOR_APP is deprecated — [osdm-sys FulfillmentOption docs](https://docs.rs/crate/osdm-sys/latest/source/docs/FulfillmentOption.md)
- The FCB (Flexible Content Barcode) is an Aztec barcode defined in UIC IRS 90918-9 and in ERA TAP TSI Technical Document B.12 — [UIC FCB PDF](https://img2.uic.org/IMG/pdf/uic-passenger-flexible-content-barcode.pdf); [ERA TAP B.12](https://www.era.europa.eu/system/files/2023-10/ERA-OPI-2023-4%20-%20ERA_Technical_Document_TAP_B_12.pdf)
- "Secure paper": historically, tickets were protected by Security in Paper (SiP) and needed special printers and secured paper stock, which made online sales hard. Digital security elements (IRS 90918-9) replace this — [UIC 90918-9 shop page](https://shop.uic.org/en/14274-digital-security-elements-for-rail-passenger-ticketing-9793.html); [gist quoting the doc](https://gist.github.com/derhuerst/26c1706c1bc1d9ebae76104a14d27f97)
- RCT2 is the railway layout standard for paper (and PDF) tickets with printed barcodes — [ERA terminology](https://www.era.europa.eu/era-railway-terminology-collection/rct2compressed/term_1/telematics_applications_for_passenger)
- A fulfilment type and media override (for example, A4 PDF) is discussed in the OSDM wiki — [OSDM wiki I-72](https://github.com/UnionInternationalCheminsdeFer/OSDM/wiki/I-72-Fulfillment-Type-Media-override-and-named-value-list-on-Fulfillment-Part)

**Adoption and regulation**
- CER (19 Mar 2026): OSDM is "a fully available multilateral solution". The revised Telematics TSI recognises OSDM. Early adopters report international sales up to 75% higher in Jan–Feb 2026 than in the same months of 2024. The 2026–2030 phase targets a "pan-European rollout of OSDM-online" by 2030 — [CER press release](https://www.cer.be/cer-press-releases/seamless-rail-ticketing-reaches-new-milestones)
- CER's 7th monitoring report (Q4 2025) says OSDM and eTCD are fully available, but individual railway implementation is uneven — [CER Ticketing Roadmap 7th report](https://www.cer.be/images/publications/reports/CER_Ticketing_Roadmap_7th_Report_Q4_2025.pdf)
- The new Telematics TSI, Implementing Regulation (EU) 2026/253, was published 26 Feb 2026. An EC conference deck shows phased dates (Common reference data 13 Dec 2026; Availability & reservations 10 June 2029) — [TTG 2026 EC slides](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf); [OJ text via CIT](https://www.cit-rail.org/secure-media/files/tel-tsi-regulation-2026/oj_l_202600253_en_txt.pdf?cid=443440)
- Example rollout: LTG Link (Lithuania) is implementing OSDM with Turnit, with completion in H2 2026 — [railwaynews](https://railwaynews.net/ltg-link-upgrades-ticketing-with-turnit-osdm-by-2026.html)

### Inferences
- An MVP can model its internal API on OSDM nouns (Trip, Offer with OfferParts, Booking with BookedOffers, Fulfillment, RefundOffer). This makes a later swap to real OSDM providers cheap.
- Hold TTL is effectively at most 30 minutes, and per booking it is the minimum TTL across all offer parts. For multi-leg orders the checkout clock must use min(confirmableUntil) across legs, and Stripe payment must be captured, or confirm must start, well before that.
- Because OSDM does not support partial confirmation, a reseller that aggregates several OSDM providers itself has to own the cross-provider saga.

### Gaps
- Exact field names for TTLs (for example `confirmableUntil` or `ticketTimeLimit`) were not verified in the YAML. The Models page uses "confirmation time limit". Check the OpenAPI file for the chosen version.
- State enum values for booked offers, refunds and exchanges are only in diagrams; I did not extract them.
- I found no per-operator OSDM adoption list (SNCF, DB, ÖBB, SBB, Trenitalia), and no actual production hold durations per operator.
- I found no authoritative OSDM-to-UIC 918.3 or FCB mapping table. The code list page should be checked.
- The two-phase-commit deep-dive URL (`/spec/two-phase-commit/`) returned 404, so I could not read it.

## Q2. How do Trainline/Omio-like platforms orchestrate multi-carrier bookings and partial failures? (architecture patterns)

### Takeaway
There is no public engineering write-up from Trainline or Omio on partial-failure handling. The OSDM spec itself prescribes the pattern: all-or-nothing pre-booking with rollback (`DELETE` the sub-bookings), no partial confirmation, and refunds or an `ERROR` state plus cleanup after a failed confirm. Generic saga orchestration, idempotency keys and the transactional outbox are the standard way to implement this.

### Cited Findings
- OSDM on combining providers: "While the combination logic on fares is left to the **Distributor**, it is recommended to only build and retain offers that are _homogeneous_". The Retailer must make pre-booking all-or-nothing: "all pre-booking operations are either fully successful or not executed at all". When sub-providers partly fail, the successful pre-bookings are rolled back via `DELETE` on the sub-provider booking — [OSDM Processes](https://osdm.io/spec/processes/)
- At confirmation OSDM "does not support partial confirmation or partial fulfillment". Retailers clean up by refunding, or expose an `ERROR` status and let the consumer retry or clean up with `cleanupPartialBooking` — [OSDM Processes](https://osdm.io/spec/processes/)
- Trainline describes "Platform One" as aggregating routes and fares from hundreds of carriers, running 100% cloud-based on AWS across three data centres — [Trainline innovation](https://www.trainlinegroup.com/what-we-do/innovation). Its wholesale API has no public docs, sandbox or self-serve signup — [api-evangelist/trainline](https://github.com/api-evangelist/trainline)
- Trainline added the ability to book multiple inventories in one itinerary (B2B release note) — [Goelett](https://goelett.com/product-knowledge/product-releases/improved-mixed-carrier-rail-trip-with-trainline)
- Omio terms: some tickets "cannot be issued immediately due to the transport service provider's manual processes… up to 24-48 hours". Asynchronous fulfilment is a real production case — [Omio terms](https://www.omio.co.uk/terms-of-use)
- Saga: "a reliably coordinated sequence of local transactions". It comes in two styles, choreography (events) and orchestration (a central orchestrator sends commands). It needs explicit compensating transactions and countermeasures for lack of isolation. The transactional outbox is the pattern for atomically updating the DB and publishing an event — [microservices.io Saga](https://microservices.io/patterns/data/saga.html)
- Stripe idempotency: the client sends an `Idempotency-Key` header (V4 UUID suggested, up to 255 chars, no PII). In API v1 the first result is saved, including 500s, and replayed on retry. Keys can be pruned after 24 h. Parameters are compared, and a mismatch errors. Only POSTs take keys — [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- Journey planning: Transitous provides the MOTIS 2 API at `https://api.transitous.org/api/` (for example `GET /api/v5/plan`), built from open GTFS and GTFS-RT feeds — [Transitous API](https://transitous.org/api/); [motis-openapi-sdk](https://docs.rs/crate/motis-openapi-sdk/5.0.0); [MOTIS GitHub](https://github.com/motis-project/motis)
- The Transitous usage policy does NOT allow commercial use. Over 720 requests per 24 h to /plan needs coordination. It requires a User-Agent with app name, version and contact, plus attribution to transitous.org/sources. It is best-effort and may cut off consumers. A commercial reseller should self-host MOTIS (open source) with GTFS feeds instead — [Transitous API policy](https://transitous.org/api/)
- Regulation 2021/782 Art. 10 requires railway undertakings and infrastructure managers to provide real-time traffic and travel information to ticket vendors — [National Transport Authority (IE) briefing](https://www.nationaltransport.ie/wp-content/uploads/2021/09/2021-06-09-the_new_passenger_rights_regulation.pdf)

### Inferences (recommended design for a small team)
- **Two-stage search.** (1) A journey planner (self-hosted MOTIS on GTFS, or the operator's own trip search / OSDM `trip-collection`) produces itineraries, split into legs by carrier. (2) A fare and offer fan-out per leg runs in parallel to each operator connector, with a per-connector timeout of a few seconds. Results stream or merge, and a "price from" is shown. In the demo, operators may be mocked.
- **Caching.** Cache journey plans aggressively (timetables change rarely). Cache offers only briefly (minutes, under the 30-minute OSDM offer lifetime), keyed by (origin, dest, date, passenger-profile hash). Always re-price at pre-booking, since OSDM does not guarantee price before then. Show "price changed" UX when the re-priced total differs.
- **Booking orchestration as a persisted state machine** (orchestrated saga) per Order, with per-leg sub-states:
  `DRAFT → HOLDING (POST /bookings per leg, in parallel) → HELD (all legs) → PAYMENT_PENDING (Stripe PaymentIntent, manual capture or authorise-only) → CONFIRMING (confirm each leg) → CONFIRMED → FULFILLING → FULFILLED`.
  - If any hold fails, compensate by `DELETE` on the held legs (the OSDM-prescribed rollback), cancel the PaymentIntent, and offer an alternative.
  - The pivot point is the first successful leg confirmation. Before it everything is cheaply reversible. After it, a failed leg means retrying that leg (it is retriable until its TTL), then compensating confirmed legs through refund-offers. This may not be free (non-refundable fares), so the platform absorbs the loss or rebooks. Order: authorise payment, hold all legs, confirm legs, capture payment (or refund the uncaptured part).
  - To minimise risk, confirm the most fragile or least refundable leg first. A timer job expires orders at min(leg TTL) minus a safety margin.
- **Idempotency everywhere.** Send an idempotency key per Stripe call (derived from orderId and step) and per operator call where supported. Store each outbound call in a `provider_calls` table (request hash, response, status) so retries after a crash are safe. Where the operator has no idempotency, look up the booking by external reference before retrying.
- **Outbox.** Write a state transition and an `outbox` row in one DB transaction. A worker publishes or executes the next step. Stripe webhooks (`payment_intent.succeeded` / `amount_capturable_updated`) feed the same state machine, with signature verification and dedupe on event id.
- **Asynchronous fulfilment.** Poll or receive webhooks (OSDM webhooks exist from 3.2) until the fulfilment is `FULFILLED`, then store the PDF or barcode in object storage and email a link. Omio shows 24–48 h manual issuance exists, so the UX needs a "ticket pending" state.
- **MVP vs production.** For the MVP, use a single process (FastAPI + Postgres/SQLite) with a state column, an APScheduler/cron for expiry, and mocked operator connectors following OSDM shapes. For production, run a durable workflow engine (Temporal or a step-functions equivalent) or an outbox and queue, with per-connector circuit breakers, observability per provider, and reconciliation jobs.

### Gaps
- I found no public Trainline or Omio engineering blogs or talks on saga or partial-failure handling. Their internal patterns are not verifiable.
- I found no published data on typical per-operator offer response latencies or timeouts.

## Q3. What data must be stored and how to reconcile with operators? Commercial models, settlement and through-ticket liability

### Takeaway
Store an immutable order ledger: offers as quoted, per-leg provider booking IDs, TCNs and states, amounts in minor units per leg, Stripe IDs, every provider call, and fulfilment documents. Then reconcile daily against operator sales and settlement reports. Under Reg. 2021/782 Art. 12(4), a ticket vendor that combines tickets on its own initiative in one transaction is liable for a full refund plus 75% compensation on a missed connection. The only exception (Art. 12(5)) is when it clearly informed the passenger before purchase that the tickets are separate contracts, and the vendor carries the burden of proof. Being agent or merchant of record determines who carries payment and liability risk.

### Cited Findings

**Regulation (EU) 2021/782, Article 12 (verbatim from the OJ text)**
- 12(2): "For journeys including one or more connections, the passenger shall be informed prior to purchasing a ticket or tickets whether that ticket or those tickets constitute a through-ticket." — [Reg. 2021/782 OJ L 172 (PDF via NTA Ireland)](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf)
- 12(3): tickets bought in a single commercial transaction from a railway undertaking constitute a through-ticket, and the RU is liable under Arts 18–20 for missed connections — [same](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf)
- 12(4): "Where a ticket or tickets are purchased in a single commercial transaction and the ticket vendor or tour operator has combined the tickets on its own initiative, the ticket vendor or tour operator … shall be liable to reimburse the total amount paid for that transaction … and, moreover, to pay compensation equivalent to 75 % of that amount in the event that the passenger misses one or more connections." — [same](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf)
- 12(5): the liabilities do not apply if the tickets, another document, or a reproducible electronic record state "that the tickets represent separate transport contracts, and the passenger was informed of this prior to the purchase" — [same](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf)
- 12(6): "The burden of proof that the passenger was provided with the information … shall lie with the railway undertaking, tour operator or ticket vendor that sold the ticket". 12(7): vendors handle the complaints, and reimbursement plus compensation "shall be paid within 30 days after the receipt of the request" — [same](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf)
- Art. 3(5) defines "ticket vendor" as any retailer of rail transport services selling tickets, including through-tickets, under an agreement with one or more RUs. Art. 3(9) defines "through-ticket" by reference to Directive 2012/34/EU Art. 3(35) — [same](https://www.nationaltransport.ie/wp-content/uploads/2024/04/Rail-passengers-EU-Regulation-2021-782.pdf); [ERA terminology: ticket vendor](https://www.era.europa.eu/era-railway-terminology-collection/ticketvendor/term/sera_eu_transport)
- Pending changes: 2026 Council documents on an amending regulation (passenger-rights enforcement, multimodal "single ticket") say RUs should not be liable where a ticket vendor combines their services into a single ticket. They also clarify the reimbursement of intermediary fees. It is still in the legislative process — [Council ST-16123-2024](https://data.consilium.europa.eu/doc/document/ST-16123-2024-INIT/en/pdf); [Council PE-59-2026](https://data.consilium.europa.eu/doc/document/PE-59-2026-INIT/en/pdf)

**Agent vs merchant of record**
- Omio acts "as an agent for the purposes of offering a booking service". For selected providers it sells tickets "in the name and on behalf of the third-party providers … as a commercial agent", and earns commission — [Omio terms](https://www.omio.co.uk/terms-of-use)
- Omio B2B offers partners a mode "becoming the merchant of record, managing the entire booking and payment process within their environment" — [Omio B2B](https://omio.com/corporate/omio-b2b/)
- Trainline's own CMA submission says fares "are set by the operators and Trainline receives a small commission". This is a party's submission, not a finding — [Trainline response to CMA](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1030691/Trainline_Response.pdf)
- Rail Europe is an "official sales partner" whose tickets are "confirmed on their [operators'] systems". Omio Group agreed to acquire Rail Europe (Skift, 16 Jul 2026) — [Rail Europe](https://www.raileurope.com/en-gb/about-us); [Skift](https://skift.com/2026/07/16/omio-to-buy-rail-europe-consolidating-ground-transport-exclusive/)
- The UK ORR reviewed fee transparency at seven online retailers, including Omio and Trainline. Booking fees must be shown clearly — [ORR online ticket fees](https://www.orr.gov.uk/monitoring-regulation/rail/passengers/consumer-law-investigation-and-enforcement/online-ticket-fees)

**Settlement and clearing**
- HERMES is a pan-European railway data-communication network (nodes at railways' computer centres, central bureau in Utrecht), operated by Hit Rail, which is owned by 11 railways. This is a secondary source — [railwaynews on UIC 917-5](https://railwaynews.net/uic-leaflet-no-917-5-chapter-9-information-technology-miscelleanous-description-of-the-hermes-system.html); [UIC/Hit Rail deck](https://uic.org/events/IMG/pdf/hit_rail_-_uic_passenger_week_1.3.pdf)
- Cross-distribution of tickets rests on multilateral agreements: IRS 90918-1, 90918-8, 90918-9, and IRS 30301 (accounting). UIC Leaflet IF 5 (formerly 301) governs "settlement of accounts in international passenger traffic" — [UIC Passenger Services Group](https://uic.org/passenger-services-group); [railwaynews IF 5](https://railwaynews.net/uic-leaflet-no-if-5-chapter-7-way-and-works-admission-of-higher-curving-speeds-for-special-trains.html)
- UIC runs an electronic ticket control database service provided by Hit Rail (shared TCN validation across railways) — [railway-technology](https://www.railway-technology.com/news/hit-rail-provides-electronic-ticket-control-database-to-uic/)

**PII**
- OSDM passes the birth date rather than an age category, and models railcards as reductions. Providers may require further data via `requestedInformation` — [OSDM Models](https://osdm.io/spec/models); [osdm-sys BookingRequest](https://docs.rs/crate/osdm-sys/latest/source/docs/BookingRequest.md)

### Inferences
- **Data model (minimum).**
  - `orders` (id, customer, total_minor, currency, state, stripe_payment_intent_id, created/expires_at, through_ticket_flag, separate_contracts_disclosure_version_shown + timestamp, which is legal proof under Art. 12(6)).
  - `order_legs` (carrier, provider, provider_booking_id, booked_offer_ids, TCN, fare conditions snapshot, price_minor, state, confirmable_until).
  - `passengers` (name, birth date, railcard/reduction type and number, kept minimal, encrypted at rest).
  - `provider_calls` (idempotency key, request/response, latency) and `outbox`.
  - `fulfilments` (type: PDF / UIC 918.3 / FCB Aztec / wallet, object-storage key, barcode payload hash, valid-from/to).
  - `refunds` (refund_offer_id, amounts, fees, Stripe refund id) and `ledger_entries` (double-entry: customer receivable, operator payable, commission, Stripe fees).
- **Reconciliation.** Run a daily job matching per-leg confirmed bookings and refunds against each operator's sales or settlement report (via their portal, SFTP CSV, or clearing statements), plus against Stripe balance transactions/payouts. Flag "booked at operator but not paid", "paid but not booked" (refund immediately), and amount mismatches. Under the agent model the operator invoices net-of-commission, or the agent remits gross minus commission. Many operators require deposits or bank guarantees from resellers. Under MoR the platform owns chargebacks and refunds to customers, and the Stripe account sits in its name.
- **GDPR.** Passenger names, birth dates and railcard numbers are personal data. Collect only what each leg's `requestedInformation` asks for, set retention (for example, ticket validity plus the after-sales and complaint window plus statutory accounting retention for the financial records only), keep the processor and controller roles with operators in the terms, and avoid PII in idempotency keys and logs (Stripe explicitly warns against PII in keys).
- **Through-ticket UX.** In the MVP, a combined multi-operator order sold in one Stripe payment by a reseller is by default caught by Art. 12(4). Show an explicit, stored "separate transport contracts" disclosure before payment, print it on each ticket or confirmation email to use the Art. 12(5) exemption, or knowingly accept the liability (refund plus 75%) and price it in as an insurance-like "connection guarantee" (as Trainline/Omio-style "guarantee" products do; not verified here).
- **Hackathon MVP.** Stripe test-mode PaymentIntent with `capture_method=manual`, mocked operator connectors with a 30-min hold TTL, a state machine in Postgres, generated PDF with an Aztec code (FCB-like payload) as the "ticket", and a refund flow via Stripe Refund. Production adds real OSDM or bilateral APIs, distribution contracts, settlement, a deposit, and possibly a TSP licence.

### Gaps
- No official source described how a third-party reseller actually participates in UIC clearing (IF 5 / IRS 30301 are for RU-to-RU accounting). Whether non-RU distributors are settled via clearing or via bilateral invoicing per operator could not be confirmed. Bilateral contracts appear to be the norm, but this is unverified.
- Specific deposit or guarantee amounts and commission rates (for example SNCF, DB, Trenitalia reseller programmes) were not found.
- No source confirmed how Trainline or Omio legally handle Art. 12(4) (disclosure vs guarantee products).
- The Art. 18/19 reimbursement timeline was not re-extracted in this session. The text shows ticket-price compensation "within one month after the submission of the request" (Art. 19(7)). Verify for Art. 18.
