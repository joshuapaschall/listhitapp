import type { PersonaContent, SitePersona } from "../types"

// Buyer-acquisition / list-building copy. The site owner is a
// wholesaler/investor/agent building a buyer list; the visitor is the buyer.
// Render-time tokens: {Brand} (the business name) and {City} (the market, which
// falls back to "your area" on nationwide sites). Never write a literal city or
// state — only {City}.
export const PERSONAS: Record<SitePersona, PersonaContent> = {
  cash: {
    label: "Cash buyers",
    eyebrow: "Off-market cash deals",
    headline: "Off-market deals in {City}, before anyone else.",
    subhead:
      "Join our cash buyers list and get new wholesale and off-market properties — 30 to 50% under retail — the moment we lock them up. By text and email. Free to join.",
    stat: "Off-market deals in {City}, sent first",
    formTitle: "Get deals sent to you",
    formSubtitle: "New off-market properties, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🏠", title: "Off-market access", body: "Deals direct from distressed sellers, probate, and tax-delinquent owners — never on the MLS." },
      { icon: "⚡", title: "You move first", body: "Buyers on the list get every new deal by text the moment we lock it up." },
      { icon: "💵", title: "Free to join", body: "No fees, no contracts. We make money on the deals, not on the list." },
    ],
    announcement: "New off-market deals in {City} every week — join free and get them first.",
    howItWorks: [
      { title: "Join the list", body: "Drop your name and number. It takes 30 seconds and it's free." },
      { title: "Get deals by text", body: "We text you new properties with the price, repairs, and ARV already run." },
      { title: "Lock it up", body: "See one you like? Reply and we hand you the contract. Close fast, all cash." },
    ],
    faqs: [
      { q: "Is it really free to join?", a: "Yes. No fee, no subscription, no contract. We make money on the deals we wholesale, not on the list." },
      { q: "Do I have to buy anything?", a: "Never. You'll get deals as we lock them up; buy when one fits and ignore the rest." },
      { q: "How fast do I need to act?", a: "The best deals move quickly, so being on the list and replying fast is the edge. We always give you the numbers up front." },
      { q: "What kind of properties do you send?", a: "Mostly single-family off-market homes that need work — flips and rentals — direct from motivated sellers." },
      { q: "Do you run the numbers for me?", a: "Every deal ships with the asking price, estimated repairs, and ARV so you can underwrite it in minutes." },
      { q: "How do I get off the list?", a: "Reply STOP to any text and you're out instantly. Re-join anytime." },
    ],
    about: {
      headline: "We find the deals. You buy them right.",
      body: "{Brand} is a wholesale team that locks up off-market properties and passes them straight to our buyer list — no retail markups, no bidding wars, just clean deals with real spread for serious buyers. We'd rather send you one deal you actually close than flood you with junk, so every property comes with honest numbers and a clear path to the contract.",
      trust: ["Numbers you can trust", "We close on time", "Built for repeat buyers"],
    },
    prose: [
      {
        eyebrow: "How the deals work",
        heading: "Real off-market deals, real spread",
        bodyHtml:
          "<p>Every property we send is an <b>off-market deal</b> — locked up direct from a motivated seller and never listed on the MLS, so you're not bidding against retail buyers. We focus on <b>wholesale properties</b> and <b>investment properties</b> priced well <b>below market value</b>, the kind of distressed homes that pencil out for a flip or a rental.</p><p>Because we negotiate the discount before you ever see the deal, you start with equity in place. Each listing ships with the asking price, an honest repair estimate, and the <b>ARV</b> (after-repair value) so you can see the <b>spread</b> at a glance and underwrite it in minutes — not days. No fluff, no inflated comps, just numbers you can take to a lender or a partner.</p>",
        pullQuote: "We'd rather send you one deal you close than ten you delete.",
      },
      {
        eyebrow: "Local edge",
        heading: "Investing in {City}",
        bodyHtml:
          "<p>Whether you're buying in {City} or the surrounding area, the buyers who win are the ones who see inventory first. We work {City} block by block — tracking pre-foreclosures, tired landlords, and inherited homes — so the deals hit your phone before they hit anyone's feed. <a href='/how-it-works'>See how it works</a>, then <a href='/properties'>browse current deals</a> and reply to claim the one that fits.</p>",
      },
    ],
    types: [
      { title: "Foreclosures & bank-owned (REO)", body: "Pre-foreclosures and lender-owned homes priced to move fast.", href: "/properties" },
      { title: "Wholesale deals", body: "Contracts we've locked up direct from motivated sellers, assigned straight to you.", href: "/properties" },
      { title: "Fixer-uppers", body: "Distressed single-family homes with room to add value on a flip.", href: "/properties" },
      { title: "Multi-family", body: "Duplexes to small apartment buildings with built-in cash flow.", href: "/properties" },
      { title: "Below-market & discount", body: "Equity deals priced well under retail, numbers included.", href: "/properties" },
      { title: "Probate & inherited", body: "Homes from owners who need a fast, clean, all-cash close.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We pull off-market inventory across {City} and nearby — browse by area:",
      singleLine: "We work throughout {City} and the surrounding area.",
    },
  },
  investor: {
    label: "Investor buyers",
    eyebrow: "Vetted investment deals",
    headline: "Funded deals in {City}, straight to your inbox.",
    subhead:
      "We send vetted flip and rental opportunities to our private investor network before they ever hit the market — with the numbers already run.",
    stat: "Underwritten deals in {City}, matched to you",
    formTitle: "Join the investor list",
    formSubtitle: "Deal alerts by text and email.",
    ctaLabel: "Get the deals",
    bannerCta: "Join the investor list",
    features: [
      { icon: "📊", title: "Numbers already run", body: "Every deal comes with the spread, ARV, and rehab estimate so you can decide fast." },
      { icon: "🎯", title: "First look", body: "Our network sees opportunities before they reach the broader market." },
      { icon: "📈", title: "Built-in equity", body: "We've already negotiated the discount — you close with equity in place." },
    ],
    announcement: "New funded-ready deals in {City} weekly — sent to our investor list first.",
    howItWorks: [
      { title: "Join the list", body: "Tell us your buy box: flip, rental, price, area." },
      { title: "Get vetted deals", body: "We send underwritten opportunities with the math done." },
      { title: "Close with equity", body: "Reply to claim it; we hand you a clean, title-ready contract." },
    ],
    faqs: [
      { q: "How are deals vetted?", a: "We run comps, rehab, and ARV before sending — you see the math." },
      { q: "What returns should I expect?", a: "Varies by deal; every listing shows the spread so you judge for yourself." },
      { q: "Do you provide comps?", a: "Yes — comps and a repair estimate ship with each deal." },
      { q: "Can I set a buy box?", a: "Yes — tell us strategy, price range, and area and we only send what fits." },
      { q: "Is there a fee?", a: "No fee to join. We profit on the wholesale spread." },
      { q: "How do I stop alerts?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Deals that pencil — sent to buyers who close.",
      body: "{Brand} sources off-market flips and rentals and underwrites them before they ever reach you. We work with a tight network of serious investors because reliable closers get the best deals first — so every opportunity arrives with comps, a rehab estimate, and the spread laid out, ready for your buy box.",
      trust: ["Underwriting included", "We close on time", "Repeat-buyer first"],
    },
    prose: [
      {
        eyebrow: "How we underwrite",
        heading: "Investment properties, already vetted",
        bodyHtml:
          "<p>We send <b>investment properties</b> — flips and buy-and-hold rentals — that we've already underwritten. Before a deal hits your inbox we pull comps, estimate the rehab, and calculate <b>ARV</b> and <b>spread</b>, so you're evaluating numbers, not chasing them. Everything is sourced <b>off-market</b> and priced <b>below market value</b>, which means the discount is negotiated up front and you close with equity already in place.</p><p>Tell us your buy box — strategy, price range, and target returns — and we filter the firehose down to deals that actually fit. The investors who do best with us treat the list like a pipeline: review the math, reply fast, and close clean.</p>",
        pullQuote: "Reliable closers get the best deals first.",
      },
      {
        eyebrow: "Local edge",
        heading: "Building a portfolio in {City}",
        bodyHtml:
          "<p>Whether you're scaling a rental portfolio in {City} or flipping in the surrounding area, deal flow is the bottleneck — and that's exactly what we solve. We surface off-market inventory across {City} and hand you the underwriting with it. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse current deals</a> to start.</p>",
      },
    ],
    types: [
      { title: "Fix & flip", body: "Distressed homes with a clear spread between purchase, rehab, and ARV.", href: "/properties" },
      { title: "Buy & hold rentals", body: "Cash-flowing single-family and small multi-family for your portfolio.", href: "/properties" },
      { title: "Multi-family", body: "Duplexes through small apartment buildings with value-add upside.", href: "/properties" },
      { title: "BRRRR deals", body: "Buy, rehab, rent, refinance — properties that fit the strategy.", href: "/properties" },
      { title: "Value-add", body: "Below-market homes where forced appreciation drives the return.", href: "/properties" },
      { title: "Turnkey", body: "Lighter-lift rentals ready to perform from day one.", href: "/properties" },
    ],
    areas: {
      heading: "Where we source deals",
      intro: "We underwrite off-market inventory across {City} and nearby — browse by area:",
      singleLine: "We source investment deals throughout {City} and the surrounding area.",
    },
  },
  rto: {
    label: "Rent-to-own buyers",
    eyebrow: "Rent-to-own homes",
    headline: "Rent-to-own homes in {City} — no bank needed.",
    subhead:
      "Get matched with rent-to-own homes in your area and start building toward ownership today. Less-than-perfect credit is okay.",
    stat: "Move-in ready homes available now",
    formTitle: "Find your home",
    formSubtitle: "See homes you can qualify for.",
    ctaLabel: "Find my home",
    bannerCta: "See available homes",
    features: [
      { icon: "🔑", title: "Skip the bank", body: "Move in now and work toward ownership — no traditional mortgage approval required." },
      { icon: "✅", title: "Credit-friendly", body: "Past credit issues don't disqualify you. We look at the whole picture." },
      { icon: "🛣️", title: "A clear path", body: "Simple terms and a defined route from renter to homeowner." },
    ],
    announcement: "New rent-to-own homes in {City} added weekly — see what you qualify for.",
    howItWorks: [
      { title: "Tell us what you want", body: "Bedrooms, area, budget — takes a minute." },
      { title: "Get matched", body: "We text you rent-to-own homes you can qualify for." },
      { title: "Move in & build", body: "Settle in and work toward owning, on terms that fit." },
    ],
    faqs: [
      { q: "Do I need good credit?", a: "No — past issues are okay; we look at your full situation." },
      { q: "How much do I need down?", a: "It varies by home; we'll tell you up front, no surprises." },
      { q: "How does a lease-option work?", a: "You rent the home now with the right to buy it later, and part of the path is set in writing before you move in." },
      { q: "Is this a scam?", a: "No. You'll see the home, the terms, and the path to owning in writing." },
      { q: "How long until I own?", a: "Depends on the agreement — we explain the timeline before you commit." },
      { q: "How do I start?", a: "Tell us what you want above and we'll match you." },
    ],
    about: {
      headline: "A real path to owning — even if the bank said no.",
      body: "{Brand} connects renters with rent-to-own and lease-option homes and walks you through every step. No confusing fine print, no pressure — just an honest route from renting to owning, with the terms and the timeline spelled out before you ever move in.",
      trust: ["Credit-friendly", "Clear, simple terms", "Real homes, real owners"],
    },
    prose: [
      {
        eyebrow: "How it works",
        heading: "Rent-to-own & lease-option, explained",
        bodyHtml:
          "<p>A <b>rent-to-own</b> (or <b>lease-option</b>) home lets you move in as a renter today while locking in the right to buy the same house later — often with a portion of your path toward ownership set in writing from day one. It's built for people who are ready to own but aren't a fit for a traditional mortgage yet, whether that's credit, time on the job, or self-employment.</p><p>We match you to homes you can actually qualify for and lay out the down payment, the monthly amount, and the timeline before you commit. No surprises, no fine-print traps — just a clear path from renter to owner.</p>",
        pullQuote: "Move in now. Work toward owning on terms you can see.",
      },
      {
        eyebrow: "Local homes",
        heading: "Rent-to-own homes in {City}",
        bodyHtml:
          "<p>We add rent-to-own homes in {City} and the surrounding area as they come available. Tell us your bedrooms, budget, and the area you want, and we'll text you the ones that fit. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse available homes</a>.</p>",
      },
    ],
    types: [
      { title: "Single-family rent-to-own", body: "Move-in ready houses with a built-in path to ownership.", href: "/properties" },
      { title: "Lease-option homes", body: "Rent now with the locked-in right to buy later.", href: "/properties" },
      { title: "Credit-friendly homes", body: "Options for buyers rebuilding credit or self-employed.", href: "/properties" },
      { title: "Low-down-payment", body: "Homes with flexible, clearly stated move-in costs.", href: "/properties" },
    ],
    areas: {
      heading: "Where we have homes",
      intro: "We list rent-to-own homes across {City} and nearby — browse by area:",
      singleLine: "We have rent-to-own homes throughout {City} and the surrounding area.",
    },
  },
  owner: {
    label: "Owner-finance buyers",
    eyebrow: "Owner financing available",
    headline: "Owner-financed homes in {City}.",
    subhead:
      "Skip the mortgage maze. Get matched to owner-financed homes with flexible down payments and terms that actually fit your budget.",
    stat: "Flexible terms, real approvals",
    formTitle: "Get matched",
    formSubtitle: "Tell us what you're looking for.",
    ctaLabel: "Get matched",
    bannerCta: "Find owner-financed homes",
    features: [
      { icon: "🏦", title: "No bank required", body: "Finance directly through the seller — no conventional mortgage needed." },
      { icon: "📝", title: "Flexible terms", body: "Down payments and monthly plans built around your real budget." },
      { icon: "✅", title: "Credit-friendly", body: "Self-employed or past credit issues? You can still qualify." },
    ],
    announcement: "New owner-financed homes in {City} weekly — skip the mortgage maze.",
    howItWorks: [
      { title: "Tell us your budget", body: "What you can put down and pay monthly." },
      { title: "Get matched", body: "We send owner-financed homes that fit." },
      { title: "Close with the seller", body: "Simple terms, no bank — we guide you through it." },
    ],
    faqs: [
      { q: "What is owner financing?", a: "You pay the seller directly over time instead of getting a bank loan." },
      { q: "Do I need a big down payment?", a: "It's flexible and set per home — we tell you before you commit." },
      { q: "Can I qualify if I'm self-employed?", a: "Often yes — sellers look at the whole picture." },
      { q: "How is the interest rate set?", a: "It's agreed directly with the seller and shown in writing before you commit." },
      { q: "Are the terms fair?", a: "You'll see every term in writing before agreeing to anything." },
      { q: "How do I start?", a: "Tell us your budget above and we'll match you." },
    ],
    about: {
      headline: "Homeownership without the bank's hoops.",
      body: "{Brand} matches buyers to owner-financed and seller-financed homes and makes the terms plain. If the traditional mortgage road hasn't worked, there's a simpler one — you pay the seller directly on terms you can see, and we'll walk it with you from the first conversation to the closing table.",
      trust: ["No bank required", "Terms that fit you", "Honest, plain paperwork"],
    },
    prose: [
      {
        eyebrow: "How it works",
        heading: "Owner financing & seller financing",
        bodyHtml:
          "<p><b>Owner financing</b> (also called <b>seller financing</b>) means you buy the home and pay the seller directly over time, instead of qualifying for a bank mortgage. The down payment, interest rate, and monthly payment are negotiated with the seller and put in writing up front — which is why it works for self-employed buyers and people rebuilding credit who get stuck in the traditional process.</p><p>We match you to homes where the seller is open to financing and budget around what you can actually put down and pay each month. You see every term before you agree to anything, and we guide you all the way to closing.</p>",
        pullQuote: "Pay the seller directly — on terms you can see.",
      },
      {
        eyebrow: "Local homes",
        heading: "Owner-financed homes in {City}",
        bodyHtml:
          "<p>We add owner-financed homes in {City} and the surrounding area as sellers list them. Tell us your budget and the area you want, and we'll send the matches. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse available homes</a>.</p>",
      },
    ],
    types: [
      { title: "Owner-financed homes", body: "Buy directly from the seller, no bank mortgage required.", href: "/properties" },
      { title: "Seller-financed move-in ready", body: "Homes you can settle into now on seller terms.", href: "/properties" },
      { title: "Low-down-payment", body: "Flexible, clearly stated down payments per home.", href: "/properties" },
      { title: "Self-employed friendly", body: "Sellers who look at the whole picture, not just a credit score.", href: "/properties" },
    ],
    areas: {
      heading: "Where we have homes",
      intro: "We list owner-financed homes across {City} and nearby — browse by area:",
      singleLine: "We have owner-financed homes throughout {City} and the surrounding area.",
    },
  },
  creative: {
    label: "Creative-terms buyers",
    eyebrow: "Creative & flexible terms",
    headline: "Creative-terms deals in {City}, before they're listed.",
    subhead:
      "Subject-to, lease options, and seller financing — get deals structured to work for your situation, sent to you before they're listed anywhere.",
    stat: "Deals structured to fit you",
    formTitle: "Join the list",
    formSubtitle: "Get creative-terms deals first.",
    ctaLabel: "Get matched to deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🧩", title: "Structured to fit", body: "Subject-to, lease options, seller financing — terms built around your goals." },
      { icon: "🎯", title: "Off-market first", body: "Get matched to deals before they're listed anywhere else." },
      { icon: "💡", title: "Real spreads", body: "Creative structures that still leave room to profit." },
    ],
    announcement: "New creative-terms deals in {City} weekly — structured to fit your goals.",
    howItWorks: [
      { title: "Tell us your strategy", body: "Subject-to, lease option, seller finance — your play." },
      { title: "Get matched deals", body: "We send structures that fit your goals first." },
      { title: "Lock it up", body: "Reply to claim it; we help structure the terms." },
    ],
    faqs: [
      { q: "What's \"subject-to\"?", a: "Buying a property while leaving the existing financing in place — we explain each structure." },
      { q: "What about lease options?", a: "You control the property now with the right to buy later; we lay out the terms in writing." },
      { q: "Do you only do creative deals?", a: "We focus on flexible structures, but cash deals come through too." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How fast do these move?", a: "Quickly — being on the list is the edge." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Deals most buyers can't see — structured to work.",
      body: "{Brand} sources properties that fit creative structures — subject-to, lease options, seller financing — and matches them to buyers who know how to use them. We bring the deal and the structure together so you can move on opportunities that never make it to a traditional listing, with real room to profit.",
      trust: ["Structured to fit", "Off-market first", "Real profit room"],
    },
    prose: [
      {
        eyebrow: "How the structures work",
        heading: "Creative finance, done right",
        bodyHtml:
          "<p><b>Creative finance</b> is how experienced buyers acquire properties without a new bank loan on every deal. With <b>subject-to</b>, you take over a property while its existing mortgage stays in place; with a <b>lease option</b>, you control the home now and buy it later; with <b>seller financing</b>, the seller becomes the bank. Each structure opens doors that all-cash and conventional buyers can't reach.</p><p>We source off-market properties that actually fit these structures and match them to buyers who know how to use them — then help you frame the terms. The result is deals with real spread that never show up on a standard listing.</p>",
        pullQuote: "The right structure turns a 'no' into a close.",
      },
      {
        eyebrow: "Local edge",
        heading: "Creative deals in {City}",
        bodyHtml:
          "<p>We track motivated sellers across {City} and the surrounding area whose situations fit a creative structure. Tell us your play and we'll send matches first. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse current deals</a>.</p>",
      },
    ],
    types: [
      { title: "Subject-to", body: "Take over a property with its existing financing left in place.", href: "/properties" },
      { title: "Seller financing", body: "The seller carries the note — buy without a new bank loan.", href: "/properties" },
      { title: "Lease options", body: "Control the property now with the locked-in right to buy later.", href: "/properties" },
      { title: "Off-market value-add", body: "Distressed deals that pencil with the right structure.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We source creative-terms deals across {City} and nearby — browse by area:",
      singleLine: "We find creative-terms deals throughout {City} and the surrounding area.",
    },
  },
  land: {
    label: "Land buyers",
    eyebrow: "Off-market land & lots",
    headline: "Off-market land deals in {City}, priced to move.",
    subhead:
      "Raw land, lots, and acreage at investor prices. Join our list and get first access before they hit the open market.",
    stat: "Off-market land & lots in {City}",
    formTitle: "Get land deals",
    formSubtitle: "New parcels by text and email.",
    ctaLabel: "Join the land list",
    bannerCta: "Get land deals",
    features: [
      { icon: "🌄", title: "Below-market parcels", body: "Raw land, lots, and acreage at prices the open market never sees." },
      { icon: "⚡", title: "First access", body: "Get new parcels by text the moment we have them." },
      { icon: "🖊️", title: "Close remotely", body: "Sign online and close from anywhere — no site visit required." },
    ],
    announcement: "New off-market land & lots in {City} weekly — priced to move.",
    howItWorks: [
      { title: "Join the list", body: "Tell us the type and area of land you buy." },
      { title: "Get parcels by text", body: "We send new land with price and key details." },
      { title: "Close remotely", body: "Reply to claim it and close from anywhere." },
    ],
    faqs: [
      { q: "What kind of land?", a: "Raw land, residential lots, and acreage — tell us your target." },
      { q: "Can I close remotely?", a: "Yes — most buyers close online without a visit." },
      { q: "Do you check zoning and access?", a: "We share what we know on zoning, access, and utilities so you can do quick due diligence." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How are prices set?", a: "Below market — we send the numbers so you judge." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Land deals before they hit the market.",
      body: "{Brand} sources off-market parcels — raw land, residential lots, and acreage — and sends them to land buyers first, at prices that leave room to profit. We share the zoning, access, and utility details we have so you can move quickly and close from anywhere, on parcels the open market never sees.",
      trust: ["Below-market parcels", "First access", "Close from anywhere"],
    },
    prose: [
      {
        eyebrow: "How the deals work",
        heading: "Land, lots & acreage at investor prices",
        bodyHtml:
          "<p>We source <b>off-market land</b> — raw <b>acreage</b>, residential <b>lots</b>, and recreational parcels — direct from owners who want a fast, clean sale. Because these never reach the open market, you skip the bidding and buy <b>below market value</b>, with room to hold, build, or resell.</p><p>Every parcel ships with the price and the key details we have — zoning, access, and utilities — so you can run quick due diligence and move. Most of our buyers never set foot on the property before closing: you sign online and close remotely from anywhere.</p>",
        pullQuote: "Parcels the open market never sees, priced to move.",
      },
      {
        eyebrow: "Local edge",
        heading: "Land deals in {City}",
        bodyHtml:
          "<p>We track land and lots across {City} and the surrounding area, from infill lots to larger acreage. Tell us what you buy and we'll text you parcels that fit. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse current parcels</a>.</p>",
      },
    ],
    types: [
      { title: "Raw land", body: "Undeveloped parcels at below-market prices, ready to hold or build.", href: "/properties" },
      { title: "Residential lots", body: "Buildable infill and subdivision lots for builders and investors.", href: "/properties" },
      { title: "Acreage", body: "Larger tracts for recreation, agriculture, or future development.", href: "/properties" },
      { title: "Recreational land", body: "Hunting, camping, and getaway parcels off the open market.", href: "/properties" },
      { title: "Infill lots", body: "In-town lots primed for new construction.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find land",
      intro: "We source off-market parcels across {City} and nearby — browse by area:",
      singleLine: "We find land throughout {City} and the surrounding area.",
    },
  },
  commercial: {
    label: "Commercial buyers",
    eyebrow: "Commercial opportunities",
    headline: "Commercial deals in {City} for serious investors.",
    subhead:
      "Multifamily, retail, and mixed-use opportunities sent to our private commercial buyer network before they reach the broader market.",
    stat: "Multifamily, retail & mixed-use in {City}",
    formTitle: "Join the network",
    formSubtitle: "Off-market commercial deals.",
    ctaLabel: "Get commercial deals",
    bannerCta: "Join the network",
    features: [
      { icon: "🏢", title: "Off-market commercial", body: "Multifamily, retail, and mixed-use before they reach the broader market." },
      { icon: "📊", title: "Underwriting included", body: "Each opportunity comes with the figures you need to move quickly." },
      { icon: "🎯", title: "First look", body: "Our private network sees deals first." },
    ],
    announcement: "New commercial opportunities in {City} weekly — sent to our network first.",
    howItWorks: [
      { title: "Join the network", body: "Tell us asset class, size, and target markets." },
      { title: "Get underwritten deals", body: "We send opportunities with the figures done." },
      { title: "Move fast", body: "Reply to engage; we coordinate the next steps." },
    ],
    faqs: [
      { q: "What asset classes?", a: "Multifamily, retail, mixed-use — tell us your focus." },
      { q: "Do you provide underwriting?", a: "Yes — figures ship with each opportunity." },
      { q: "Do you share rent rolls and T-12s?", a: "When available, we include rent rolls and trailing financials so you can underwrite quickly." },
      { q: "Is this confidential?", a: "Yes — deals go to a private network." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Commercial opportunities, off-market and underwritten.",
      body: "{Brand} sources multifamily, retail, and mixed-use opportunities and sends them to a private network of serious buyers — with the underwriting already in hand. When the figures are available we include rent rolls and trailing financials, so you can size a deal up fast and move while it's still off-market.",
      trust: ["Underwriting included", "Off-market first", "Serious-buyer network"],
    },
    prose: [
      {
        eyebrow: "How we source",
        heading: "Commercial & multi-family, underwritten",
        bodyHtml:
          "<p>We source <b>commercial</b> and <b>multi-family</b> opportunities — apartment buildings, retail centers, and mixed-use — off-market, direct from owners and through relationships the open market doesn't reach. Each deal arrives underwritten: we include the figures you need, and when they're available, rent rolls and trailing financials, so you can size up the opportunity in one sitting.</p><p>Because these move through a private network, serious buyers get the first look. Tell us your asset class, deal size, and target markets, and we filter to opportunities that fit your mandate.</p>",
        pullQuote: "Off-market, underwritten, and sent to closers first.",
      },
      {
        eyebrow: "Local edge",
        heading: "Commercial deals in {City}",
        bodyHtml:
          "<p>We track multifamily, retail, and mixed-use across {City} and the surrounding area. Tell us your buy box and we'll send underwritten opportunities first. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse current deals</a>.</p>",
      },
    ],
    types: [
      { title: "Multifamily", body: "Apartment buildings with value-add and cash-flow upside.", href: "/properties" },
      { title: "Retail", body: "Strip centers and single-tenant retail, off-market.", href: "/properties" },
      { title: "Mixed-use", body: "Combined residential and commercial assets in one deal.", href: "/properties" },
      { title: "Office", body: "Office and flex space priced for the current market.", href: "/properties" },
      { title: "Industrial", body: "Warehouse and light-industrial with durable tenancy.", href: "/properties" },
    ],
    areas: {
      heading: "Where we source deals",
      intro: "We track commercial opportunities across {City} and nearby — browse by area:",
      singleLine: "We source commercial deals throughout {City} and the surrounding area.",
    },
  },
  agent: {
    label: "Agents & realtors",
    eyebrow: "Off-market & coming soon",
    headline: "Off-market listings in {City}, before anyone else.",
    subhead:
      "Be the first to know about my off-market and coming-soon listings. Join my private buyer list and never miss a deal.",
    stat: "First access to my {City} listings",
    formTitle: "Get first access",
    formSubtitle: "Coming-soon listings by text and email.",
    ctaLabel: "Join my VIP list",
    bannerCta: "Join the VIP list",
    features: [
      { icon: "⭐", title: "Coming-soon first", body: "See my off-market and coming-soon listings before they hit the portals." },
      { icon: "🎯", title: "Matched to your search", body: "Tell me what you want and I'll only send what fits." },
      { icon: "🔕", title: "No portal noise", body: "No spam, no junk — just real listings worth your time." },
    ],
    announcement: "New off-market & coming-soon listings in {City} weekly — for my VIP buyers.",
    howItWorks: [
      { title: "Join my list", body: "Tell me what you're looking for." },
      { title: "Get listings first", body: "I text you matches before they hit the portals." },
      { title: "Tour & write", body: "See one you love? Reply and we move on it." },
    ],
    faqs: [
      { q: "Is this free?", a: "Yes — free to join my list." },
      { q: "What are pocket listings?", a: "Homes I'm selling quietly, off the MLS — my list sees them before they go public." },
      { q: "Will you spam me?", a: "No — only listings that match what you told me." },
      { q: "Do I have to use you as my agent?", a: "Joining the list is no-obligation; we can talk when something fits." },
      { q: "How fast do listings go?", a: "Fast — being on the list is how you see them first." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Your inside track to homes before they list.",
      body: "I send my off-market and coming-soon listings — including pocket listings that never touch the MLS — to a private buyer list first. If you're serious about finding the right home in {City}, this is how you see it before everyone else, matched to exactly what you're looking for.",
      trust: ["Coming-soon first", "Matched to you", "No portal noise"],
    },
    prose: [
      {
        eyebrow: "Why a private list",
        heading: "Off-market inventory for buyers who move",
        bodyHtml:
          "<p>The best homes often sell before they ever reach the portals. As an agent I see <b>pocket listings</b> and <b>off-market inventory</b> — coming-soon homes, quiet sales, and pre-market opportunities — that the public never gets a shot at. My private buyer list is how I share them first.</p><p>Tell me your must-haves and I match you only to homes that fit, so your inbox stays signal, not noise. When the right one comes up, you'll already know about it while everyone else is still refreshing the apps.</p>",
        pullQuote: "The best homes sell before they ever go public.",
      },
      {
        eyebrow: "Local edge",
        heading: "Finding a home in {City}",
        bodyHtml:
          "<p>I work {City} and the surrounding area, so I hear about homes before they list. Tell me what you want and I'll send the matches first. <a href='/how-it-works'>See how it works</a> or <a href='/properties'>browse current listings</a>.</p>",
      },
    ],
    types: [
      { title: "Coming-soon listings", body: "Homes about to hit the market — see them first.", href: "/properties" },
      { title: "Off-market homes", body: "Quiet sales that never reach the public portals.", href: "/properties" },
      { title: "Pocket listings", body: "Homes I'm selling privately, off the MLS.", href: "/properties" },
      { title: "New construction", body: "Builder inventory and pre-sales matched to your search.", href: "/properties" },
      { title: "Price improvements", body: "Listings that just got more buyable — flagged for you.", href: "/properties" },
    ],
    areas: {
      heading: "Where I work",
      intro: "I cover homes across {City} and nearby — browse by area:",
      singleLine: "I work throughout {City} and the surrounding area.",
    },
  },
}

export function getPersona(id: SitePersona): PersonaContent {
  return PERSONAS[id] || PERSONAS.cash
}
