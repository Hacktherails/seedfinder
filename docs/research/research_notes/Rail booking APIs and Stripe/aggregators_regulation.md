# Rail distribution aggregators and EU regulation on third-party ticket selling (as of 21 Nov 2026)

Scope note: about 15 tool calls. Trainline Partner Solutions, Distribusion, Omio, SilverRail/Rail Europe and the EU
legal framework are covered with sources. Bileto, Lyko, 12Go, Bookaway, Rail.Ninja, Trip.com, Railbookers, Hacon and
Amadeus/Sabre were **not researched in depth** (see Gaps). Items marked "[background, not re-verified this session]"
come from prior knowledge of the legal texts and should be checked against the EUR-Lex link before anyone relies on them.

## Which aggregator is the most realistic for a hackathon / early-stage startup (sandbox, public docs)?

### Takeaway
Distribusion is the most practical: it has public API docs (search, reservations, bookings with tickets,
cancellations, markup and booking-fee pages, a demo environment), and demo keys come from an email to a partnership
manager. Trainline Partner Solutions has the deepest European rail content (refunds, exchanges, delay info), but it is
sold to large travel sellers, has no public sandbox and takes about 12 weeks to integrate. Neither publishes its
commercial terms, and every serious option needs a signed B2B agreement. For a hackathon demo, the realistic path is
mock data or Distribusion's demo environment, not live ticketing.

### Cited Findings
**Distribusion**
- Retailer API gives online channels access to intercity bus, rail, ferry and airport-transfer inventory that is "fully standardised". The docs sidebar lists connection search, reservations (create/confirm/cancel), bookings with tickets and cancellations — [Distribusion docs intro](https://docs.distribusion.com/dt/api/getting-started/intro)
- Demo API keys and inventory overviews are requested by emailing partner@distribusion.com, and a Partnership Manager handles onboarding. The docs include a "Demo Environment" page — [Distribusion docs intro](https://docs.distribusion.com/dt/api/getting-started/intro)
- The docs have "Markup Fees" and "Booking Fees" pages, which suggests the retailer can add its own markup or fees on top of carrier prices. Their contents were not retrieved — [Distribusion docs intro](https://docs.distribusion.com/dt/api/getting-started/intro)
- Changelog: a new "Offers" flow (14 May 2026) uses a persistent `offer_id` from `/connections/find` through `/connections/vacancy` and `/reservations/create`, enabled per account by the Partnership Manager. Carrier-specific passenger fields can be read from `/marketing_carriers/{id}/booking/schema` (9 May 2025). Deutsche Bahn is named as a carrier (19 Mar 2025) — [Distribusion What's New](https://docs.distribusion.com/dt/api/what-s-new)
- The docs also cover carrier accreditation (the supply side) — [Distribusion carrier accreditation](https://docs.distribusion.com/dt/api/getting-started/accreditation/carrier-accreditation)
- Its rail page claims "the world's largest selection of rail carriers" but the text names none (vendor claim, not verified) — [Distribusion rail solutions](https://www.distribusion.com/de/rail-solutions)

**Trainline Partner Solutions (TPS) – Global API**
- Wholesale rail and coach API sold to travel sellers, online booking tools and large travel brands. It claims 44.8k+ stations, 1.8bn+ unique routes and 600 searches/second; booking in 10 currencies by card or "on account"; refunds and exchanges as aftersales; cancellations within an hour; change of journey; real-time delay and disruption info; seat maps; discount cards; SplitSave (UK). Average integration time is 12 weeks. The page mentions no sandbox, no commercial terms and no merchant-of-record details — [TPS Global API](https://tps.thetrainline.com/our-products/global-api/)
- About 270 carriers via the Global API — [Trainline Global API page](https://www.thetrainline.com/solutions/api)
- Partner fees and commission are listed as "Negotiable" — [Trainline partnerships](https://www.thetrainline.com/about-us/partnerships)
- B2B partners pay "a commission and/or transaction fee on ticket sales, as well as other related technology service fees" — [Trainline Group business model](https://www.trainlinegroup.com/what-we-do/business-model)
- Integrators include Amadeus Cytric and Spotnana, which are large corporate-travel platforms — [Amadeus press release](https://amadeus.com/en/newsroom/press-releases/amadeus-cytric-new-trainline-partnership); [BTN Europe on Spotnana](https://www.businesstravelnewseurope.com/Ground-Transport/Spotnana-expands-European-rail-content-with-new-Trainline-integration)
- The consumer affiliate programme is separate (commission at Partnerize network rates). It is a referral link, not an API resale — [Trainline affiliates](https://www.thetrainline.com/about-us/partnerships/affiliates)

**Omio**
- Omio B2B offers a Booking API, a Meta Search API and white label. Partners named in search snippets include Uber, Kayak, Google, Iryo Conecta and LNER. The page returned HTTP 403 when fetched directly, so this is from the search snippet only — [Omio B2B](https://omio.com/corporate/omio-b2b/)
- White-label network partners include TUI and easytrain — [Omio press: TUI](https://www.omio.co.uk/corporate/newsroom/press-releases/omio-expands-white-label-network-with-new-tui-partnership/); [Omio press: easytrain](https://www.omio.co.uk/corporate/newsroom/press-releases/easytrain-joins-omios-white-label-network/)
- One commentary says Omio's API "does lack some of the key functionality that B2B are seeking" (opinion, secondary source) — [AltexSoft rail booking APIs](https://www.altexsoft.com/blog/rail-booking-apis)

**SilverRail / Rail Europe / Rail Online**
- SilverCore consolidates rail sales into a B2B platform that standardises live data and provides inventory, schedules and prices via an API — [Railway Technology feature](https://www.railway-technology.com/features/selling-rail-can-silverrail-improve-industrys-online-offering/)
- 2017: SilverRail became the connectivity and transaction-processing layer for Rail Europe's fares and seat inventory, B2C and B2B (old, 2017) — [BTN Europe](https://www.businesstravelnewseurope.com/Technology/Silverrail-partners-with-Rail-Europe)
- SilverRail signed to sell Deutsche Bahn globally (older article, date not confirmed) — [PhocusWire](https://www.phocuswire.com/article/silverrail-to-sell-deutsche-bahn-rail-globally/)
- Rail Europe has a B2B technology growth plan, and 56% of its business came from the UK trade — [Travel Market Report](https://travelmarketreport.com/retail-strategies/articles/new-b2b-technology-part-of-rail-europes-growth-plans)

**Others**
- Travelfusion: you must contract each railway separately. Travelfusion is the technology channel only and does not handle financial settlement (secondary source) — [AltexSoft (Medium)](https://altexsoft.medium.com/rail-booking-apis-how-to-sell-train-tickets-from-gdss-tech-providers-and-global-railway-carriers-fd191c5e5432)
- Sabre covers nine major European and North American rail networks via REST APIs. Travelport combines rail with air (secondary source, undated) — [AltexSoft (Medium)](https://altexsoft.medium.com/rail-booking-apis-how-to-sell-train-tickets-from-gdss-tech-providers-and-global-railway-carriers-fd191c5e5432)
- Kombo describes itself as a multimodal comparison and booking platform that earns commission from carrier partners. No B2B API was found — [Kombo llms.txt](https://www.kombo.co/llms.txt)

### Inferences
- Merchant of record: no provider page confirmed who is MoR. Trainline's "on account" booking and its commission model suggest Trainline collects payment or invoices the partner, rather than the startup charging the passenger directly for the carrier. This matters for a Stripe flow, because the startup may only be able to charge its own fee via Stripe, or must settle net with the aggregator.
- Distribusion's markup/booking-fee features fit a model where the startup charges the customer (for example via Stripe) and settles with Distribusion. This needs confirming from the markup page and the contract.
- Every provider found is gated behind a partnership manager or sales. None offers self-serve keys like Stripe. For a 24-hour hackathon, demo with a mock or the sandbox and present the aggregator integration as the go-to-market plan.

### Gaps
- No data was retrieved for Bileto, Lyko, 12Go, Bookaway, Rail.Ninja, Trip.com rail, Railbookers, Hacon/Siemens booking, or Amadeus rail and Sabre rail beyond one secondary line. Ticketless/Rail Online was found only as an Australian agent platform.
- No provider publishes deposit, credit-line, KYC or minimum-volume requirements. Contents of Distribusion's markup, booking-fee and demo-environment pages were not fetched.
- Hold or provisional booking: Distribusion separates reservation create and confirm, which implies a hold step. Hold duration and Trainline hold support were not found.

## Typical economics: commission % or margin available to a reseller in rail

### Takeaway
No source in this session published a reseller commission rate for European rail APIs. Trainline lists terms as
"negotiable", and the industry model is commission and/or transaction fee plus tech fees, or net fares plus the
reseller's own markup and booking fee. The only concrete figure found is a 7% launch commission on Eurail Passes for
Australian agents, which is not representative of point-to-point rail.

### Cited Findings
- Trainline partner fees and commission: "Negotiable" — [Trainline partnerships](https://www.thetrainline.com/about-us/partnerships)
- B2B model: commission and/or transaction fee on ticket sales plus technology service fees — [Trainline Group](https://www.trainlinegroup.com/what-we-do/business-model)
- Rail Online (SilverRail-powered, Australia) offered point-to-point fares at net rates and a 7% launch commission on Eurail Passes — [Travel Weekly AU](https://travelweekly.com.au/new-online-platform-makes-booking-rail-journeys-easier-for-agents/)
- Distribusion docs include markup-fee and booking-fee configuration — [Distribusion docs](https://docs.distribusion.com/dt/api/getting-started/intro)
- The EU rail ticketing proposal targets "unreasonable fees on third-party online ticket sellers" and requires fair, reasonable and non-discriminatory remuneration terms. That implies thin or negative margins for third-party vendors are a recognised problem today — [EC news 13 May 2026](https://transport.ec.europa.eu/news-events/news/one-journey-one-ticket-full-rights-commission-simplifies-europe-wide-travel-booking-and-train-travel-2026-05-13_en); [Council doc ST-9348-2026](https://data.consilium.europa.eu/doc/document/ST-9348-2026-INIT/en/pdf)

### Inferences
- With an aggregator in the middle, the startup's margin is whatever the aggregator passes through, plus any booking fee or markup it adds. Plan for revenue from a customer-facing booking fee (charged via Stripe) rather than relying on carrier commission.

### Gaps
- No verified percentage for operator-to-vendor commission in European rail. No figures for Trainline, Omio, Distribusion or Rail Europe were found. Sell-side terms need direct contact with the providers.

## What concrete legal rights does a third-party seller have today to obtain an operator's content and sell it?

### Takeaway
Today (Nov 2026) a third-party seller has **no general EU right to sell an operator's tickets**. Distribution remains
"subject to contractual provisions". The binding rights are about **data**: timetable, connection times and conditions
of carriage must be public and free via National Access Points; tariff data is shared on a contractual basis; and the
TEL TSI requires standardised booking interfaces (OSDM is one option) for availability, reservation and cancellation
by 10 June 2029. A real access right is still only proposed: the 13 May 2026 Rail Ticketing Regulation (COM(2026) 232)
and the Multimodal Booking Regulation (COM(2026) 231, the successor to the MDMS/SDBT initiative). Both are in Council
working-party negotiation and **not adopted**.

### Cited Findings
**Rail Passengers' Rights Regulation (EU) 2021/782** [background, not re-verified this session]
- Applies from 7 June 2023 (some provisions later, with national exemptions possible). Art. 12 covers through-tickets: a railway undertaking, or undertakings belonging to the same group, must offer through-tickets for its own services, and others shall "endeavour" to. A ticket vendor that sells separate tickets as a bundle must inform the passenger before purchase that they are not a through-ticket. If it fails to do so, the vendor must reimburse and pay compensation of 75% of the amount (Art. 12(5)). Art. 10 obliges RUs to give ticket vendors non-discriminatory access to travel information, but not to tickets — [EUR-Lex 2021/782](https://eur-lex.europa.eu/eli/reg/2021/782/oj)
- 13 May 2026: the Commission adopted an implementation report on 2021/782 (progress since June 2023) and proposed amendments (COM(2026) 233) so that passengers holding a single ticket for a multi-operator rail journey get full rights (assistance, rerouting, reimbursement, compensation) on a missed connection — [EC news 13 May 2026](https://transport.ec.europa.eu/news-events/news/one-journey-one-ticket-full-rights-commission-simplifies-europe-wide-travel-booking-and-train-travel-2026-05-13_en); [Euroconsumers response](https://www.euroconsumers.org/wp-content/uploads/2026/08/Euroconsumers-response-to-the-consultation-on-the-proposed-Rail-Ticketing-Regulation.pdf)

**TEL TSI (Commission Implementing Regulation (EU) 2026/253)**, in force since 2 March 2026 and replacing TAP TSI 454/2011
- Data that must be public and free via NAPs (NeTEx): planned timetable, minimum connection times, accessibility and train composition. Real-time data goes out in SIRI under CC BY-SA 4.0. **Tariff data** goes out in NeTEx "on a contractual basis" (CC BY-ND 4.0) — [EC presentation, TTG 2026](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf)
- Ticketing roles are distributor, issuer and retailer. The process is "subject to contractual provisions" and uses interoperable Transmodel-based APIs compliant with ERA TD B.5 (TAP legacy, OSDM, OMSA). "Retailer functions (e.g. selling the ticket) not standardised" — [EC presentation](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf)
- Through NAPs and IM one-stop shops, IMs must publish timetable data free of charge (art 6) — [ERA: Understanding the new Telematics TSI](https://www.era.europa.eu/understanding-new-telematics-tsi)

**Proposed Rail Ticketing Regulation, COM(2026) 232** (13 May 2026, not adopted)
- Aims to let passengers buy services from several rail operators as one ticket, in a single transaction, on a platform of their choice (independent or operator-run). Operators and platforms must be able to reach "fair, reasonable and non-discriminatory commercial agreements" — [EC news](https://transport.ec.europa.eu/news-events/news/one-journey-one-ticket-full-rights-commission-simplifies-europe-wide-travel-booking-and-train-travel-2026-05-13_en)
- Targets incumbents' favouring of direct channels, restricted access to content and data, and unreasonable fees on third-party online ticket sellers. Operators with ≥50% of a national market would have to display and sell rival domestic services on request — [Lawyer Monthly, May 2026](https://www.lawyer-monthly.com/2026/05/eu-rail-booking-rules-could-require-operators-to-display-competing-services/); [Council ST-9348-2026](https://data.consilium.europa.eu/doc/document/ST-9348-2026-INIT/en/pdf)
- The Parliament summary describes incumbents as gatekeepers that own dominant ticketing platforms and share data selectively — [OEIL summary 1901771](https://oeil.europarl.europa.eu/oeil/en/document-summary?id=1901771)
- The Council first Presidency compromise says online ticketing service providers should be able to sell and combine rail products on non-discriminatory terms, and includes a passage on remuneration of third-party vendors by RUs. No commission cap was found in the snippets — [Council ST-13398-2026](https://data.consilium.europa.eu/doc/document/ST-13398-2026-INIT/en/pdf)
- The public consultation (feedback) closed 31 July 2026 — [Digital Policy Alert](https://digitalpolicyalert.org/change/19759-regulation-on-rail-ticketing-including-obligations-on-online-ticketing-platforms-to-host-products-on-non-discriminatory-terms-com-2026-232)
- CER (railways) called it excessive market intervention. EU Travel Tech (Booking, Expedia) said it falls short — [Lawyer Monthly](https://www.lawyer-monthly.com/2026/05/eu-rail-booking-rules-could-require-operators-to-display-competing-services/); [Agence Europe](https://agenceurope.eu/en/bulletin/article/13868/2/one-journey-one-ticket-european-commission-proposes-new-obligations-for-rail-operators-and-distribution-platforms)

**Proposed Multimodal Booking Regulation, COM(2026) 231, procedure 2026/0113(COD)** (the former "MDMS" initiative; repeals CRS Reg 80/2009)
- Covers B2C and B2B MDMS that offer booking. Urban-only transport, search engines and SMEs are excluded. "Indispensable" B2C MDMS and all B2B MDMS must not use exclusivity clauses, must protect commercially sensitive data, and must set remuneration on FRAND terms. Display must be neutral, with offers sorted by GHG emissions where feasible — [OEIL 2026/0113 summary](https://oeil.europarl.europa.eu/oeil/en/document-summary?id=1901774); [Commission proposal PDF](https://transport.ec.europa.eu/document/download/17596ca2-fad5-467e-b71a-c490baf0bcd1_en?filename=Proposal_on_multimodal_booking.pdf); [EC news](https://transport.ec.europa.eu/news-events/news/one-journey-one-ticket-full-rights-commission-simplifies-europe-wide-travel-booking-and-train-travel-2026-05-13_en)
- Status: Council Presidency compromise texts and comments dated 25–30 Sep 2026. No Council general approach, Parliament position or trilogue deal was found as of 21 Nov 2026 — [Council WK-14945-2026](https://data.consilium.europa.eu/doc/document/WK-14945-2026-INIT/en/pdf); [Council ST-13061-2026](https://data.consilium.europa.eu/doc/document/ST-13061-2026-INIT/en/pdf); [EPRS briefing](https://research.europarl.europa.eu/EPRS_BRI(2026)789383)

**ITS Directive / MMTIS** [background, not re-verified this session]
- Revised ITS Directive (EU) 2023/2661, and MMTIS Delegated Regulation (EU) 2017/1926 as amended by Delegated Reg (EU) 2024/490: transport data (static, then dynamic) must be shared via National Access Points in standard formats (NeTEx/SIRI), with phased deadlines to 2028. This is data access, not ticket resale — [EUR-Lex ITS Directive 2010/40 consolidated](https://eur-lex.europa.eu/eli/dir/2010/40/oj). The Commission urged Member States on 13 May 2026 to speed up NAP implementation — [EC news](https://transport.ec.europa.eu/news-events/news/one-journey-one-ticket-full-rights-commission-simplifies-europe-wide-travel-booking-and-train-travel-2026-05-13_en)

**Package Travel Directive (EU) 2015/2302** [background, not re-verified this session]
- Combining transport with accommodation (for example rail plus hotel) sold by one trader can form a "package" (full organiser liability and insolvency protection). Facilitating separate bookings via linked click-through within 24h can form a "linked travel arrangement" (insolvency protection for the money received plus an information duty). Rail-only multi-leg bookings without accommodation or another travel service are not a package (passenger transport alone is one "travel service"; combinations of the same type are not packages) — [EUR-Lex 2015/2302](https://eur-lex.europa.eu/eli/dir/2015/2302/oj)

### Inferences
- A startup today depends on bilateral contracts, directly with RUs or via an aggregator that already holds them. The 2026 proposals would turn this into a FRAND access right, but not before adoption (2027 at the earliest) plus an application period.
- If the startup sells separate tickets as one combined journey, Art. 12 of 2021/782 already applies. Clear "not a through-ticket" disclosure before payment is mandatory, otherwise the startup is liable for the reimbursement plus 75% compensation.
- Adding hotels to the flow pulls the startup into PTD package or LTA obligations, including insolvency protection, which is a significant compliance cost.

### Gaps
- Exact article numbers, market-share threshold wording and any commission or remuneration cap in COM(2026) 231/232 were not retrieved (the PDFs did not render). No evidence of an explicit commission cap was found. Proposed application dates were not found.
- No confirmation of a Parliament rapporteur or committee vote date.
- The 2021/782 details above are from background knowledge and were not fetched this session.

## TAP TSI revision timeline making OSDM / distribution interfaces mandatory

### Takeaway
The TAP TSI revision is done. The TEL TSI (Implementing Reg (EU) 2026/253, adopted 6 Feb 2026, published in the OJ on
10 Feb 2026, in force 2 Mar 2026) repeals TAP TSI 454/2011 and TAF 1305/2014. OSDM is **not mandatory on its own**:
it is one of four allowed Transmodel-based options in ERA TD B.5 (OSDM, OMSA, two TAP legacy formats), covering only
availability, reservation and cancellation. The availability and reservation obligations apply from **10 June 2029**,
and the OSDM-based option is expected to be replaced by a CEN standard (EUDIT) in 2028.

### Cited Findings
- Reg 2026/253 adopted 6 Feb 2026, published 10 Feb 2026, entry into force 2 Mar 2026 — [EC presentation](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf); [EUR-Lex OJ L 2026/253](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ%3AL_202600253)
- "OSDM is part of the TSI for the functions availability, reservation and cancellation" (ERA TD B.5 Annex B1) — [ERA](https://www.era.europa.eu/understanding-new-telematics-tsi)
- OSDM was "adapted and integrated in the Telematics TSI as one alternative booking interface option". It depends on timetable and tariff data in NeTEx via NAPs and is subject to compliance assessment. It "will be replaced by upcoming CEN standard (EUDIT) in 2028". The four options are OSDM, OMSA and two legacy formats (binary, XML). The booking API is "conditional (in case reservation/yield-mgmt provided by RU)" — [EC presentation](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf)
- Phased dates — [EC presentation](https://cdn.asp.events/CLIENT_CL_Conf_BDA05934_5056_B731_4C9EEBBE0C2416C2/sites/transport-ticketing-globa/media/2026-presentations/TTG-26-European-Commission-Digital-Rail-Ticketing....pdf):
  - 14 Dec 2025: passenger timetable data
  - 13 Dec 2026: common reference data; conditions of carriage incl. station accessibility (ERSAD); ticket formats
  - 12 Dec 2027: connection times; passenger information in stations and on board
  - 10 Dec 2028: running and forecast information; ticketing reference data; **tariff data**
  - **10 Jun 2029: availability and reservations**
  - 9 Dec 2029: train composition; readiness forecast
- 13 Dec 2026 is also the deadline for security elements for product distribution (section 4.6, Appendix G). A common Union API specification is due by 30 Sep 2027 (art 21). Appendix B open points close by 31 Dec 2028. Projects already in development may get an extra 12 months (art 16(5)) — [ERA](https://www.era.europa.eu/understanding-new-telematics-tsi)
- The OSDM project is updating its references from TAP TSI to TEL TSI (GitHub issue, Oct 2026) — [OSDM GitHub #1647](https://github.com/UnionInternationalCheminsdeFer/OSDM/issues/1647)
- An OSDM sandbox exists for developers, operators and vendors (search snippet attributed to the Distribusion domain, unclear) — [Distribusion docs](https://docs.distribusion.com/dt/api/getting-started/intro)

### Inferences
- Even after June 2029, the TSI standardises the interface, not the commercial right to sell. Access stays "subject to contractual provisions" unless COM(2026) 232 is adopted. For a startup, OSDM matters as a future direct-connect format, so it is worth designing the internal offer model around OSDM concepts (offers, bookings, fulfillments) now.

### Gaps
- osdm.io was not fetched. Which operators already expose OSDM production APIs (for example SBB, ÖBB, DB) was not verified this session.
- The SDBT initiative appears to have been folded into the May 2026 passenger package (COM(2026) 231/232/233). No separate SDBT legal act was found, but this is an inference from naming, not confirmed.
