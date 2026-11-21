# Booking/ticketing API access for third-party resellers: SNCF, Eurostar, SNCB, NS, ÖBB, SBB, UK RDG

Scope note: this covers booking and ticketing APIs, not open data APIs such as GTFS or timetables. Research was done on 2026-11-21, with about 20 tool calls. Several primary operator pages returned HTTP 403 to automated fetch (sncf-connect-tech.fr, company.sbb.ch, lechotouristique.com). Claims from those pages come from search snippets only and are flagged as such.

## Q1. Does each operator publish an OSDM-compliant distribution API, and is it open to new third-party retailers?

### Takeaway
No operator in scope offers a self-serve booking API that a startup can simply sign up for. NS is "in production" on OSDM. ÖBB is "implemented" as retailer/distributor, but its fare-provider role is still being implemented. SNCF and SNCF Connect are still "implementing" OSDM 3.x. SBB is "implementing". Eurostar and SNCB do not appear in the OSDM table at all. Every operator that has a booking API (Eurostar Partners API, ÖBB Webservice Ticketshop, SBB Swiss Mobility API, SNCF via distribution contract) gates it behind a signed contract, and some add a volume threshold or a bank guarantee. Each one is therefore classified PARTIAL.

### Cited Findings

**OSDM status table (osdm.io, status dated January 2026)**
- NS: Retailer, Distributor & Fare Provider, OSDM 3.8, "in production" — [OSDM Implementations](https://osdm.io/tools/implementations/)
- ÖBB: Retailer, Distributor, 3.8, "implemented". ÖBB Fare Provider, 3.8, "implementing" — [OSDM Implementations](https://osdm.io/tools/implementations/)
- SBB: Distributor, Fare Provider, 3.4, "implementing" — [OSDM Implementations](https://osdm.io/tools/implementations/)
- SNCF: Fare Provider, 2.0, "in production". SNCF: Fare Provider, Distributor, 3.4, "implementing". SNCF Connect: Retailer, 3.7, "implementing" — [OSDM Implementations](https://osdm.io/tools/implementations/)
- Benerail (the SNCB/NS international distribution subsidiary): Product Provider 3.0.2 "in production" and Retailer 3.4 "in production" — [OSDM Implementations](https://osdm.io/tools/implementations/)
- Eurostar, SNCB (as its own entry) and Trainline are not listed. Third-party aggregators that are listed include Distribusion (Solution Provider 3.5.5, in production), SilverRail (Retailer 3.0.5, in production), Bileto, Trainplanet and Sqills (Solution Provider) — [OSDM Implementations](https://osdm.io/tools/implementations/)
- OSDM is UIC IRS 90918-10. The specification is published as open source under Apache 2.0 on GitHub. Its stated aim is to "make train tickets available to third party vendors" — [UIC OSDM](https://uic.org/projects/osdm); [btobrail](https://www.btobrail.com/Seamless-connection-for-passenger-Open-Sales-and-Distribution-Model)
- An ERA analysis (Oct 2024) says OSDM reduces third-party platforms to the "Retailer" role, with offer creation "exclusively assigned to railway undertakings". It also says OSDM is a voluntary API specification outside the scope of TAP TSI, so no operator is legally obliged to open it — [ERA report](https://www.era.europa.eu/system/files/2024-10/analysis%20of%20distribution%20rules%20in%20tap,%20osdm,%20and%20recent%20competition%20cases.pdf?t=1732265346)
- A public OSDM API sandbox was launched in March 2024. Benerail supplied a sandbox on osdm.io — [Railway Gazette, 7 Mar 2024](https://www.railwaygazette.com/business/2024/03/07/open-sales-distribution-model-api-sandbox-launched/); [benerail](https://benerail.com/news/uic-welcomes-the-osdm-api-sandbox-of-benerail-on-osdm-io/)

**SNCF Voyageurs / SNCF Connect (TGV INOUI, Ouigo, Intercités, TER)**
- No public developer booking API was found. SNCF Connect & Tech has a "Ticket distribution" expertise page, but the fetch was blocked with a 403, so its content was not verified — [SNCF Connect & Tech](https://www.sncf-connect-tech.fr/en/our-digital-solutions-and-expertises/our-areas-of-expertise/ticket-distribution/)
- Travel agencies connect to SNCF's Résarail reservation system through the paid Ravel and WDI interfaces. These were the subject of the 2014 competition commitments (see Q3) — [Autorité de la concurrence, 2 Oct 2014](https://www.autoritedelaconcurrence.fr/en/communiques-de-presse/2-october-2014-sale-train-tickets)
- Deplacementspros (Dec 2024) says that for SNCF, OSDM would mainly serve to give standardised access to its offers, "notamment pour des distributeurs sans moyens de développer leur propre API" (notably for distributors that lack the means to build their own API). It expected adoption to accelerate in 2025 — [Deplacementspros](https://www.deplacementspros.com/transport/quest-ce-que-losdm-ce-nouveau-standard-ferroviaire-europeen) (search snippet)
- SNCF Voyageurs signed a bilateral deal with Trip.com, announced at IFTM Paris on 26 Sep 2025. Trip.com connects "via une API" to the full range: TGV INOUI, TER, Intercités, international trains, and OUIGO from autumn 2025. The article does not mention OSDM, and it describes a single partnership, not an open programme — [TourMaG, 26 Sep 2025](https://www.tourmag.com/Trip-com-va-vendre-les-billets-de-train-SNCF_a128648.html)
- Trainline Partner Solutions (Trainline's B2B wholesale arm) has launched resale of OUIGO France tickets — [TourMaG](https://www.tourmag.com/Trainline-Partner-Solutions-lance-la-vente-de-billets-OUIGO-France_a123318.html) (title only, not fetched). Business Travel Magazine also reported on 25 Aug 2026 that OUIGO France tickets had become easier to book — [The Business Travel Mag](https://thebusinesstravelmag.com/ouigo-france-tickets-now-easier-to-book/) (title only)
- A TourMaG headline quotes SNCF Connect saying that sharing its tools with travel agencies "n'est pas dans notre stratégie" (is not part of our strategy) — [TourMaG](https://www.tourmag.com/SNCF-Connect-veut-se-renforcer-sur-la-vente-de-billets-a-l-international-ABO_a128567.html) (headline/snippet only)
- Commercial intermediaries such as Lyko advertise SNCF search and booking "without redirection". This is vendor marketing — [Lyko](https://lyko.tech/en/portfolio/train-api/sncf-connect-api/)

**Eurostar (including ex-Thalys)**
- Eurostar runs a "Partners API" for "distribution partners and tour operators that wish to sell Eurostar products" on their own site or app. It is JSON RESTful (camelCase), English only, covers bookings up to 12 months ahead, supports GBP, EUR and USD, and offers real-time inventory plus full sales and after-sales functions — [Eurostar for Agents – API](https://eurostarforagents.com/working-together/eurostar-api/)
- Requirement: "Minimum annual threshold £20,000 / €20,000". Partners get the API spec by emailing trade.contracts@eurostar.com — [Eurostar for Agents – API](https://eurostarforagents.com/working-together/eurostar-api/)
- Remuneration: "Net fares (for eligible tour operators) and commission on public fares". The rate is not published — [Eurostar for Agents – API](https://eurostarforagents.com/working-together/eurostar-api/)
- Since 2 April 2024, API partners must capture Advance Passenger Information, or else redirect customers to eurostar.com — [Eurostar for Agents – API](https://eurostarforagents.com/advance-passenger-information-now-live/); [API FAQ PDF](https://eurostarforagents.com/wp-content/uploads/2024/04/Advance-Passenger-Information-Eurostar-Partners-FAQ.pdf)
- Eurostar also offers Voyager, an offline booking tool for leisure agents and tour operators — [Eurostar for Agents – Working together](https://eurostarforagents.com/working-together/)
- The API is proprietary, not confirmed as OSDM. Sqills (which supplies Eurostar's S3 Passenger PSS) claims OSDM support "out-of-the-box", but this is a vendor claim — [Sqills S3 Passenger](https://www.sqills.com/s3-passenger/)

**SNCB/NMBS**
- No public reseller API was found. International sales run through SNCB-NMBS International (b-europe.com). Its backend IT for international distribution runs through the subsidiary Benerail. SNCB-NMBS International says it is "directly connected" to the Eurostar, TGV INOUI and ICE booking systems — [About SNCB Europe](https://www.b-europe.com/EN/Legal/About-SNCB-Europe); [Railway Gazette](https://www.railwaygazette.com/passenger/sncb-seeks-to-develop-benerail-distribution-partnership/44679.article)
- Travel agencies can sell international tickets if they are approved by SNCB International. Companies can use the B2B Business Portal with monthly invoicing — [b-europe FAQ](https://www.b-europe.com/EN/Questions/Tickets); [NMBS business portal](https://www.belgiantrain.be/en/mobility-for-business/services/nmbs-business-portal)
- SNCB's developer FAQ covers data feeds only (timetables, which it says are "not an API") — [SNCB FAQ developers](https://www.belgiantrain.be/en/support/faq/faq-developers/faq-developers-data)
- The Benerail and Sqills partnership is OSDM-focused. Distribution partners connected to Benerail can get offers by configuration rather than custom development — [Sqills case Benerail](https://www.sqills.com/cases/benerail)
- A Trainline page noted SNCB-operated routes "unavailable due to commercial conditions with the operator". The date is unknown — [Trainline SNCB](https://thetrainline.com/en/train-companies/sncb)
- Resellers such as All Aboard and Lyko sell SNCB through their own APIs. Lyko advertises a percentage commission — [All Aboard SNCB](https://allaboard.eu/operators/belgium/sncb); [Lyko SNCB](https://lyko.tech/en/portfolio/train-api/sncb-api/)

**NS / NS International**
- NS is in production on OSDM 3.8 as retailer, distributor and fare provider — [OSDM Implementations](https://osdm.io/tools/implementations/). No public NS or NS International partner/API onboarding page was found.
- AccesRail lists NS as a partner, which shows NS distributes through rail intermediaries — [AccesRail](https://www.accesrail.com/?p=56)

**ÖBB (including Nightjet)**
- ÖBB's "Online-Kooperationen" page offers four options:
  - textlink/deeplink to the Ticketshop with preset parameters
  - a free booking widget (Anreisewidget)
  - "Webservice Ticketshop", either as Teilintegration (search on the partner site, booking and payment on ÖBB) or as Vollintegration (search, booking and payment all on the partner site)
  - distribution partnerships ("Vertriebspartnerschaften")

  Full integration requires "hohem technischem Knowhow" (high technical expertise) and the ability to process payments for ÖBB, and "may" require a bank guarantee as proof of creditworthiness. Commissions are described only as "attraktiven Provisionen" (attractive commissions) — [ÖBB Online-Kooperationen](https://www.oebb.at/de/kooperationen/online-kooperationen)
- Complex trips abroad cannot be booked through sales partners — [ÖBB Vertriebspartner](https://www.oebb.at/en/tickets-kundenkarten/weg-zum-ticket/vertriebspartner) (search snippet)
- Nightjet became bookable through Rail Europe after an ÖBB integration in Dec 2023 — [touristik-aktuell, 18 Dec 2023](https://www.touristik-aktuell.de/nachrichten/verkehr/news/datum/2023/12/18/rail-europe-macht-oebb-zuege-buchbar/)
- Data API: the SCOTTY timetable webservice and widgets are free — [ÖBB Online-Kooperationen](https://www.oebb.at/de/kooperationen/online-kooperationen)

**SBB CFF FFS**
- The "SBB Swiss Mobility API" is a booking API for partners. Onboarding means registering on the SBB developer portal and getting a personal contract ID from SBB. SBB may cap request volumes. Use purely for timetable queries is prohibited: the API may only be used for bookings and/or links to the SBB webshop or app. Third-party sales partners need SBB's prior written approval. This is from the GTC version of Dec 2021, read via search snippet because the fetch was blocked with a 403 — [SBB Swiss Mobility API GTC](https://company.sbb.ch/en/sbb-as-business-partner/services/digital-sales-solutions/sales-solutions/sbb-swiss-mobility-api/sbb-swiss-mobility-api-gtc.html); [SBB API registration](https://company.sbb.ch/en/offers/services/swiss-mobility-solutions/api/registration.html)
- SBB also has an affiliate page — [SBB affiliate](https://company.sbb.ch/en/offers/services/swiss-mobility-solutions/affiliate.html) (not fetched)
- In 2022, SBB built an OSDM demo ticketing app in seven days and said it would publish it on GitHub so that other parties could develop distribution frontends — [IRJ](https://www.railjournal.com/technology/sbb-develops-ticketing-app-in-seven-days-using-osdm-api/); [UIC](https://uic.org/com/enews/article/osdm-demo-app-developed-in-seven-days)

**UK National Rail / Rail Delivery Group (context for London)**
- Third-party retailers need an RDG licence. Licence types include the Third Party Investor Licence (TPIL), an Interim Retail Licence used during a pilot, and an International Licence. After a successful pilot, the retailer normally moves to a TPIL within about 6 months of the start of operations — [RDG third-party licences](https://raildeliverygroup.com/our-services/retail-commercial/how-to-become-a-retailer/third-party-licences.html); [ATOC travel agents – licences](https://atoctravelagents.org/third-party-retailing/third-party-licences)
- The application fee is £10,000 + VAT, due on signature of the Interim Retail Licence (2025 form). It is non-refundable even if the licence is denied (2023 cost sheet) — [Application form 2025](https://www.atoctravelagents.org/clientfiles/File/Retail%20Agent%20Licence%20Application%20form%202025.doc); [Entry costs 2023](https://www.atoctravelagents.org/clientfiles/File/Entry%20costs%202023.pdf)
- A bond is held in favour of RDG. It is sized on projected turnover and reviewed annually. Failing to maintain it for 5 days or more can lead to termination. Accreditation is quoted at about £1k per day — [Q&A March 2018](https://www.atoctravelagents.org/clientfiles/File/Q&A%20March%202018.pdf); [Q&A 2023](https://atoctravelagents.org/clientfiles/File/Q&A%202023.pdf)
- An indicative time-to-market plan is published — [RDG time to market](https://www.atoctravelagents.org/clientfiles/File/Time%20to%20market%20-%20Indicative%20high%20level%20plan.pdf)

### Inferences
- **Classification (startup that wants to issue tickets itself):**
  - **SNCF: PARTIAL.** Access comes through a bilateral contract (Ravel/WDI or API deals like the Trip.com one) or a wholesaler (Trainline Partner Solutions, Lyko, Distribusion). There is no open retailer onboarding, and the SNCF Connect OSDM retailer role is still "implementing".
  - **Eurostar: PARTIAL.** It is the most obtainable direct API in this set, with a published spec on request and a £/€20k annual threshold, but it is contract-gated.
  - **SNCB: PARTIAL.** Access goes through SNCB International approval or Benerail. There is no public API.
  - **NS: PARTIAL.** OSDM is in production but no public onboarding was found, so access is likely via Benerail or wholesalers.
  - **ÖBB: PARTIAL.** A documented path exists (deeplink, widget, webservice, then full integration with a possible bank guarantee). It is the most transparent tiering.
  - **SBB: PARTIAL.** Contract ID, written approval, booking-only use.
  - **RDG: PARTIAL.** A formal, open-to-all licensing route exists, but with a £10k fee, a bond and an accreditation process.
  - **ALLOWS:** none of them on a self-serve basis. **DOES NOT ALLOW:** none of them is fully closed.
- For a hackathon MVP, the realistic booking path is an aggregator API: Distribusion and SilverRail (both in production on OSDM), Trainline Partner Solutions, Lyko, All Aboard, or the Benerail OSDM sandbox. Operator deeplinks and affiliate links are the fallback.
- Through tickets: OSDM supports combining offers from several fare providers, but no operator source here describes letting third parties issue combined through tickets across operators. Each operator API sells its own products (Eurostar sells only Eurostar). The ÖBB partner restriction on "complex trips abroad" suggests that multi-operator through-ticketing is generally not exposed to partners.

### Gaps
- SNCF Connect & Tech's actual B2B/API offer and onboarding criteria could not be checked (403). No dated SNCF statement on when OSDM retailing opens to third parties was found.
- No public NS International partner/API page was found.
- No published commission rates were found for Eurostar, ÖBB, SBB, NS or SNCB direct APIs.
- No information was found on ex-Thalys routes specifically within the Eurostar Partners API (whether all Eurostar Continental routes are included).
- Current (2026) SBB GTC text could not be fetched.

## Q2. What are the contractual/accreditation requirements and timeline to get access?

### Takeaway
Requirements are bilateral and mostly unpublished. The published ones are: Eurostar's £/€20k minimum annual sales, ÖBB's payment capability plus possible bank guarantee, SBB's written approval plus contract ID, SNCB International agency approval, and the UK RDG licence (£10k fee, bond on projected turnover, pilot then TPIL within about 6 months). SNCF agency distribution carries a 2.7% B2B commission under a 5-year agency convention ending in 2027 (from a search snippet).

### Cited Findings
- Eurostar: £20,000 / €20,000 minimum annual threshold; contact trade.contracts@eurostar.com — [Eurostar for Agents – API](https://eurostarforagents.com/working-together/eurostar-api/)
- ÖBB: full integration requires processing payments for ÖBB and possibly a bank guarantee — [ÖBB Online-Kooperationen](https://www.oebb.at/de/kooperationen/online-kooperationen)
- SBB: written approval, contract ID, possible request caps — [SBB Swiss Mobility API GTC](https://company.sbb.ch/en/sbb-as-business-partner/services/digital-sales-solutions/sales-solutions/sbb-swiss-mobility-api/sbb-swiss-mobility-api-gtc.html)
- SNCF: under a five-year agency convention ending in 2027, B2B distribution commission is 2.7% (search snippet; the article fetch was blocked with a 403) — [L'Echo touristique](https://www.lechotouristique.com/article/sncf-nouvelle-convention-avec-les-agences-nouveaux-concurrents)
- SNCF: Trainline says it runs a B2B API for online booking tools and an agency tool, and notes "tous n'ont pas d'accord de distribution B2B avec nous" (not everyone has a B2B distribution agreement with us), which shows that wholesale access is itself contract-gated — [TourMaG](https://www.tourmag.com/Trainline-veut-etre-un-hub-unique-un-GDS-du-rail-🔑_a120745.html) (snippet)
- UK RDG: £10k + VAT fee, bond, accreditation, interim licence, then TPIL — see Q1 sources.
- Third-party aggregator All Aboard advertises "instant accreditation" for ÖBB content. This is a marketplace claim, not ÖBB's — [All Aboard ÖBB](https://allaboard.eu/operators/austria/oebb)

### Inferences
- A pre-revenue startup would probably fail Eurostar's £20k threshold at the start and would struggle with ÖBB's bank guarantee and RDG's bond. Starting through a wholesaler or affiliate and moving to direct contracts once volume exists is the standard path.

### Gaps
- No published timelines were found for Eurostar, SNCF, ÖBB, SBB, NS or SNCB onboarding.
- No IATA-like rail accreditation requirement was found for continental operators. SNCF agency agreements historically involve agency status, but this was not verified here.

## Q3. Court/competition cases or regulator decisions forcing openness

### Takeaway
France: the Autorité de la concurrence made SNCF commitments binding in 2014 (decision 14-D-11). They cover equal treatment of travel agencies versus voyages-sncf (now SNCF Connect), cheaper access to the Ravel/WDI distribution tools, and equal commission terms. The Autorité partly relaxed them in Dec 2021 (decision 21-D-29). EU: the Commission's January 2024 Renfe commitments decision is the precedent for forcing a dominant incumbent to give third-party platforms full content and real-time data. No equivalent EU case against SNCF, ÖBB, SBB, NS, SNCB or Eurostar was found.

### Cited Findings
- **14-D-11 (2 Oct 2014):** this followed a complaint by AS Voyages. SNCF committed to:
  - treat voyages-sncf.com and competing agencies equally
  - apply the same commission conditions to all agencies
  - lower the access price for the Ravel/WDI interfaces to Résarail, enabling the sale of iDTGV, Ouigo and so on
  - separate the unit that handles agency access requests from voyages-sncf.com

  It also committed to show timetables on sncf.com without redirecting to voyages-sncf.com — [Autorité press release](https://www.autoritedelaconcurrence.fr/en/communiques-de-presse/2-october-2014-sale-train-tickets); [Decision 14-D-11 PDF](https://www.autoritedelaconcurrence.fr/sites/default/files/commitments/14d11.pdf)
- **21-D-29 (15 Dec 2021):** SNCF asked to revise 4 of the 12 commitments. The Autorité refused for commitments 2 and 11 and accepted for commitments 7 and 8 (distribution tool access including Ravel, and the "Portail Entreprises" offers). Trainline and Omio contributed as market players — [Decision 21-D-29](https://www.autoritedelaconcurrence.fr/fr/decision/relative-la-demande-de-revision-des-engagements-pris-par-la-sncf-rendus-obligatoires-par); [PDF](https://www.autoritedelaconcurrence.fr/sites/default/files/integral_texts/2022-02/21d29.pdf)
- An earlier decision, 09-D-06 (5 Feb 2009), also concerns SNCF and the distribution sector — [Decision 09-D-06](https://www.autoritedelaconcurrence.fr/sites/default/files/commitments/09d06.pdf) (not fetched; content unverified)
- **EC Renfe (17 Jan 2024):** the commitments became legally binding under Art. 102 TFEU. Renfe must give third-party platforms access to all current and future content and real-time data shown on its own channels (deadline 29 Feb 2024). Look-to-book ratio ceilings apply (thresholds of 600, 200 or 140). There is a 10-year monitoring trustee, and breaching the commitments risks fines of up to 10% of turnover — [EC IP/24/201](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_201/IP_24_201_EN.pdf); [Railway Gazette](https://railwaygazette.com/renfe-ticket-sales-competition-commitments-made-legally-binding/65731.article); [Reuters via Yahoo](https://ca.finance.yahoo.com/news/eu-antitrust-regulator-accepts-renfes-104707222.html). Trainline welcomed the decision — [Trainline statement](https://www.trainlinegroup.com/media/rbvhifjr/trainline_welcomes_the_european_commissions_announcement_on_renfes_commitments.pdf)
- ERA's Oct 2024 report analyses distribution rules in TAP TSI and OSDM alongside recent competition cases — [ERA report](https://www.era.europa.eu/system/files/2024-10/analysis%20of%20distribution%20rules%20in%20tap,%20osdm,%20and%20recent%20competition%20cases.pdf?t=1732265346)
- A 2025–26 French Senate report (r25-783) appeared in search results on SNCF distribution — [Sénat](https://www.senat.fr/rap/r25-783/r25-7833.html) (not fetched; content unverified)

### Inferences
- The French commitments protect travel agencies' access to SNCF distribution tools on non-discriminatory terms. That gives a new French-licensed travel agency a legal argument for access, though it still has to sign an agency agreement. The Renfe precedent shows the Commission is willing to treat withholding content from third-party platforms as a possible abuse of dominance, which is leverage for any future complaint.

### Gaps
- No specific Trainline v SNCF court dispute was found in this pass.
- No EU-level case concerning Eurostar, ÖBB, SBB, NS or SNCB distribution was found.
- The status of the EU "single digital booking and ticketing" regulation proposal (2025–26) was not covered.

## Q4. Affiliate programmes and commission rates (fallback)

### Takeaway
Affiliate and deeplink routes exist for most of these operators, but rates are rarely public:
- Eurostar runs an affiliate programme on Partnerize, not Awin; the rate is not public.
- SNCF historically ran voyages-sncf (UK) on Awin.
- ÖBB offers free deeplinks and a booking widget, but no affiliate commission is stated.
- SBB has an affiliate page.
- Third-party programmes include Rail Europe (about 0.91% on tickets and 1.8% on passes via Travelpayouts), Interrail/Eurail on Awin (about 3% per a third-party directory), and Trainline on Partnerize.

### Cited Findings
- Eurostar affiliate programme: run with Partnerize, free to join, commission on each eligible sale, no public rate — [Eurostar affiliate (UK)](https://www.eurostar.com/uk-en/affiliate-marketing); [FR](https://www.eurostar.com/fr-fr/partenaire-affiliation)
- Voyages-sncf UK joined Affiliate Window (Awin). This is old news, and the rate was "subject to change" — [Awin hub](https://hub.awin.com/?p=1321542)
- Interrail by National Rail is on Awin (merchant 5797) with a 30-day cookie — [Awin merchant 5797](https://ui.awin.com/merchant-profile/5797). A third-party directory says Eurail/Interrail pays 3% — [Affilimate](https://affilimate.com/programs/interrail-eurail-pass)
- Rail Europe affiliate: 0.91% on tickets, 1.8% on passes, 30-day cookie (third-party figure; may be outdated) — [Travelpayouts Rail Europe](https://travelpayouts.com/en/offers/raileurope-affiliate-program)
- Trainline affiliates run through Partnerize — [Trainline affiliates](https://www.thetrainline.com/about-us/partnerships/affiliates)
- ÖBB: free textlink/deeplink with preset stations and a free Anreisewidget. The page mentions no affiliate commission — [ÖBB Online-Kooperationen](https://www.oebb.at/de/kooperationen/online-kooperationen)
- SBB affiliate offer page — [SBB affiliate](https://company.sbb.ch/en/offers/services/swiss-mobility-solutions/affiliate.html) (not fetched; terms unknown)
- Roundup of train affiliate programmes — [Travelpayouts blog](https://www.travelpayouts.com/blog/train-affiliate-programs/amp/)

### Inferences
- For a hackathon demo, deeplinks or affiliate links (Eurostar via Partnerize, ÖBB deeplinks, SNCF via Trainline or Rail Europe affiliate) can show "book" flows without a contract. They cannot, however, collect payment through Stripe for the actual ticket, because the operator or affiliate merchant takes the payment. Collecting payment with Stripe and issuing tickets requires a direct contract or a wholesaler API.

### Gaps
- No current SNCF Connect affiliate programme or rate was confirmed.
- No affiliate programme was found for ÖBB/Nightjet, NS International or SNCB.
- No Eurostar Partnerize commission rate was found.
