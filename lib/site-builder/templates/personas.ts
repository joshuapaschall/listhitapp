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
    eyebrow: "Off-market investment deals",
    headline: "Investment properties in {City} with the spread already run — before they hit the market.",
    subhead:
      "{Brand} sends underwritten off-market flips and rentals to our investor list first. ARV, rehab, and spread done for you — so you can say yes in ten minutes, not ten days.",
    stat: "Underwritten deals, matched to your buy box",
    formTitle: "Get investment deals sent to you",
    formSubtitle: "Off-market flips and rentals, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the investor list",
    features: [
      { icon: "📊", title: "The math is already done", body: "Every deal lands with comps, rehab estimate, ARV, and the spread. Underwrite it in minutes, or pass and wait for the next." },
      { icon: "🥇", title: "You get first look", body: "Our list sees off-market flips and rentals before they reach the MLS or the rest of the market. First in, first to lock it." },
      { icon: "📈", title: "Equity on day one", body: "We negotiate the discount before you ever see it. You close with built-in equity, not a bidding war that eats your margin." },
    ],
    announcement: "New underwritten investment properties in {City} every week — investor list gets them first.",
    howItWorks: [
      { title: "Tell us your buy box", body: "Flip or hold, price range, areas, property type. Thirty seconds and you're in." },
      { title: "Get matched deals by text", body: "We send off-market investment properties that fit your box, with the numbers already run." },
      { title: "Lock it up and close", body: "Reply to claim it. We hand you a clean, title-ready contract and you close fast — cash or your lender." },
    ],
    faqs: [
      { q: "Are these real deals or just leads?", a: "Real, locked-up properties — we control them before we send them. Every one comes with comps, rehab, and ARV so you can verify the spread yourself." },
      { q: "How do you underwrite them?", a: "We pull recent comps, estimate the rehab, and set a conservative ARV before anything goes out. You see all of it and run your own return." },
      { q: "Do I have to be a cash buyer?", a: "No. Cash and hard money close fastest and get first look, but tell us how you fund and we'll match deals you can actually close." },
      { q: "What's the catch — is there a fee?", a: "None. The list is free, no contract. We make our money on the wholesale spread baked into the deal, never on you." },
      { q: "What kind of returns are these?", a: "It depends on the deal and your strategy. We don't promise numbers — we show you the spread and ARV on every property so you decide before you commit." },
      { q: "How do I stop the texts?", a: "Reply STOP to any message and you're off instantly. Re-join whenever you want." },
    ],
    about: {
      headline: "Deals that actually pencil — sent to investors who close.",
      body: "{Brand} sources off-market flips and rentals across {City} and the surrounding area, then underwrites every one before it reaches you — comps, rehab, ARV, and spread. We keep a tight list of serious investors on purpose: reliable closers earn the best deals first. We'd rather send you one property you actually fund than bury you in listings that don't work.",
      trust: ["Underwriting on every deal", "We close on time", "Built for repeat buyers"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market investment properties, with the numbers already run.",
        bodyHtml:
          "<p>By the time a real <b>investment property</b> hits the MLS, the margin is usually gone — picked over by a dozen buyers before you ever get a showing. {Brand} works the other side of the market. We source off-market <b>fix-and-flip</b> and <b>rental</b> deals straight from motivated sellers, probate, and tax-delinquent owners, then underwrite each one before it goes out: recent comps, an honest rehab estimate, a conservative ARV, and the <b>spread</b> laid out plainly.</p><p>That means you evaluate a deal in minutes instead of chasing comps all weekend. Whether you flip, <b>BRRRR</b>, or buy and hold, our list is built to match properties to your buy box — and it's completely free, with no contract and no fee to buy. We make our money on the wholesale spread, not on you. <a href='/how-it-works'>See exactly how it works →</a></p>",
        pullQuote: "We'd rather send you one deal you actually fund than flood your inbox with listings that don't pencil.",
      },
      {
        eyebrow: "Investing in {City}",
        heading: "Why {City} keeps producing deals for flippers and landlords.",
        bodyHtml:
          "<p>Steady rental demand, motivated sellers, and neighborhoods at every price point make {City} a productive market for real estate investors. Whether you're flipping closer in or cash-flowing rentals further out, the spread is there if you know where to look — and finding the off-market <b>investment properties</b> that actually hit your numbers is exactly what we do.</p><p>We publish <a href='/properties'>discount investment properties for sale</a> as they go live and update the buyers list the moment a new wholesale or distressed deal lands. Want first look? <a href='/get-on-the-list'>Join the investor list free</a> and tell us your buy box — we'll only send deals that fit it.</p>",
      },
    ],
    types: [
      { title: "Fix & flip deals", body: "Distressed off-market homes with real spread; rehab and ARV already estimated.", href: "/properties" },
      { title: "Buy-and-hold rentals", body: "Cash-flowing single-family and small multifamily priced to hit your return targets.", href: "/properties" },
      { title: "BRRRR properties", body: "Bought-right homes that fit buy-rehab-rent-refinance, with equity built in from day one.", href: "/properties" },
      { title: "Below-market & discount", body: "Off-market homes 30–50% under retail, direct from motivated sellers.", href: "/properties" },
      { title: "Small multifamily", body: "Duplexes through small apartment buildings with value-add upside.", href: "/properties" },
      { title: "Probate & inherited", body: "Off-market homes from estates and inherited owners — often the deepest discounts we see.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We source off-market investment properties across {City} and nearby — browse by area:",
      singleLine: "We source off-market investment properties throughout {City} and the surrounding area.",
    },
  },
  rto: {
    label: "Rent-to-own buyers",
    eyebrow: "Rent-to-own homes",
    headline: "Rent-to-own homes in {City} — move in now, buy when you're ready.",
    subhead:
      "Bad credit, self-employed, or just not bank-ready yet? {Brand} matches you with rent-to-own homes so you can settle in today and own it down the road — no bank required to get started.",
    stat: "A real path to owning — even if the bank said no",
    formTitle: "Find your rent-to-own home",
    formSubtitle: "New lease-to-own homes, by text and email.",
    ctaLabel: "Send me homes",
    bannerCta: "Get rent-to-own homes",
    features: [
      { icon: "🔑", title: "Move in now", body: "Get into a home today and lock in your option to buy it later. No waiting years to qualify first." },
      { icon: "🤝", title: "Credit isn't a dealbreaker", body: "Bad credit, thin credit, self-employed — we work with where you are, not just a score." },
      { icon: "🏡", title: "A path to ownership", body: "Part of your rent goes toward the purchase. You're building toward owning, not renting forever." },
    ],
    announcement: "New rent-to-own homes in {City} every week — join free and see them first.",
    howItWorks: [
      { title: "Tell us what you need", body: "Bedrooms, budget, the areas you want. Thirty seconds, and no credit pull to get started." },
      { title: "Get matched homes", body: "We text you rent-to-own homes that fit, with the terms in plain English." },
      { title: "Move in, then buy", body: "Pick your home, move in, and work toward owning it on a timeline that fits your life." },
    ],
    faqs: [
      { q: "Can I do this with bad credit?", a: "Often, yes. Rent-to-own is built for buyers who aren't bank-ready yet. We look at the whole picture, not just a number, and help you work toward qualifying." },
      { q: "How does rent-to-own actually work?", a: "You move in and rent the home now with the right to buy it later at a set price. A portion of what you pay can go toward the purchase, so you build toward ownership while you live there." },
      { q: "Do I need a big down payment?", a: "Usually far less than a traditional purchase. We'll walk you through the exact terms on any home before you commit — no surprises." },
      { q: "Is this a scam? How are you different?", a: "Fair question; there are bad actors out there. We put every term in writing, in plain English, and never pressure you. If a home isn't right for you, we'll say so." },
      { q: "What if my credit improves faster than expected?", a: "Even better — you can move toward buying sooner. The goal is to get you owning, not to keep you renting." },
      { q: "How do I stop getting texts?", a: "Reply STOP anytime and you're off the list instantly." },
    ],
    about: {
      headline: "We help families get into a home — and onto the path to owning it.",
      body: "{Brand} works with buyers in {City} who are ready for a home but aren't bank-ready yet. We match you with rent-to-own homes, explain every term in plain English, and help you move toward ownership at a pace that fits your life. No judgment, no pressure — just a real path forward for people the traditional system overlooks.",
      trust: ["Clear terms, in writing", "No credit pull to start", "Real path to ownership"],
    },
    prose: [
      {
        eyebrow: "How it works",
        heading: "Rent-to-own: move in today, buy when you're ready.",
        bodyHtml:
          "<p>If you're ready to stop renting but the bank keeps saying \"not yet,\" you're not out of options. A <b>rent-to-own home</b> lets you move in now and lock in the right to buy the home later, at a price set up front. Part of what you pay each month can go toward the purchase — so instead of handing a landlord money you'll never see again, you're building toward owning the place you live in.</p><p>{Brand} matches buyers in {City} with <b>lease-to-own homes</b> and walks you through every term in plain English. Bad credit, thin credit, self-employed income — we look at your whole situation, not just a score, and help you map the path to qualifying. <a href='/how-it-works'>See how rent-to-own works →</a></p>",
        pullQuote: "The goal isn't to keep you renting. It's to get you owning.",
      },
      {
        eyebrow: "Rent-to-own in {City}",
        heading: "Finding a rent-to-own home in {City} — without the runaround.",
        bodyHtml:
          "<p>Good <b>rent-to-own homes in {City}</b> go fast, and a lot of what's online is outdated or too good to be true. We keep a current list of real lease-to-own homes and send them to our buyers the moment they're available — with honest terms and zero pressure.</p><p>Tell us your budget and the areas you'd like to live, and we'll only send homes that actually fit, and that you have a real shot at owning. <a href='/get-on-the-list'>Join free</a> and see what's available before it's gone.</p>",
      },
    ],
    types: [
      { title: "Single-family rent-to-own", body: "Houses you can move into now and buy later: yards, garages, room to grow.", href: "/properties" },
      { title: "Bad-credit friendly", body: "Homes open to buyers still working on credit. Your score isn't the whole story.", href: "/properties" },
      { title: "Self-employed & 1099", body: "Paths for buyers whose income doesn't fit a bank's box but who can clearly afford a home.", href: "/properties" },
      { title: "Low-down-payment options", body: "Get into a home with far less up front than a traditional purchase.", href: "/properties" },
      { title: "Flexible move-in", body: "Homes available now; move in on a timeline that works for your family.", href: "/properties" },
      { title: "Path-to-purchase terms", body: "Clear, written terms that put part of your rent toward owning the home.", href: "/properties" },
    ],
    areas: {
      heading: "Where we have homes",
      intro: "We have rent-to-own homes across {City} and nearby — browse by area:",
      singleLine: "We work with rent-to-own homes throughout {City} and the surrounding area.",
    },
  },
  owner: {
    label: "Owner-finance buyers",
    eyebrow: "Owner-financed homes",
    headline: "Owner-financed homes in {City} — buy direct from the owner, skip the bank.",
    subhead:
      "{Brand} matches you with homes you can buy on owner financing — flexible terms, faster closings, and no bank underwriting standing between you and the keys.",
    stat: "Buy on terms — no bank required",
    formTitle: "Find owner-financed homes",
    formSubtitle: "New seller-financed homes, by text and email.",
    ctaLabel: "Send me homes",
    bannerCta: "Get owner-financed homes",
    features: [
      { icon: "🏦", title: "Skip the bank", body: "Buy directly from the owner on agreed terms. No mortgage application, no underwriting maze." },
      { icon: "⚡", title: "Close faster", body: "Without a bank in the middle, owner-financed deals can close in a fraction of the time." },
      { icon: "🤝", title: "Flexible terms", body: "Down payment, rate, and length are negotiated between you and the owner — room to fit your situation." },
    ],
    announcement: "New owner-financed homes in {City} every week — join free to see them first.",
    howItWorks: [
      { title: "Tell us what you want", body: "Budget, the down payment you can put down, and the areas you like. Thirty seconds." },
      { title: "Get matched homes", body: "We text you owner-financed homes that fit, with the terms spelled out clearly." },
      { title: "Agree terms and close", body: "Negotiate directly with the owner, sign, and get your keys — no bank approval needed." },
    ],
    faqs: [
      { q: "How is owner financing different from a normal mortgage?", a: "Instead of borrowing from a bank, you buy directly from the owner and pay them over time on agreed terms. No bank application, no underwriting — just you and the seller." },
      { q: "Do I need perfect credit?", a: "Usually not. Owner financing is far more flexible than a bank loan; the terms are set between you and the owner, so your situation matters more than a single score." },
      { q: "How big a down payment do I need?", a: "It varies by home and owner; some are flexible. We'll show you the exact terms on any property before you commit." },
      { q: "Is owner financing legit and safe?", a: "Yes — it's a long-established way to buy. Every deal is documented properly, and we make sure the terms are clear and in writing before you sign." },
      { q: "Can I refinance into a bank loan later?", a: "Often, yes. Many buyers use owner financing to get into the home now and refinance once they qualify with a bank." },
      { q: "How do I stop the texts?", a: "Reply STOP anytime to opt out instantly." },
    ],
    about: {
      headline: "Buy a home on your terms — straight from the owner.",
      body: "{Brand} matches buyers in {City} with owner-financed homes — properties you can purchase directly from the seller, without a bank in the middle. We explain every term clearly, keep the process honest, and help buyers who don't fit a bank's box get into a home they own. Flexible terms, faster closings, real ownership.",
      trust: ["Clear terms, in writing", "No bank underwriting", "Faster closings"],
    },
    prose: [
      {
        eyebrow: "How it works",
        heading: "Owner financing: buy the home, skip the bank.",
        bodyHtml:
          "<p>Not everyone fits neatly into a bank's lending box — and not everyone wants to. With an <b>owner-financed home</b>, you buy directly from the seller and pay them over time on terms the two of you agree to. There's no mortgage application, no underwriting committee, and no months of bank red tape between you and the keys.</p><p>{Brand} matches buyers in {City} with <b>seller-financed homes</b> and lays out every term — down payment, rate, length — in plain English before you sign. It's a flexible, established way to own, especially if you're self-employed, rebuilding credit, or just want to close fast. <a href='/how-it-works'>See how owner financing works →</a></p>",
        pullQuote: "Your situation matters more than a single credit score.",
      },
      {
        eyebrow: "Owner financing in {City}",
        heading: "Finding owner-financed homes in {City}.",
        bodyHtml:
          "<p>Owner-financed homes don't sit on the open market for long, and they're rarely advertised clearly. We keep a current list of <b>owner-financed homes in {City}</b> and send them to our buyers as they come available — with the terms spelled out and nothing hidden.</p><p>Tell us your budget and how much you can put down, and we'll send the homes that genuinely fit. <a href='/get-on-the-list'>Join free</a> and see what's available before someone else does.</p>",
      },
    ],
    types: [
      { title: "Owner-financed houses", body: "Single-family homes you can buy directly from the owner on agreed terms.", href: "/properties" },
      { title: "Low-down-payment homes", body: "Properties where the owner is flexible on the money down.", href: "/properties" },
      { title: "Self-employed friendly", body: "Homes for buyers whose income doesn't fit a bank's box.", href: "/properties" },
      { title: "Credit-building path", body: "Buy now on owner terms, refinance with a bank once you qualify.", href: "/properties" },
      { title: "Owner-financed land", body: "Lots and acreage available directly from the owner on terms.", href: "/properties" },
      { title: "Faster-closing deals", body: "No bank in the middle means you can close in a fraction of the time.", href: "/properties" },
    ],
    areas: {
      heading: "Where we have homes",
      intro: "We have owner-financed homes across {City} and nearby — browse by area:",
      singleLine: "We work with owner-financed homes throughout {City} and the surrounding area.",
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
