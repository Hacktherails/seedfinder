# Third-party (startup OTA / metasearch) access to booking & ticketing APIs: DB, Trenitalia, Italo, Renfe, Iryo, Ouigo ES, Flix, RegioJet, ČD, PKP IC, European Sleeper, WESTbahn, SJ/Snälltåget

Scope note: these notes are about BOOKING/TICKETING APIs (sell and issue a ticket). Open DATA APIs (timetables, GTFS, real-time) are flagged separately where relevant. The research date is 21 Nov 2026. Older sources are dated inline. Because of the tool-call budget, some operators (ČD direct API, SJ, Snälltåget, Iryo direct, Ouigo direct, Renfe's own partner page) could not be checked against operator-owned B2B pages. These are listed under Gaps.

## Q1. Per-operator: does a booking API exist, who can access it, commissions, wholesaler-only? Classification

### Takeaway
Almost no operator offers a self-serve booking API to an unknown startup. The realistic options are:
- a signed reseller contract with a bond (Trenitalia, PKP Intercity);
- a wholesaler/aggregator API (Distribusion, Trainline Partner Solutions, Omio B2B, All Aboard, Rail Europe), where the operator still approves each retailer;
- affiliate deep links through Awin (Flix, Italo, and bahn.de, which has an Awin presence but unverified terms).

Overall classification: none of the operators is a clean ALLOWS. Most are PARTIAL. PKP Intercity is effectively closed to new applicants for now.

### Cited Findings

**Deutsche Bahn (DB Fernverkehr / DB Vertrieb). Classification: PARTIAL (contract-only; no public self-serve booking API found)**
- DB has a sales API (the "PST" interface) that Rail Europe integrates for distribution. This comes from a search-result summary of a Rail Europe press item; the term "PST" could not be confirmed on a DB page — [Rail Europe press corner](https://press.raileurope.com/article/43609-deutsche-bahn-and-rail-europe-forge-continued-strategic-partnership-to-transform-international-rail-travel)
- Distribusion won a DB tender to build a multi-carrier sales solution. It uses OSDM for price collection, booking, ticket delivery, rebooking and cancellation from DB's selling system — [Distribusion](https://www.distribusion.com/news/distribusion-wins-tender-to-support-the-development-of-a-new-multi-carrier-sales-solution-for-deutsche-bahn)
- DB planned to start adopting OSDM in autumn 2025 to simplify international bookings — [Euronews, 28 May 2025](https://www.euronews.com/2025/05/28/europe-wants-seamless-international-train-travel-deutsche-bahn-says-its-getting-there)
- DB's lobbying submission (March 2026) asks for OSDM to be written into EU rules (TSI Telematics). It says DB aims to connect all major neighbouring railways via OSDM by end-2026, and that neighbouring railways' tickets will be sold on bahn.de / DB Navigator from the 2026 timetable year — [Bundestag Lobbyregister SG2603270097](https://www.lobbyregister.bundestag.de/media/25/00/713698/Stellungnahme-Gutachten-SG2603270097.pdf)
- German government answer (hib 671/2026, 28 Aug 2026):
  - DB sells its own products first and currently sells no direct competitors.
  - Combined journeys with other providers show one total price in a single checkout. Each provider issues its own ticket via OSDM.
  - Split "through tickets" are not possible.
  - [Bundestag hib 671/2026](https://www.bundestag.de/presse/hib/kurzmeldungen-1206436)
- DB's own international page says OSDM enables mutual access between European rail companies *and sales platforms* — [int.bahn.de](https://int.bahn.de/en/offers/international-rail-companies)
- DB moved most licensed travel agencies to zero commission and launched the "Bahn Easy" booking portal in early 2023. This is a 2022 report — [touristik-aktuell, 14 Jun 2022](https://www.touristik-aktuell.de/nachrichten/verkehr/news/datum/2022/06/14/db-nullprovision-und-neues-buchungsportal/)
- Commission for platforms is regulated by the Bundeskartellamt case (see Q3). DB told Tagesspiegel it had agreed "an appropriate commission" with its other sales partners — [Tagesspiegel Background](https://background.tagesspiegel.de/verkehr-und-smart-mobility/briefing/null-oder-acht-prozent-provision)
- The Tagesspiegel headline "Null oder acht Prozent Provision" suggests the dispute is framed as 0% vs. 8% commission. Only the headline was seen, behind a paywall, so treat this with caution — [Tagesspiegel Background](https://background.tagesspiegel.de/verkehr-und-smart-mobility/briefing/null-oder-acht-prozent-provision)
- Affiliate: an Awin merchant profile for "bahn.de - Reise- und Mobilitätsportal" (ID 14964) exists, but the terms page returned 404 when fetched — [Awin 14964](https://ui.awin.com/merchant-profile-terms/14964/transaction)

**Trenitalia (incl. Frecciarossa; Trenitalia France). Classification: PARTIAL, but the most obtainable direct contract found (formal OLTA reseller programme with a bond)**
- Trenitalia's "On Line Travel Agency" (OLTA) platform lets authorised resellers sell the full range of Trenitalia electronic products, B2C or B2B, "by connecting to our API".
  - Requirements: a guarantee bond.
  - Includes a sales commission (rate not published), a dedicated sales account, accounting and training.
  - Tickets can be cancelled within 30 minutes of issue.
  - To apply, email international.sales@trenitalia.it with your company name and target markets. A sales account manager then contacts you.
  - [Trenitalia: Become an Authorized Reseller](https://www.trenitalia.com/en/information/join-online-and-become-a-trenitalia-partner.html)
- The Italian partner page sends API/OLTA integration questions to API-partners@trenitalia.it — [Trenitalia diventa agenzia partner](https://www.trenitalia.com/it/informazioni/diventa-agenzia-partner.html)
- Trenitalia's General Conditions require Trenitalia's express written authorisation for any sub-affiliate or subcontractor used by a reseller for promotion or online advertising — [Trenitalia General Conditions (PDF)](https://www.trenitalia.com/content/dam/trenitalia/allegati/en/information/Trenitalia_General_Conditions_EN.pdf)
- Via Distribusion, Trenitalia reviews every API integration:
  - It asks what % of its content the retailer will sell, and wants a rationale if below 100%.
  - It reviews UI flows end-to-end in the retailer's staging environment.
  - It adds its own required items on top of Distribusion's accreditation.
  - [Distribusion docs: Carrier Accreditation](https://docs.distribusion.com/dt/api/getting-started/accreditation/carrier-accreditation)
- Trenitalia France: agencies selling via Amadeus (Travel Platform / Web Services) must first be accredited by Trenitalia France — [voyages-d-affaires](https://www.voyages-d-affaires.com/en/?p=198105)
- Also resold by AccesRail — [AccesRail Trenitalia](https://www.accesrail.com/products/trenitalia/)

**Italo (NTV). Classification: PARTIAL (no public direct API programme found; reachable through aggregators plus an Awin affiliate programme)**
- Italo's reservation and sales system runs on Navitaire (Amadeus), and the contract was renewed until 2030 — [Amadeus press release](https://amadeus.com/en/newsroom/press-releases/italo-extends-partnership-with-navitaire-for-digital-transformation-retailing)
- All Aboard (an aggregator) markets "Sell rail directly through Italo's API … Available via All Aboard", with "instant accreditation, real-time inventory, e-ticket support". Pricing and commission are not stated. This is an aggregator's marketing claim — [All Aboard: Italo](https://allaboard.eu/operators/italy/italo)
- Italo is distributed to corporate tools via Trainline Partner Solutions (e.g. Fairjungle integrated Italo, Renfe and Iryo via Trainline) — [Trainline Partner Solutions blog](https://tps.thetrainline.com/blog-and-media/fairjungle-integrate-italo-renfe-and-iyro/)
- Affiliate fallback:
  - Awin "Italo Treno IT Programma d'affiliazione" pays a *fixed commission per purchase*; the amount was not visible — [Awin 9685](https://ui.awin.com/merchant-profile/9685)
  - Shopper.com claims "5–10%". This conflicts with Awin's fixed-fee description and the source is low-reliability — [shopper.com](https://www.shopper.com/partnerships/italotreno-it-affiliate-program)

**Renfe. Classification: PARTIAL, leaning ALLOWS by obligation (EU commitments force full content and real-time access for ticketing platforms, but under contract)**
- The EU commitments decision of 17 Jan 2024 obliges Renfe to give third-party ticketing platforms all current and future content and real-time data. Details are in Q3 — [EC press release IP/24/201](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_201/IP_24_201_EN.pdf)
- Omio describes itself as an official/authorised Renfe seller, including special fares and live updates — [Omio Renfe](https://www.omio.com/train_providers/renfe)
- Trainline says it connects directly to Renfe inventory (no buy-and-resell), has been in Spain since 2016, and has agreements with more than 30 operators in Spain including Renfe, Iryo, Ouigo and Alsa — [Trainline Renfe](https://www.thetrainline.com/en-us/train-companies/renfe)
- In 2024 Trainline sold about 13% of seats on Madrid–Barcelona and was the third-largest seller after Renfe and Ouigo — [Vozpópuli, updated 7 Nov 2024](https://www.vozpopuli.com/espana/alarma-renfe-iryo-ouigo-plataforma-venta-billetes-amenaza-sd.html)
- Uber launched rail in Spain using Omio's API — [Railway Gazette](https://www.railwaygazette.com/passenger/uber-adds-spanish-rail-travel-options/66958.article)
- Open DATA (not booking): Renfe publishes open data (GTFS/timetables). Third-party descriptions of it are unofficial — [facts.dev Renfe Open Data](https://facts.dev/api/renfe-open-data)

**Iryo. Classification: PARTIAL (wholesaler, GDS and TMC deals; no public direct API programme found)**
- Iryo extended its presence in the Amadeus GDS to seven key markets — [BTN Europe](https://www.businesstravelnewseurope.com/Ground-Transport/Amadeus-integrates-Iryo-rail-content-in-seven-key-markets)
- Trainline Partner Solutions integrated Renfe and Iryo into Concur Travel (June 2026) — [Trainline Group PR](https://trainlinegroup.com/media/news/trainline-partner-solutions-has-integrated-renfe-and-iryo-into-concur-travel-enabling-corporate-travel-bookings-across-multiple-train-operators-on-a-single-platform)
- Iryo has a direct distribution deal with the TMC Travel Planet — [BTN Europe](https://www.businesstravelnewseurope.com/Ground-Transport/Travel-Planet-agrees-distribution-deal-with-Spanish-rail-operator-Iryo)
- Omio says it partners with iryo — [Omio iryo](https://omio.com/companies/trains/iryo-qgixa)

**Ouigo España. Classification: PARTIAL (mainly via Trainline)**
- Ouigo España partnered with Trainline in 2021, a few weeks after its May 2021 launch. Trainline also sells the FLEX option (+€7) — [BTN Europe](https://www.businesstravelnewseurope.com/TMC-Distribution/Trainline-adds-Ouigo-Espaa); [Ouigo ES press](https://www.ouigo.com/es/actualidad/ouigo-consolida-su-red-de-ventas-con-trainline)
- Ouigo France is sold to TMCs (Navan, TravelPerk, Fairjungle) via the Trainline Partner Solutions API (Aug 2026) — [The Business Travel Mag](https://thebusinesstravelmag.com/ouigo-france-tickets-now-easier-to-book/)

**FlixTrain / Flix. Classification: PARTIAL, leaning ALLOWS (the most startup-friendly route found: an affiliate programme with a stated path to an API or white label)**
- Flix's affiliate page has two integration tiers, applied for by email to the Online Distribution Team (company info, domains, average monthly visits):
  - "static": banners, links, widgets;
  - "dynamic": GTFS, API, white label and metasearch, aimed at metasearchers, OTAs and travel platforms.
  - [Flixbus affiliate partners](https://www.flixbus.com/company/partners/affiliate-partners)
- Awin "FlixBus & FlixTrain DE" programme:
  - 60-day attribution;
  - metasearch/aggregator cooperations must be agreed directly with affiliatepartner@flixbus.com;
  - no brand-keyword bidding and no reselling of vouchers.
  - [Awin 13945 terms](https://ui.awin.com/merchant-profile-terms/13945)
- Commission example: the Swiss programme pays 5% gross per booking, excluding platform or service fees. Rates vary by market, and the FlixTrain DE rate was not confirmed — [Awin Flix profiles](https://ui.awin.com/merchant-profile/13945)

**RegioJet. Classification: PARTIAL (wholesalers only; no public partner API found)**
- Rail Europe added RegioJet content (2024) — [Global Railway Review](https://www.globalrailwayreview.com/news/171987/rail-europe-regiojet/)
- Omio calls itself an official RegioJet partner — [Omio RegioJet](https://www.omio.com/companies/trains/regiojet-ewand)
- No RegioJet developer portal or affiliate terms were found. An unofficial Apify scraper exists, which is not a sanctioned route — [Apify](https://apify.com/tomas.nosek/regiojet-seat-finder/api/client/nodejs)

**České dráhy (ČD). Classification: unverified, PARTIAL at best**
- ČD's e-shop and the "Můj vlak" app sell European Sleeper tickets (Prague–Amsterdam/Brussels) under European Sleeper's tariff. This shows ČD acting as a retailer for others — [ČD press release](https://www.ceskedrahy.cz/en/press-center/press-releases/ceske-drahy-simplify-line-purchase-tickets-night-trains)
- No ČD third-party booking API programme was found (gap).

**PKP Intercity. Classification: DOES NOT ALLOW for now (formal programme exists, but intake is frozen pending a new API)**
- The "Unified model of agency sales" (UWH) programme sells via the carrier's API. Requirements:
  - a live, publicly available sales system (web/app) using an API;
  - at least 6 months on the market;
  - first-line customer support, complaints and refunds;
  - stage-1 integration within 120 days;
  - at least 2 payment methods;
  - a non-negotiable standard agreement, shared only after an NDA;
  - security via a bank guarantee, insurance guarantee or cash deposit.
- Status: new applicants not accepted since 6 Nov 2024. Integrations on the current system are suspended. Applications for the new API were due "from Q4 2025", and the current status is unknown. Contact: uwh@intercity.pl.
- [PKP Intercity UWH](https://www.intercity.pl/en/uwh/)
- Biletico.pl became the eighth UWH agent — [Cashless.pl](https://www.cashless.pl/16123-intercity-biletico)

**European Sleeper. Classification: PARTIAL, leaning ALLOWS via Distribusion (the open hub)**
- European Sleeper uses Distribusion's API to connect to "retailers of their choice". Omio and TicTacTrip were already selling. Distribusion also supplies its GTFS to Google. The announcement is about 2023 — [Distribusion](https://www.distribusion.com/news/distribusion-technologies-partners-with-european-sleeper-to-increase-global-online-sales)
- Also sold by ČD (see above).

**WESTbahn. Classification: PARTIAL, leaning ALLOWS via Distribusion**
- Full WESTbahn inventory is on Distribusion's B2B API, Online Booking Engine and Agency Counter, in price parity with westbahn.at — [Distribusion](https://distribusion.com/news/distribusion-technologies-partners-with-westbahn,-expanding-market-offerings-in-dach)
- Lanes & Planes integrated WESTbahn via Distribusion (Feb 2025) — [Distribusion](https://distribusion.com/news/lanes-planes-partners-with-distribusion-to-integrate-westbahn-for-corporate-travel)
- Trainline partnered with WESTbahn in May 2017 — [Railway Technology](https://www.railway-technology.com/news/newstrainline-partners-with-westbahn-to-expand-in-austria-5811155/)

**SJ / Snälltåget (brief). Classification: PARTIAL (via aggregators)**
- All Aboard shows SJ and Snälltåget logos among its 100+ carriers. Bookability per carrier is not stated — [All Aboard](https://allaboard.eu/operators/italy/italo)
- No operator-owned B2B pages were checked (gap).

### Inferences
- For a hackathon or early-stage startup, the fastest path to real booking across these operators is an aggregator API (Distribusion for WESTbahn, European Sleeper and Trenitalia; Trainline Partner Solutions or Omio B2B for Renfe, Iryo, Ouigo and Italo). A direct contract with every operator is not realistic early on. Even so, operators such as Trenitalia keep a per-retailer approval step, including a UI review.
- Direct contracts are realistic only with Trenitalia (OLTA, with a bond) and, once reopened, PKP Intercity. Both need a live sales platform and a financial guarantee, and PKP Intercity needs 6 months on the market.
- Affiliate deep links (Flix and Italo on Awin) are the only zero-contract fallback. They monetise referrals but do not let the startup issue tickets or take payment itself, which matters for a Stripe checkout flow.

### Gaps
- No commission percentages were found for Trenitalia OLTA, DB, Renfe, Iryo, Ouigo, RegioJet, ČD or PKP Intercity. Italo's Awin fixed fee and bahn.de's Awin terms were not visible.
- DB has no public partner/reseller API page. The "PST" interface name was not verified.
- Iryo, Ouigo ES, RegioJet, ČD and SJ: no operator-owned B2B or developer pages were fetched.
- PKP Intercity: whether the new API opened to applicants after Q4 2025 is unknown.
- osdm.io implementation list: not retrieved (search returned nothing useful). The OSDM spec itself is at [UIC OSDM GitHub Pages](https://unioninternationalcheminsdefer.github.io/OSDM/).

## Q2. Is there an OSDM-compliant or proprietary distribution API open to new third-party retailers, and since when? What are the onboarding requirements and timeline?

### Takeaway
OSDM is being rolled out mainly railway-to-railway and via vendors: DB from autumn 2025, with neighbours targeted by end-2026, and Distribusion offering an OSDM connector. No operator in scope publishes an OSDM endpoint that new startup retailers can sign up to. Onboarding runs through contracts:
- PKP Intercity: 120-day integration, 30-day application answer;
- Trenitalia: bond plus sales-account onboarding;
- Distribusion: general accreditation plus per-carrier approval.

### Cited Findings
- OSDM offers a "Retailer mode" and a "Distributor mode". In distributor mode the API also returns fare data — [UIC OSDM (GitHub mirror)](https://relatedrepos.com/gh/UnionInternationalCheminsdeFer/OSDM)
- OSDM-Online is a REST API specified in YAML and covers fares and reservations — [CER OSDM](https://cer.be/cer-eu-projects-initiatives/open-sales-and-distribution-model-osdm); [UIC OSDM spec](https://unioninternationalcheminsdefer.github.io/OSDM/)
- DB OSDM adoption: planned from autumn 2025 — [Euronews](https://www.euronews.com/2025/05/28/europe-wants-seamless-international-train-travel-deutsche-bahn-says-its-getting-there). Neighbouring railways targeted by end-2026, and DB lobbies for OSDM in the TSI — [Lobbyregister](https://www.lobbyregister.bundestag.de/media/25/00/713698/Stellungnahme-Gutachten-SG2603270097.pdf)
- Distribusion markets an OSDM rail connector and claims to resell 40+ rail carriers through one integration — [Distribusion OSDM connector](https://www.distribusion.com/de/osdm-connector-rail); [Distribusion rail solutions](https://www.distribusion.com/de/rail-solutions)
- Distribusion's accreditation has three steps (general, carrier approval, carrier contracting). Markup fees depend on the agreement with Distribusion, are not included in API prices, and must be shown and charged by the retailer — [Distribusion accreditation criteria](https://docs.distribusion.com/dt/api/getting-started/accreditation/criteria); [Distribusion markup fees](https://docs.distribusion.com/dt/api/other-concepts/booking-fees/markup-fees)
- Omio offers a Booking API and a Meta Search API under "Omio B2B" — [Omio B2B](https://omio.com/corporate/omio-b2b/)
- Timelines: PKP IC replies to an application within 30 days, requires stage-1 integration within 120 days, and needs 6 months of prior market presence — [PKP Intercity UWH](https://www.intercity.pl/en/uwh/). Trenitalia gives no published timeline — [Trenitalia](https://www.trenitalia.com/en/information/join-online-and-become-a-trenitalia-partner.html)

### Inferences
- "OSDM-compliant" does not mean "open to startups". In practice, OSDM lowers integration cost once a contract exists, and vendors such as Distribusion are the practical OSDM access point.

### Gaps
- No public list of OSDM-live operators or retailers was retrieved (the osdm.io list was not reached).
- Concrete Distribusion accreditation criteria (volume, legal entity, deposits) were not extracted, because the fetched page was only a navigation index.

## Q3. Competition and regulator decisions forcing openness: what exactly do they oblige?

### Takeaway
- EU v Renfe (Jan 2024): binding, indefinite commitments to give platforms full content and real-time data at parity with Renfe's own channels.
- Bundeskartellamt v DB (June 2023): DB must pay platforms a commission and share real-time data, and must drop advertising and discount bans. The minimum-commission cost benchmark is suspended pending the Düsseldorf main proceedings. A ruling was scheduled for 2026, and the outcome was not found.
- Italy: the relevant openness action came from ART (the transport regulator), not AGCM, via Trenitalia commitments in 2023–2024.

### Cited Findings
**EU Commission – Renfe (case opened April 2023; commitments decision 17 Jan 2024)**
- Concern: Renfe refused to give rival platforms its full content and real-time data, which may have stopped them competing with Renfe's direct channels — [EC IP/24/201](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_201/IP_24_201_EN.pdf)
- Obligations:
  - all current and future content and real-time data for platforms;
  - a look-to-book cap no lower than 600, 200 or 140, depending on a platform's request volume;
  - parity with Renfe's own platforms on maximum look-to-book and on the consequences of breaching it.
- Duration: indefinite, with a monitoring trustee reporting to the Commission for 10 years. No infringement was found, but a breach can bring a fine of up to 10% of worldwide turnover.
- [EC IP/24/201](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_201/IP_24_201_EN.pdf); [Railtech](https://railtech.com/?p=42270)
- Trainline called it a "new precedent" for parity of access for third-party distributors in Europe — [Trainline statement](https://www.trainlinegroup.com/media/rbvhifjr/trainline_welcomes_the_european_commissions_announcement_on_renfes_commitments.pdf)
- Inference with a caveat: the decision benefits "ticketing platforms" that have a distribution relationship. It does not itself create a public self-serve API.

**Bundeskartellamt – DB (B9-144/19, decision 26/28 June 2023)**
- Obligations:
  - DB must pay platforms for ticket sales, at a level covering at least DB's own long-run average incremental costs (LRAIC) of rail ticketing;
  - DB must provide real-time data;
  - platforms may use DB terms in online and app-store advertising;
  - restrictive contract clauses must go.
  - [Bundeskartellamt press release 28 Jun 2023](https://bundeskartellamt.de/SharedDocs/Meldung/EN/Pressemitteilungen/2023/28_06_2023_DB_Mobilitaet.html); [decision PDF](https://www.bundeskartellamt.de/SharedDocs/Entscheidung/DE/Entscheidungen/Missbrauchsaufsicht/2023/B9-144-19.pdf;jsessionid=267F989F45BAA9E7A6EB9895F16C9C14.1_cid362?__blob=publicationFile&v=3); [Railway Pro](https://www.railwaypro.com/wp/db-accused-of-violating-competition-law-regarding-mobility-platforms/)
- OLG Düsseldorf, 8 Mar 2024 (interim): it rejected most of DB's request but had serious doubts about the cost benchmark. Enforcement of the remuneration benchmark is suspended until the main proceedings end — [Bundeskartellamt 11 Mar 2024](https://bundeskartellamt.de/SharedDocs/Meldung/EN/AktuelleMeldungen/2024/11_03_2024_OLG_DB.html); [Concurrences](https://www.concurrences.com/fr/bulletin/news-issues/march-2024/the-higher-regional-court-of-dusseldorf-partially-suspends-enforcement-of-the)
- Aug 2024: DB signed the first new contracts with platforms. They give real-time data access on Bundeskartellamt terms, contain no advertising bans, reportedly include a commission, and allow discounts — [Bundeskartellamt 15 Aug 2024](https://bundeskartellamt.de/SharedDocs/Meldung/EN/Pressemitteilungen/2024/15_08_2024_Deutsche_Bahn.html); [heise](https://heise.de/-9836164); [ad-hoc-news](https://ad-hoc-news.de/boerse/news/ueberblick/fahrgaeste-sollen-bei-online-mobilitaetsplattformen-genauso-umfassende/65621221)
- The BGH dismissed a third party's non-admission complaint on 12 Nov 2024 (KVR 2/24) — [Concurrences](https://www.concurrences.com/en/bulletin/news-issues/november-2024/the-german-federal-court-of-justice-dismisses-a-mobility-platform-s-non)
- 2026 main proceedings on the minimum commission for Trainline and Omio:
  - Tagesspiegel (16 Jun 2026) reported the ruling would come only on 22 Jul. A later item reportedly moved it to 21 Oct 2026.
  - Both are paywalled snippets, and the outcome was not found.
  - [Tagesspiegel](https://background.tagesspiegel.de/verkehr-und-smart-mobility/briefing/urteil-zu-omio-und-trainline-erst-am-22-juli)

**Italy (ART / AGCM)**
- ART opened a sanction procedure against Trenitalia (Delibera 113/2023), and Trenitalia offered commitments. Trainline's observations asked that third-party platforms get the new post-sale features, such as the advanced care service, on equal terms — [Trainline observations (PDF)](https://www.autorita-trasporti.it/wp-content/uploads/2023/11/Trainline_osservazioni_agli_Impegni_presentati_da_Trenitalia.pdf); [ART consultation](https://autorita-trasporti.it/consultazioni/consultazione-sulla-proposta-dimpegni-presentata-da-trenitalia-s-p-a-nellambito-del-procedimento-sanzionatorio-avviato-con-delibera-n-113-2023); [ART Delibera 58/2024](https://www.autorita-trasporti.it/wp-content/uploads/2024/05/Delibera-n.-58_2024_signed.pdf)
- AGCM PS13019 (opened 2 Dec 2025, commitments in 2026) is a consumer-rights case on delay compensation, not distribution — [AGCM PS13019](https://www.agcm.it/dotcmsdoc/allegati-news/PS13019_acc.%20imp.+chius.pdf)
- An earlier AGCM antitrust case (A575, closed with commitments in 2023) concerned RFI/Trenitalia data access for Italo, a competing operator, not for retailers — [AGCM A575](https://www.agcm.it/dotcmsdoc/allegati-news/A575_A575B_acc.%20impegni%20+%20chius.%20proc._omi.pdf)

### Inferences
- The regulatory trend (EU/Renfe, BKartA/DB) obliges incumbents to deal with platforms on non-discriminatory terms. It does not create open APIs. A startup still has to sign a distribution contract, but these precedents strengthen its hand in negotiations, for example on commission and data access.

### Gaps
- The final OLG Düsseldorf judgment (2026) and the resulting minimum commission are unknown.
- No compliance or monitoring-trustee reports on Renfe after 2024 were found.

## Q4. Are new entrants (Flix, RegioJet, European Sleeper, Iryo, Italo, WESTbahn) more open, and via which hubs?

### Takeaway
Yes, broadly. New entrants seek reach through aggregators:
- Distribusion: European Sleeper, WESTbahn;
- Trainline Partner Solutions: Italo, Iryo, Ouigo;
- Omio: Iryo, RegioJet, European Sleeper;
- Rail Europe: RegioJet;
- All Aboard: Italo.

Flix is the only one with a self-described path from affiliate to API, white label or metasearch. None publishes a self-serve booking API of its own.

### Cited Findings
- European Sleeper says it will use Distribusion to reach "retailers of their choice" — [Distribusion](https://www.distribusion.com/news/distribusion-technologies-partners-with-european-sleeper-to-increase-global-online-sales)
- WESTbahn's full inventory is on the Distribusion API at price parity — [Distribusion](https://distribusion.com/news/distribusion-technologies-partners-with-westbahn,-expanding-market-offerings-in-dach)
- Flix "dynamic" integration (API, white label, GTFS, metasearch) is offered on application — [Flixbus affiliate](https://www.flixbus.com/company/partners/affiliate-partners)
- Italo via All Aboard ("instant accreditation") — [All Aboard](https://allaboard.eu/operators/italy/italo); Italo via Trainline Partner Solutions — [TPS](https://tps.thetrainline.com/blog-and-media/fairjungle-integrate-italo-renfe-and-iyro/)
- Iryo via Amadeus, Trainline, Omio and Travel Planet — sources in Q1.
- RegioJet via Rail Europe and Omio — sources in Q1.
- Bileto and Lyko: no evidence was found for these operators within the call budget.

### Inferences
- A metasearch MVP could combine:
  - Distribusion for European Sleeper, WESTbahn and Trenitalia, with booking, if accredited;
  - Flix through Awin, then API on application;
  - Italo through Awin deep links;
  - Trainline or Omio affiliate links for Renfe, Iryo, Ouigo and DB.

### Gaps
- Bileto and Lyko hub coverage of these operators was not researched.
- Iryo, RegioJet and European Sleeper commission levels with hubs were not found.
