# Stripe payments and security for a multi-operator European rail ticket reseller

Scope: one customer payment covering N legs, each booked with a different rail operator, where any booking can fail on its own. Research date: 21 Nov 2026. Stripe docs were fetched live; API version strings seen in the docs: `2026-11-18.endive` / `2026-11-18.preview`.

## Q1. Recommended flow and Stripe API calls for "hold N legs, then capture once" with partial failure

### Takeaway
Use one PaymentIntent with `capture_method=manual`, created by the server from server-side prices. Authorize it, then book each leg with its operator. Once every booking has resolved, make **one** capture with `amount_to_capture` = the sum of the legs that were confirmed. Stripe releases the uncaptured rest automatically. If no leg was booked, cancel the PaymentIntent. You don't need multicapture or incremental authorization for this, and both require IC+ pricing. Use Checkout Sessions (`ui_mode=elements` or `embedded_page`) with `payment_intent_data.capture_method=manual` unless you need full control. In that case use PaymentIntents with the Payment Element.

### Cited Findings

**Choosing the API and UI**
- Stripe recommends the Checkout Sessions API with the Payment Element for most integrations. It calls Payment Intents a lower-level API that "requires significantly more code and ongoing maintenance". With PaymentIntents you also have to build tax, discounts and currency conversion yourself. — [Stripe: Checkout Sessions vs Payment Intents](https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison)
- Checkout Sessions offers a hosted full page, an embedded form, or Elements UI. Payment Intents offers Elements or a custom UI only. Checkout Sessions has built-in Stripe Tax (`automatic_tax.enabled=true`) and lifecycle webhooks. Sessions expire after 24 hours by default. — [Stripe comparison](https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison)
- `ui_mode` values are `hosted_page` (default), `embedded_page`, `elements` and `form`. `expires_at` can be set anywhere from 30 minutes to 24 hours after creation. `client_reference_id` takes up to 200 chars, for reconciliation with an internal cart/order ID. `metadata` is a key-value map. `submit_type=book` is "Recommended when offering bookings". — [Stripe API: Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- The Stripe API reference says to protect the Session-creation endpoint "with access controls and limits on repeated creation". — [Stripe API: Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- For manual capture with Checkout, pass `payment_intent_data[capture_method]=manual`. Capture uses the PaymentIntent ID taken from the Checkout Session object. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)

**Authorize, then capture**
- With `capture_method=manual`, Stripe authorizes without capturing. After confirmation the PaymentIntent status becomes `requires_capture`. `POST /v1/payment_intents/{id}/capture` captures the full amount by default. `amount_to_capture` captures less, and "A partial capture automatically releases the remaining amount." — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- Most payments allow only **one** capture: "If you partially capture a payment, you can't perform another capture for the difference." — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- You can set manual capture for cards only with `payment_method_options[card][capture_method]=manual`, so that methods without auth/capture support can still be offered. ACH and iDEAL don't support separate capture. Cards, Klarna (until the 28th day), PayPal (10 days, auto-extended to 20), Affirm and Afterpay do. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- When the customer completes a manual-capture payment, Stripe fires `payment_intent.amount_capturable_updated`. Check `amount_capturable` on the event. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- An authorization is cancelled by cancelling the PaymentIntent. If it expires before capture, the funds are released and the status becomes `canceled`. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- `payment_method_details.card.capture_before` on the Charge shows when the authorization expires. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- Private preview: `payment_method_options[card][capture_method]=automatic_delayed` makes Stripe auto-capture about 6 hours before the authorization expires. `capture_by` takes `auth_expiry`, `end_of_day` or `target_delay`. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)

**Multicapture (optional, IC+ only)**
- Multicapture means several partial captures of one authorization: up to 50 non-final captures with `final_capture=false`, plus one final capture. It is an IC+ pricing feature, so blended-pricing accounts must ask support. It works for online cards only (Visa, Mastercard, Amex, Discover, Cartes Bancaires, Diners, CUP/JCB in some regions) and requires `capture_method=manual` and `payment_method_options[card][request_multicapture]=if_available`. Check `latest_charge.payment_method_details.card.multicapture.status`. — [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)
- To release the rest after at least one capture, call capture with `amount_to_capture=0&final_capture=true`. — [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)
- Network rules: most networks restrict multicapture to card-not-present sales of goods shipped separately. "Certain card networks permit multicapture for businesses based on their industry (for example, travel)". — [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)
- Multicapture is **not** supported with separate charges and transfers using `source_transaction`. Partial refunds with `refund_application_fee=true` or `reverse_transfer=true` aren't supported either. — [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)
- Webhooks: each capture sends `charge.updated` and `payment_intent.amount_capturable_updated`. `charge.captured` is sent on the final capture or when the authorization expires. — [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)

**Incremental authorization (if the price rises before capture)**
- `POST /v1/payment_intents/{id}/increment_authorization` takes a new total `amount`. It requires `request_incremental_authorization=if_available` at confirmation, and it is IC+ only. You get at most 10 attempts per PaymentIntent. Each increment is capped at 500 USD over or 500% over the previous amount, whichever is higher. It doesn't extend the validity window. If it fails, you get `card_declined` and the PaymentIntent stays capturable for the old amount. It can't be used after a multicapture partial capture. — [Stripe: Incremental authorization](https://docs.stripe.com/payments/incremental-authorization.md?platform=web&ui=elements)
- Visa, Mastercard and Amex support it for all merchant categories. Discover supports it for passenger railways and passenger transportation among others. — [Stripe: Incremental authorization](https://docs.stripe.com/payments/incremental-authorization.md?platform=web&ui=elements)
- Under SCA, requesting incremental authorization sets the card up for off-session use. Later increments count as merchant-initiated and get **no liability shift**. Networks prohibit increments where the amount "should be known at the time of authorization". — [Stripe: Incremental authorization](https://docs.stripe.com/payments/incremental-authorization.md?platform=web&ui=elements)

**Idempotency**
- Send an `Idempotency-Key` header on every v1 `POST`. Keys can be up to 255 characters; V4 UUIDs are recommended, and keys must not contain PII. The first response is saved, **including 500 errors**. Keys may be pruned after 24 hours or more. Reusing a key with different parameters returns an error. Results aren't saved when validation fails or a concurrent request conflicts, so those can be retried. GET and DELETE don't need keys. — [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests)

**Refunds, Connect refunds and disputes**
- For destination charges and separate charges and transfers, refunds debit the platform balance, and the platform can reverse transfers to recover the money. If the balance is too low, the refund stays `pending` and fails with `insufficient_funds` after 45 days. — [Stripe: Connect charges](https://docs.stripe.com/connect/charges)

**Webhooks**
- Verify the `Stripe-Signature` header with the endpoint's `whsec_` secret using the **raw** body. Any change to the body breaks verification. Return 2xx quickly, before running complex logic. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)
- Retries: in live mode Stripe retries for up to 3 days with exponential backoff. In a sandbox it retries 3 times over a few hours. Manual resend works for 15 days from the Dashboard and 30 days from the CLI. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)
- Event order is **not guaranteed**. Don't use `created` to order events or to dedupe them, because it has seconds resolution. Dedupe on `event.id`. Sometimes two separate Events are created for the same change; catch those with `data.object.id` plus `event.type`. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)
- Other recommendations: process events asynchronously through a queue, subscribe only to the events you need, exempt the route from CSRF, use TLS 1.2/1.3, allowlist Stripe IPs, and roll signing secrets periodically (the old secret can stay valid for up to 7 days during rotation). Stripe treats redirects (3xx) as failures. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)
- Manual verification: compute HMAC-SHA256 over `"{t}.{raw_body}"`, compare it to every `v1` entry in constant time, and ignore `v0` and the debug entries (`secret`, `destination`, `payload`), which aren't covered by the HMAC. SDKs use a 5-minute default tolerance. Never set the tolerance to 0, because that disables the recency check. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)
- Stripe recommends thin events for new integrations. Snapshot events are still available. Up to 16 event destinations are allowed. — [Stripe: Webhooks](https://docs.stripe.com/webhooks)

### Inferences
- **Concrete flow (inferred from the docs above):**
  1. `POST /api/orders` (our API). The server reprices the itinerary from operator offers it fetched itself, stores an `order` (status `pending_payment`) with legs, amounts in minor units and currency, and computes `total`. It never accepts a price from the client.
  2. `POST /v1/checkout/sessions` with `mode=payment`, `ui_mode=elements` (or `embedded_page`), `submit_type=book`, `expires_at=now+30min` (the minimum), `client_reference_id=order_id`, `metadata[order_id]`, `payment_intent_data[capture_method]=manual`, `payment_intent_data[metadata][order_id]`, `payment_intent_data[statement_descriptor_suffix]`, and one `line_items[].price_data` per leg. Send `Idempotency-Key: order:{order_id}:session:v{n}`. Pure-PaymentIntents alternative: `POST /v1/payment_intents` with `amount`, `currency`, `capture_method=manual`, `automatic_payment_methods[enabled]=true` and `metadata[order_id]`.
  3. The client confirms. Handle `checkout.session.completed` and/or `payment_intent.amount_capturable_updated` in the webhook: the status is `requires_capture`. Store `capture_before`.
  4. The server books each leg with its operator: in parallel, with a per-leg idempotency or reference key where the operator supports one, and with a deadline. Persist each leg's outcome (`confirmed` / `failed`).
  5. If every leg is resolved and at least one confirmed, call `POST /v1/payment_intents/{pi}/capture` with `amount_to_capture=sum(confirmed)` and `Idempotency-Key: order:{id}:capture`. Stripe releases the remainder automatically. If none confirmed, call `POST /v1/payment_intents/{pi}/cancel`.
  6. If the business rule is "all or nothing" (for example, a connection makes no sense without the other leg), cancel the operator bookings that succeeded and cancel the PaymentIntent. Many rail bookings are free to cancel only before ticket issuance, so this has to be checked per operator.
  7. Later, after-sales cancellations: `POST /v1/refunds` with `payment_intent` and `amount` (a partial refund per leg), `metadata[leg_id]`, and an idempotency key per leg refund.
- Prefer one capture with a reduced `amount_to_capture` over multicapture. Every booking resolves within minutes, so there is no reason to capture in stages, and this avoids the IC+ requirement and the `source_transaction` incompatibility. Use multicapture only if legs are ticketed hours or days apart.
- Cancelling an authorization (a void) generally avoids a refund showing on the customer's statement. Capturing and then refunding is worse: there are fees, and the customer sees two entries. That is why the capture decision belongs after all bookings have resolved. Stripe's non-refund of processing fees on refunds isn't verified here; see Gaps.
- Metadata to link records: `order_id` (also as `client_reference_id`), `leg_ids` (comma list, or one key per leg), `operator_pnrs` added after booking with `PaymentIntent.update`, and `env`. Never put PII or the card holder's name in metadata or idempotency keys.
- Webhook handler pattern: verify the signature, insert `event.id` into a `processed_events` table with a unique constraint, enqueue, return 200. The worker re-fetches the PaymentIntent from the API, so it acts on current state and doesn't depend on event order. Make state transitions monotonic (for example, ignore `amount_capturable_updated` if the order is already `captured`).
- Events worth handling: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.captured`, `charge.refunded`/`refund.updated` (to catch failed refunds), `charge.dispute.created`, `charge.dispute.closed`, `radar.early_fraud_warning.created`. Inferred from the event types mentioned in the Stripe docs above; the full event catalog was not fetched.

### Gaps
- I did not fetch Stripe's refund docs (refund timing, fees not returned on refund, `refund.failed` handling); verify at https://docs.stripe.com/refunds.
- I did not verify whether cancelling an uncaptured PaymentIntent costs a fee in the EEA, or what Stripe's pricing is for uncaptured authorizations.

## Q2. Authorization expiry versus rail booking hold TTLs (10 to 30 minutes)

### Takeaway
Authorization windows aren't the constraint. Online customer-initiated card authorizations last 7 days on Visa, Mastercard, Amex and Discover, and merchant-initiated Visa authorizations last about 4 days 18 hours. The real constraint is the operator's provisional hold (10 to 30 min) and the Checkout Session lifetime (minimum 30 min). Start the operator holds only after authorization succeeds, or create a short-lived hold before payment and a Session with `expires_at` aligned to it. Extended authorization (up to 30 days) is unnecessary for instant ticketing.

### Cited Findings
- Card-not-present validity windows: Visa 7 days for CIT and 5 days for MIT ("exact authorization window is 4 days and 18 hours"); Mastercard, Amex and Discover 7 days for both CIT and MIT. Stripe and the networks classify CIT and MIT from signals of cardholder participation, not only from `off_session`. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- Card-present windows: Visa about 5 days, Mastercard, Amex and Discover 2 days. — [Stripe: Place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- Extended authorization: `payment_method_options[card][request_extended_authorization]=if_available`. It is IC+ only. Visa gives 30 days (actually 29 days 18 h) for hotel, lodging, vehicle rental and cruise; for other categories Stripe charges +0.08% and the extension applies to CIT only. Mastercard gives 30 days for all categories. Amex gives 30 days for lodging and vehicle rental only. Discover gives 30 days and includes **passenger railway** and passenger transportation. Check `capture_before` and `extended_authorization.status` on the Charge. Networks often allow extended windows only when the final amount is unknown at authorization. — [Stripe: Extended authorization](https://docs.stripe.com/payments/extended-authorization.md?platform=web&ui=elements)
- Checkout Session `expires_at` ranges from 30 min to 24 h after creation. — [Stripe API: Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- With Checkout Sessions, `checkout.session.expired` is part of the lifecycle webhooks. Payment Intents don't expire automatically. — [Stripe comparison](https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison)

### Inferences
- **Option A: authorize first, then book.** This is recommended when operators allow book-and-confirm in one step. The 7-day authorization dwarfs any booking latency, so expiry risk is essentially zero if capture or cancel happens within minutes. Still run a reconciliation job that cancels any `requires_capture` PaymentIntent older than about 1 hour without a terminal order state, so funds aren't held for days.
- **Option B: hold, then pay, then confirm.** Use this when operators require a provisional reservation that expires after a TTL. Create the holds, then create the Checkout Session with `expires_at = max(30 min, min(hold_expiry))`. Because 30 min is the floor, a hold under 30 min can't be matched by Session expiry. Enforce your own deadline instead: reject the confirm server-side, or cancel the PaymentIntent if authorization arrives after the earliest hold has expired, then re-hold and re-price. With Elements and PaymentIntents you control the timing directly.
- 3DS challenges can take minutes. Leave a buffer of at least 5 to 10 min between the expected end of authorization and the shortest operator TTL.
- Extended or incremental authorization are only relevant if the product adds deferred ticketing (for example, booking horizons that open later). Otherwise skip them; both need IC+.

### Gaps
- I didn't find real operator hold TTLs (SNCF/Trainline/DB/ÖBB/Eurostar APIs) in this scope; another researcher may cover them.
- It's unclear whether network rules on extended authorization allow a rail reseller to hold for deferred ticket release when the amount is already known. The Stripe docs say "for many networks extended validity windows are only for cases where you don't know the final amount."

## Q3. Minimal security and compliance checklist for production (SCA, PCI, keys, Radar, disputes)

### Takeaway
Stay in PCI SAQ A by using Checkout or the Payment Element (Stripe-hosted iframes), and keep script-attack protections on the pages that host them. Since 2025, SAQ A eligibility depends on that. Let PaymentIntents and Checkout handle SCA and 3DS. Use restricted keys from a vault, restricted to your servers' IPs, and rotate them. Recompute every amount on the server. Harden the webhook endpoint (signature, tolerance, dedup, IP allowlist). Add Radar 3DS and review rules tuned for travel fraud.

### Cited Findings

**PCI DSS**
- Checkout and Elements (Payment Element) put all card fields in an iframe loaded from a Stripe domain, which means **SAQ A**. Direct API card collection means **SAQ D**, with more than 300 controls. Stripe.js v2 on your own form means SAQ A-EP. Stripe offers prefilled SAQs through its PCI wizard. — [Stripe: PCI compliance guide](https://stripe.com/guides/pci-compliance); [Stripe: Integration security guide](https://docs.stripe.com/security/guide)
- Stripe is a PCI Level 1 Service Provider. Merchants must attest compliance every year. You can store the brand, last4 and expiry Stripe returns, "and anything returned by our API". — [Stripe: Integration security guide](https://docs.stripe.com/security/guide)
- SAQ A r1 (January 2025, PCI DSS v4.0.1) removed requirements 6.4.3, 11.6.1 and 12.3.1 as line items. It added an eligibility criterion that the merchant confirms its site is not susceptible to attacks from scripts that could affect its e-commerce systems. — [PCI SSC blog](https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a); [PCI SSC FAQ 1588](https://www.pcisecuritystandards.org/faqs/1588/)
- Vendors disagree on the scope of that criterion (the whole site or only the page that embeds the iframe). — [Akamai](https://www.akamai.com/blog/security/pci-dss-v4-0-1-changes-qualify-saq-a) vs [Compass IT](https://www.compassitc.com/blog/saq-a-requirements-6.4.3-11.6.1-what-the-eligibility-change-means). Implementing 6.4.3 and 11.6.1 anyway is one way to meet it. — [TrustedSec](https://trustedsec.com/blog/the-hidden-trap-in-the-pci-dss-saq-a-changes)
- Use TLS 1.2+ on payment pages and avoid mixed content. Keep third-party JS on payment pages to a minimum. CSP directives for Stripe.js: `script-src https://js.stripe.com https://*.js.stripe.com`, `frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com` (hooks.stripe.com is needed for 3DS), `connect-src https://api.stripe.com`. For Checkout: `checkout.stripe.com` in connect-src, frame-src and script-src. Stripe doesn't support cross-origin isolated sites. — [Stripe: Integration security guide](https://docs.stripe.com/security/guide)

**SCA / 3DS (PSD2)**
- SCA applies if the business is in the EEA (or creates payments on behalf of EEA connected accounts), serves EEA customers and accepts cards. The legacy Charges API isn't SCA-ready. PaymentIntents and Checkout handle 3DS. — [Stripe: SCA](https://docs.stripe.com/strong-customer-authentication)
- Exemptions:
  - Low value: under €30 or £25, until 5 consecutive exemptions or more than €100 (£85) cumulative. The issuer decides.
  - Transaction Risk Analysis: requested by the PSP, decided by the issuer. Available up to €100 if the PSP's fraud rate is under 0.13%, up to €250 under 0.06%, up to €500 under 0.01%.
  - MIT is out of scope, but needs an initial authentication and a mandate.
  - Trusted beneficiaries; secure corporate cards.
  - One-leg-out transactions and MOTO are out of scope. — [Stripe: SCA guide](https://stripe.com/guides/strong-customer-authentication)
- Liability: a successful 3DS or frictionless 3DS puts liability on the issuer. When an exemption is applied, or a payment goes straight to authorization, the merchant is liable. — [Stripe: SCA guide](https://stripe.com/guides/strong-customer-authentication); [Stripe: SCA docs](https://docs.stripe.com/strong-customer-authentication)
- MIT and off-session use need a mandate covering the customer's permission, frequency and how the amount is determined. Off-session payments carry no liability shift. — [Stripe: SCA docs](https://docs.stripe.com/strong-customer-authentication); [Stripe: Incremental authorization](https://docs.stripe.com/payments/incremental-authorization.md?platform=web&ui=elements)

**Radar**
- Default rules: block at `:risk_level: = 'highest'` and review at `'elevated'`. Custom rules require a plan that supports them (Radar for Fraud Teams). There are Request 3DS, Block, Review and Allow rules, and allow rules need you to contact Stripe. Request 3DS rules run before the others and apply only to Checkout, PaymentIntents and SetupIntents. You can have at most 200 transaction rules. Rules can use metadata (`::key::`) and lists (`@list`). Traffic allocation allows shadow (0%) or gradual rollout. — [Stripe: Radar rules](https://docs.stripe.com/radar/rules)
- Example rules from the docs: `Request 3D Secure if :risk_level: != 'normal' and :amount_in_usd: > 25`; `Request 3D Secure if is_missing(:seconds_since_card_first_seen:)`; `Block if :is_3d_secure: and not :is_3d_secure_authenticated:`; `Review if :is_disposable_email: and :card_funding: = 'prepaid'`. — [Stripe: Radar rules](https://docs.stripe.com/radar/rules)
- EU geo-blocking regulation: blocking payments based on the customer's EU member state may be prohibited. — [Stripe: Radar rules](https://docs.stripe.com/radar/rules)

**Secret keys**
- Never put keys in source code or apps. Use a vault (or sensitive environment variables) and restricted API keys with least privilege. Rotate periodically and rehearse the rotation. Restrict keys to your egress IPs, and optionally block by ASN or country. Scan for secrets and use a pre-commit hook. Audit request logs. Rotate immediately on any exposure. "Stripe never asks you for your secret API key." — [Stripe: Keys best practices](https://docs.stripe.com/keys-best-practices)

**Disputes and travel risk**
- For destination charges and separate charges and transfers (with or without `on_behalf_of`), the platform balance is debited for disputes and dispute fees. The platform can try to recover the money by reversing the transfer. — [Stripe: Connect charges](https://docs.stripe.com/connect/charges)
- Extended holds and multicapture both raise the risk of unrecognized-charge disputes. Use clear statement descriptors and notify customers of each charge. — [Stripe: Extended authorization](https://docs.stripe.com/payments/extended-authorization.md?platform=web&ui=elements); [Stripe: Multicapture](https://docs.stripe.com/payments/multicapture.md?platform=web&ui=elements)

### Inferences
- **Minimal production checklist:**
  1. Use Checkout (hosted or embedded) or the Payment Element only, never raw PAN fields. Load Stripe.js from js.stripe.com, never self-hosted. Set a strict CSP with an SRI or script inventory on checkout pages to back the SAQ A script-attack criterion.
  2. The server builds the amount from its own stored offer and order (minor-unit integers). The client sends only `order_id`. Verify `amount` and `currency` again in the webhook before capture. This matches the project convention that "the frontend never computes prices".
  3. Use a restricted key with only the PaymentIntents, Checkout Sessions, Refunds and Events write/read permissions needed. Keep it in a vault, IP-restricted, with separate keys for test and live. Keep the publishable key only in the browser.
  4. Webhook: raw body, `construct_event` with the tolerance left at its default (at least 300 s, never 0), an `event_id` unique table, an async worker, re-fetching objects, a 2xx on duplicates, the route exempt from CSRF but still IP-allowlisted, a dedicated path, and periodic secret rolls.
  5. Send an idempotency key on every POST, derived from `order_id` plus the action (never from PII).
  6. CORS: allow only your web origin on `/api/*`. Don't allow `*` with credentials. Authenticate order and session-creation endpoints (session or CSRF token if you use cookie auth), and rate-limit session creation (Stripe explicitly asks for "limits on repeated creation"), which also defends against card-testing.
  7. Radar: request 3DS for new cards, elevated risk and high amounts. Review mismatches between `:ip_country:` and `:card_country:` combined with elevated risk. Watch for same-day departures and last-minute high-value purchases (a common travel-fraud pattern; inferred, no Stripe source fetched). Pass passenger and departure-date metadata (`::departure_hours::`) so rules can use it.
  8. Disputes: keep the ticket PNR, passenger names, the T&C acceptance timestamp, IP address and usage or scan evidence where operators provide it. Set the statement descriptor to the brand name plus "RAIL".
  9. Never log full Stripe objects that hold client_secrets. Treat `client_secret` as per-session sensitive data.

### Gaps
- I haven't read the official PCI SSC SAQ A r1 PDF or FAQ 1588 text directly, so the exact eligibility wording is unconfirmed (vendor summaries disagree).
- Stripe's travel-specific dispute guidance and the Radar attribute list (`/radar/rules/supported-attributes`) were not fetched.
- I found no Stripe source on travel-specific fraud patterns such as last-minute bookings or third-party bookings.

## Q4. Merchant model: merchant of record vs Stripe Connect, restricted business status, reserves and payouts

### Takeaway
Two workable models:
- **(A) Merchant of record / reseller.** The platform buys tickets from operators (on net-rate or agency-wholesale terms) and sells them in its own name: one Stripe account, plain PaymentIntents, operators paid outside Stripe. This is the simplest option and avoids the PSD2 "collecting on behalf of" problem.
- **(B) Connect marketplace.** Operators or agencies are connected accounts. Use **separate charges and transfers** with `transfer_group=order_id`, because one charge funds several operators. Note this conflicts with multicapture plus `source_transaction`.

Expect Stripe to treat "travel reservation services" as a restricted category that needs extra due diligence, and possibly to apply fixed or rolling reserves for future-dated travel.

### Cited Findings
- Charge types:
  - **Direct charges**: one connected account per transaction; the connected account bears refunds and chargebacks.
  - **Destination charges**: one connected account per transaction; the charge is on the platform; the platform bears refunds and chargebacks; fees come out of the platform balance.
  - **Separate charges and transfers**: "Individual transactions can involve multiple connected accounts", and the charge can be created "before knowing the connected account". The platform bears fees, refunds and chargebacks. — [Stripe: Connect charges](https://docs.stripe.com/connect/charges)
- `on_behalf_of` makes the connected account the business of record. The charge settles in its country, its fee structure and statement descriptor apply, and its address appears on the statement when the countries differ. Cross-region destination charges and separate charges and transfers are limited to certain regions unless `on_behalf_of` is used. — [Stripe: Connect charges](https://docs.stripe.com/connect/charges)
- Direct charges aren't recommended for legacy v1 Express and Custom accounts; Stripe points to v2 accounts. For legacy Express and Custom accounts the platform is responsible for disputes and fraud. — [Stripe: Connect charges](https://docs.stripe.com/connect/charges)
- Stripe's restricted list puts "Reserveringsdiensten voor reizen en clubs" (travel and club reservation services) under businesses that need extra due diligence. Commercial airlines and cruises are **prohibited**. Approval can be changed or withdrawn. The page has no rail-specific entry. — [Stripe: Restricted businesses](https://stripe.com/legal/restricted-businesses)
- Reserves exist to cover future refunds and disputes. They are **fixed** or **rolling**. — [Stripe Support: Reserves FAQ](https://support.stripe.com/questions/reserves-frequently-asked-questions?locale=en-GB)
- Connect's reserve guidance names travel and lodging reservations refundable until a given date as a case for a fixed reserve released at fulfilment or the end of the refund window. Risk factors include industries with "extended delivery times or high loss rates (for example, event ticketing, travel & lodging…)". Connected-account reserves can last at most 180 days. — [Stripe: Connected account reserves](https://docs.stripe.com/connect/connected-account-reserves)

### Inferences
- For a hackathon MVP or the first live phase, model **A** (merchant of record, single account) is the pragmatic choice. It needs operator distribution contracts (resale or agency agreements) under which the platform invoices the customer. Stripe Tax and Checkout then work out of the box.
- If you choose Connect: separate charges and transfers with `transfer_group=order_id`. After capture, `POST /v1/transfers` per confirmed leg with `destination=acct_operator`, `amount=leg_net`, `transfer_group`, and `source_transaction=ch_…` so the transfer waits for the funds. That rules out multicapture, which is fine with a single partial capture. The platform keeps the margin and bears refunds and disputes. Reverse transfers on refunds.
- Cash-flow risk: under model A the platform owes operators whatever the payout timing. A Stripe rolling reserve on future-dated travel could hold a share of receipts until the travel date while operator invoices are due earlier. Negotiate payout and reserve terms during onboarding.
- Delayed-delivery risk is lower for rail than for package travel, because tickets are typically issued immediately. Emphasise instant ticket issuance in the Stripe onboarding risk description.

### Gaps
- I didn't fetch Stripe's standard EU payout schedule (T+N days for new accounts) or the 2026 Accounts v2 Connect terms.
- I found no official statement of Stripe's typical reserve percentages for travel merchants. Third-party figures exist but are unverified.
- Stripe Tax handling for passenger transport (whether it's a supported tax code and how distance-proportional place of supply is handled) wasn't researched.

## Q5. Regulatory: PSD2 commercial agent exclusion, payment institution licensing, Package Travel Directive, VAT basics

### Takeaway
Collecting a customer's money and then passing it to several operators is a payment service unless an exclusion applies. The PSD2 Art. 3(b) commercial agent exclusion only covers an agent acting for **only the payer or only the payee** with real authority to negotiate or conclude the sale. The EBA and Commission say a platform that receives funds for the payee is **not excluded by default**. The upcoming PSR tightens this further. Two clean options:
- **(i)** Be the merchant of record: buy and resell tickets, so you collect your own revenue.
- **(ii)** Use Stripe Connect, where Stripe (a licensed institution) does the funds flow to operators' accounts.

Selling only rail legs (carriage of passengers combined only with more carriage) is generally **not** a package under the PTD. Bundling hotels, car rental or tourist services could create a package or linked travel arrangement, which brings insolvency protection duties.

### Cited Findings
- EBA Q&A 2020_5354 (published 03/12/2021), Commission answer: an e-commerce platform that receives payment on behalf of the payee, where that receipt settles the payer's debt, "is not to be excluded by default from the scope of PSD2". Settling the debt is not in itself a reason for exclusion. The exclusion covers agents acting "on behalf of only the payer or only the payee" who are authorised to negotiate or conclude the sale. — [EBA Q&A 2020_5354](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5354)
- PSR/PSD3: political agreement in November 2025. Compromise text of 17 April 2026 keeps the exclusion only where the agent acts for one side under a genuine mandate, with cumulative conditions. The EBA must issue guidelines and RTS on the exclusion within one year of entry into force. Not yet in the Official Journal according to the commentary found. — [psd3psr.nl](https://psd3psr.nl/en/marketplaces-payment-models.html); [Legal500 / PwC](https://www.legal500.com/intelligence/european-union/finance-and-banking/the-psr-and-psd3-move-forward-what-the-eus-new-payments-framework-means-for-regulated-firms); [PwC client alert Apr 2026](https://legal.pwc.de/content/services/regcore-client-alert/pwc-client-alert-eus-new-payments-framework-april-2026.pdf)
- EBA's 2022 response on the PSD2 review discussed the commercial agent exclusion. — [EBA Opinion EBA-Op-2022-06](https://www.eba.europa.eu/sites/default/files/document_library/Publications/Opinions/2022/Opinion%20od%20PSD2%20review%20(EBA-Op-2022-06)/1036016/EBA's%20response%20to%20the%20Call%20for%20advice%20on%20the%20review%20of%20PSD2.pdf) (not read in full)
- VAT: under Art. 48 of the VAT Directive 2006/112/EC, passenger transport is supplied "where the transport takes place, proportionate to the distances covered". International rail is therefore split by Member State, and treatment varies, with some states taxing international rail. — [legislation.gov.uk copy of Art. 48](https://www.legislation.gov.uk/eudr/2006/112/article/48/data.html); [CER position paper (industry advocacy)](https://cer.be/images/publications/positions/260504_CER_Position_Paper_VAT.pdf)
- On-board catering is taxed at the place of departure (Art. 57). — [EC: place of taxation](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/place-taxation_en)
- Package Travel Directive (EU) 2015/2302, from the directive text but **not re-fetched this session** because the EUR-Lex page failed to render through the tool:
  - Art. 3(1) defines four "travel service" types: (a) carriage of passengers, (b) accommodation, (c) car or motorcycle rental, (d) other tourist services.
  - A "package" combines **at least two different types** of travel service. A "linked travel arrangement" is defined in Art. 3(5).
  - Insolvency protection: Art. 17 (packages) and Art. 19 (linked travel arrangements). — [EUR-Lex 32015L2302](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32015L2302)

### Inferences
- Multi-leg rail only (rail plus rail, rail plus coach) combines a single travel-service type (carriage of passengers), so it falls outside "package" and "linked travel arrangement". Passenger-rights rules (Rail Passenger Rights Regulation (EU) 2021/782, through-ticketing) may still apply but weren't researched here. Adding a hotel or a city pass in the same flow could create a package (one contract or one payment) or a linked travel arrangement (facilitated separate contracts). That brings insolvency protection, a security bond or insurance, for the money collected.
- Licensing: under model A (MoR / reseller), the platform sells its own service and the money it receives is its own revenue, so it isn't a payment service. Under an "agent collecting for N operators" model, the platform acts for several payees and arguably for the payer too, so the Art. 3(b) exclusion is doubtful (EBA Q&A) and the PSR will narrow it further. Stripe Connect moves funds through Stripe's licence into connected accounts, which is the usual way marketplaces avoid needing their own payment-institution licence. Confirm with counsel; this is inferred, not legal advice.
- VAT: as MoR, the platform may have to account for VAT on the resale, or use the margin scheme, or act as a disclosed agent, depending on contract structure and state. The multi-country split under Art. 48 makes Stripe Tax's automatic calculation likely insufficient for international legs. Needs a tax adviser.
- Currencies EUR, GBP, CHF and CZK: price in the currency the operator quotes, or convert server-side with a locked quote. Amounts are in minor units (all four currencies have 2 decimals; standard ISO 4217, Stripe currency page not fetched). Adaptive Pricing (Checkout Sessions only) can localise prices but changes the settlement and FX picture.

### Gaps
- I didn't retrieve the EUR-Lex text of PSD2 Art. 3(b) or PTD Arts. 3, 17 and 19 verbatim because the pages wouldn't render through the fetch tool.
- I didn't verify the final PSR text or its Official Journal publication status (commentary says it's pending).
- I found no authoritative per-country table of VAT on international rail (exempt, zero-rated or taxed). The EU-level exemption options, such as the Art. 371 / Annex X derogations, weren't researched.
- I didn't check whether Stripe Tax supports a passenger-transport tax code with distance apportionment.
- I didn't check whether Stripe's onboarding for "travel reservation services" asks for evidence of PTD insolvency protection.
