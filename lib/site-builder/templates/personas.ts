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
    headline: "Off-market wholesale deals in {City} — sent to cash buyers first.",
    subhead:
      "Join {Brand}'s cash buyers list and get new off-market and wholesale properties — 30 to 50% under retail — the moment we lock them up. By text and email. Free to join.",
    stat: "New off-market deals, sent first",
    formTitle: "Get deals sent to you",
    formSubtitle: "New off-market properties, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🏠", title: "Off-market access", body: "Deals direct from distressed sellers, probate, and tax-delinquent owners — never on the MLS." },
      { icon: "⚡", title: "You move first", body: "Cash buyers on the list get every new deal by text the moment we lock it up. First to reply, first to lock it." },
      { icon: "💵", title: "Free to join", body: "No fees, no contracts. We make our money on the deals, not on the list." },
    ],
    announcement: "New off-market deals in {City} every week — join free and get them first.",
    howItWorks: [
      { title: "Join the list", body: "Drop your name and number. It takes 30 seconds and it's free." },
      { title: "Get deals by text", body: "We text you new properties with the price, repairs, and ARV already run." },
      { title: "Lock it up", body: "See one you like? Reply and we hand you the contract. Close fast, all cash." },
    ],
    faqs: [
      { q: "Is it really free to join?", a: "Yes. No fee, no subscription, no contract. We make our money on the deals we wholesale, not on the list." },
      { q: "Do I have to buy anything?", a: "Never. You'll get deals as we lock them up; buy when one fits your numbers and ignore the rest." },
      { q: "How fast do I need to act?", a: "The best deals move quickly, so being on the list and replying fast is the edge. We always give you the numbers up front so you can decide." },
      { q: "What kind of properties do you send?", a: "Mostly off-market single-family homes that need work — flips and rentals — plus the occasional multifamily, direct from motivated sellers." },
      { q: "Do I need to be a cash buyer?", a: "Cash and hard money close fastest and get first look. If you fund another way, tell us and we'll send deals you can actually close." },
      { q: "How do I get off the list?", a: "Reply STOP to any text and you're out instantly. Re-join anytime." },
    ],
    about: {
      headline: "We find the deals. You buy them right.",
      body: "{Brand} is a wholesale team that locks up off-market properties across {City} and the surrounding area, then passes them straight to our cash buyers list — no retail markup, no bidding wars, just clean deals with real spread for serious buyers. We'd rather send you one deal you actually close than flood you with junk.",
      trust: ["Numbers you can trust", "We close on time", "Built for repeat buyers"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market wholesale deals, before anyone else sees them.",
        bodyHtml: `<p>The deals worth buying rarely hit the MLS — by the time a property is listed, the spread is gone. {Brand} works the off-market side: we find motivated sellers across {City} — distressed, probate, tax-delinquent, tired landlords — lock up the property, and send it straight to our <b>cash buyers</b> list with the price, repairs, and ARV already run. <b>Wholesale deals</b> 30 to 50% under retail, the moment they're available.</p><p>You see the numbers up front and decide fast — no chasing, no bidding war. It's free to join, no contract, and we make our money on the deal spread, not on you. <a href="/how-it-works">See exactly how it works →</a></p>`,
        pullQuote: "We'd rather send you one deal you actually close than flood you with junk.",
      },
      {
        eyebrow: "Buying in {City}",
        heading: "Where our off-market deals in {City} come from.",
        bodyHtml: `<p>Motivated sellers are everywhere in {City} — owners facing foreclosure, inherited homes nobody wants, burnt-out landlords, and properties too distressed for a retail sale. Those are the <b>off-market deals</b> with real spread, and finding them before they're ever listed is exactly what we do.</p><p>We publish new <a href="/properties">wholesale and discount properties</a> as we lock them up and text the buyers list first. Want first access? <a href="/get-on-the-list">Join the cash buyers list free</a> — it takes 30 seconds.</p>`,
      },
    ],
    types: [
      { title: "Fixer-uppers", body: "Distressed off-market homes that need work — the bread and butter of a good flip.", href: "/properties" },
      { title: "Wholesale deals", body: "Properties we've locked up and assign to you with real spread, 30–50% under retail.", href: "/properties" },
      { title: "Distressed & motivated-seller", body: "Homes from owners who need to sell fast — foreclosure, probate, tax-delinquent.", href: "/properties" },
      { title: "Buy-and-hold rentals", body: "Off-market single-family and small multifamily that cash-flow.", href: "/properties" },
      { title: "Below-market & discount", body: "Deals priced well under retail because we buy them right.", href: "/properties" },
      { title: "Probate & inherited", body: "Off-market homes from estates and inherited owners — often the deepest discounts.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We lock up off-market deals across {City} and nearby — browse by area:",
      singleLine: "We find off-market deals throughout {City} and the surrounding area.",
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
    label: "Creative-finance buyers",
    eyebrow: "Creative-finance deals",
    headline: "Creative-finance deals in {City} — control properties without all-cash or a bank.",
    subhead:
      "{Brand} sends off-market deals built for creative structures — subject-to, seller finance, wraps, and lease options — so you can acquire with little money down and terms that actually work.",
    stat: "Deals structured to close — low money down",
    formTitle: "Get creative-finance deals",
    formSubtitle: "Off-market, structurable deals — by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the deals list",
    features: [
      { icon: "🧩", title: "Deals you can structure", body: "Motivated sellers open to terms: subject-to, seller finance, wraps, lease options. The kind of deal a creative buyer can actually do." },
      { icon: "💡", title: "Low money down", body: "Acquire and control properties without bringing all-cash or qualifying for a bank loan." },
      { icon: "🥇", title: "First look at terms deals", body: "We surface sellers open to creative structures before they ever list, and send them to you first." },
    ],
    announcement: "New creative-finance deals in {City} weekly — sent to our buyers first.",
    howItWorks: [
      { title: "Tell us how you structure", body: "Subject-to, seller finance, lease option, wrap — and your buy box. Thirty seconds." },
      { title: "Get matched deals", body: "We text you off-market properties with sellers open to terms, the situation laid out." },
      { title: "Structure and close", body: "Reply to claim it; we connect you with the seller and you build the deal that works." },
    ],
    faqs: [
      { q: "What kind of creative deals do you send?", a: "Off-market properties where the seller is open to terms — subject-to, seller financing, lease options, and wraps. We tell you the seller's situation so you can structure it." },
      { q: "Do sellers actually agree to these terms?", a: "The ones we send do. We pre-qualify for motivation and openness to terms before a deal goes out, so you're not cold-pitching creative structures." },
      { q: "Do I need cash or credit?", a: "Far less than a traditional purchase. Creative deals are built to acquire with little money down and without bank qualifying — that's the whole point." },
      { q: "Is creative financing legal and clean?", a: "Yes, when it's documented right. We deal in real, properly-papered transactions and tell you the seller's exact situation up front." },
      { q: "Is there a fee to join?", a: "No. The list is free, no contract. We make our money on the deal spread, not on you." },
      { q: "How do I stop the texts?", a: "Reply STOP anytime to opt out instantly." },
    ],
    about: {
      headline: "Off-market deals built for creative buyers.",
      body: "{Brand} finds motivated sellers across {City} who are open to terms — subject-to, seller financing, lease options, and wraps — and sends those deals to a tight list of creative buyers first. We tell you the seller's real situation so you can structure a deal that closes with little money down. No bank, no bidding war, just deals you can actually do.",
      trust: ["Sellers pre-qualified for terms", "Low money down", "Built for creative buyers"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market deals built for creative financing.",
        bodyHtml:
          "<p>The best <b>creative-finance deals</b> never look like deals to the average buyer — they're motivated sellers with a problem, open to terms if someone shows up with a structure. {Brand} finds those sellers across {City} before they ever list, qualifies them for motivation and openness to terms, and sends the situation straight to our buyers. <b>Subject-to</b>, <b>seller financing</b>, lease options, wraps — the deals that let you control a property with little money down.</p><p>Instead of cold-pitching creative structures to skeptical sellers, you get properties where the door is already open. It's free to join, no contract, and we make our money on the spread, not on you. <a href='/how-it-works'>See how it works →</a></p>",
        pullQuote: "We don't send you listings. We send you sellers who are open to terms.",
      },
      {
        eyebrow: "Creative deals in {City}",
        heading: "Where creative-finance deals come from in {City}.",
        bodyHtml:
          "<p>Motivated sellers are everywhere in {City} — behind on payments, inherited a property they don't want, tired landlords, divorces, relocations. The ones open to <b>creative financing</b> are the deals a sharp buyer can turn into a low-money-down acquisition. Finding them and qualifying them is the hard part, and it's exactly what we do.</p><p>We send new structurable deals as they come in and tell you the seller's situation so you can move fast. <a href='/get-on-the-list'>Join free</a> and get first look before anyone else.</p>",
      },
    ],
    types: [
      { title: "Subject-to deals", body: "Take over the existing financing on a property; control it with little money down.", href: "/properties" },
      { title: "Seller-financed deals", body: "Buy directly from the owner on terms, no bank in the middle.", href: "/properties" },
      { title: "Lease-option deals", body: "Control now with the right to buy later, minimal money up front.", href: "/properties" },
      { title: "Wrap-around deals", body: "Structure a wrap where it makes sense and acquire without new bank debt.", href: "/properties" },
      { title: "Low-money-down deals", body: "Properties priced and positioned to acquire with minimal cash in.", href: "/properties" },
      { title: "Motivated-seller leads", body: "Off-market sellers open to terms, with the situation already qualified.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We find creative-finance deals across {City} and nearby — browse by area:",
      singleLine: "We find creative-finance deals throughout {City} and the surrounding area.",
    },
  },
  land: {
    label: "Land buyers",
    eyebrow: "Off-market land deals",
    headline: "Off-market land and acreage in {City} — priced below market, sent first.",
    subhead:
      "{Brand} sources off-market lots and acreage and sends them to our land buyers list before they hit the market — buildable parcels, recreational tracts, and investment land with real upside.",
    stat: "Off-market land, under market",
    formTitle: "Get land deals sent to you",
    formSubtitle: "New off-market lots and acreage, by text and email.",
    ctaLabel: "Send me land",
    bannerCta: "Join the land list",
    features: [
      { icon: "🌳", title: "Off-market parcels", body: "Lots and acreage direct from motivated owners, never on the open market, priced to move." },
      { icon: "📐", title: "The details up front", body: "Acreage, access, zoning, and utilities laid out so you know what you're buying before you drive out." },
      { icon: "🥇", title: "First look", body: "Our land list sees new parcels before they're listed. The good ones go fast." },
    ],
    announcement: "New off-market land in {City} every week — land list gets it first.",
    howItWorks: [
      { title: "Tell us what you're after", body: "Acreage, budget, area, and use: build, invest, or recreation. Thirty seconds." },
      { title: "Get matched parcels", body: "We text you off-market land that fits, with acreage, access, and zoning spelled out." },
      { title: "Lock it up", body: "Reply to claim it and we hand you a clean contract; close fast." },
    ],
    faqs: [
      { q: "What kind of land do you send?", a: "Buildable lots, larger acreage, recreational and hunting tracts, and investment land — all off-market and priced below retail." },
      { q: "Do you include zoning and access info?", a: "Yes. Every parcel comes with acreage, access, and what we know about zoning and utilities so you can evaluate it before driving out." },
      { q: "Is the land buildable?", a: "Some is build-ready, some is raw or recreational. We tell you which on every parcel, so there are no surprises." },
      { q: "Do you offer owner financing on land?", a: "On some parcels, yes. Where an owner is open to terms, we'll spell them out clearly." },
      { q: "Is there a fee to join?", a: "No. The list is free, no contract. We make our money on the deal spread, not on you." },
      { q: "How do I stop the texts?", a: "Reply STOP anytime to opt out instantly." },
    ],
    about: {
      headline: "Off-market land, priced to move — sent to buyers who act.",
      body: "{Brand} sources off-market lots and acreage across {City} and the surrounding area — buildable parcels, recreational tracts, and investment land — and sends them to our land buyers list before they're ever listed. We give you acreage, access, and zoning up front so you can move with confidence. No retail markup, no bidding war.",
      trust: ["Off-market parcels", "Details up front", "We close on time"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market land and acreage, before it's listed.",
        bodyHtml:
          "<p>The best <b>land deals</b> rarely make it to a listing site — they're motivated owners with raw lots, inherited acreage, or tax-burdened parcels who want a clean, fast sale. {Brand} sources these off-market across {City}, works out acreage, access, and zoning, and sends the parcel straight to our land buyers. Buildable lots, recreational tracts, investment <b>acreage</b> — priced below market because we buy them right.</p><p>You get the details up front so you're not driving an hour to a dead end, and you get first look before the parcel is ever advertised. Free to join, no contract. <a href='/how-it-works'>See how it works →</a></p>",
        pullQuote: "The best land never makes it to a listing site. That's where we work.",
      },
      {
        eyebrow: "Land in {City}",
        heading: "Finding off-market land and lots in {City}.",
        bodyHtml:
          "<p>Whether you're building, investing, or looking for recreational <b>acreage</b>, the right parcel in {City} is out there — it's just rarely on the open market. We track down off-market lots and land from motivated owners and send them to our buyers with acreage, access, and zoning spelled out.</p><p>Tell us the acreage and area you want, and we'll only send parcels that fit. <a href='/get-on-the-list'>Join free</a> and get first look at <a href='/properties'>land for sale</a> before it's listed.</p>",
      },
    ],
    types: [
      { title: "Buildable lots", body: "Build-ready parcels with access and utilities, priced below market.", href: "/properties" },
      { title: "Acreage & large tracts", body: "Bigger parcels for investment, development, or recreation.", href: "/properties" },
      { title: "Recreational & hunting land", body: "Tracts for hunting, camping, and getaways, away from the crowd.", href: "/properties" },
      { title: "Investment land", body: "Parcels in the path of growth, bought right for upside.", href: "/properties" },
      { title: "Owner-financed land", body: "Lots and acreage where the owner is open to terms.", href: "/properties" },
      { title: "Below-market parcels", body: "Off-market land 30–50% under retail, direct from motivated owners.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find land",
      intro: "We source off-market land across {City} and nearby — browse by area:",
      singleLine: "We source off-market land throughout {City} and the surrounding area.",
    },
  },
  commercial: {
    label: "Commercial buyers",
    eyebrow: "Off-market commercial deals",
    headline: "Off-market commercial and multifamily in {City} — with upside, sent first.",
    subhead:
      "{Brand} sources off-market commercial and multi-family deals — apartments, retail, office, and value-add plays — and sends them to our commercial buyers before they ever reach a broker's inbox.",
    stat: "Off-market commercial, with real upside",
    formTitle: "Get commercial deals sent to you",
    formSubtitle: "Off-market commercial and multifamily, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the commercial list",
    features: [
      { icon: "🏢", title: "Off-market & value-add", body: "Apartments, retail, office, and mixed-use direct from owners, including value-add plays the market hasn't seen." },
      { icon: "📊", title: "The numbers up front", body: "Units, rents, occupancy, and the value-add thesis laid out so you can screen it fast." },
      { icon: "🥇", title: "Before the broker", body: "Our list sees off-market commercial deals before they're packaged and shopped to the market." },
    ],
    announcement: "New off-market commercial and multifamily in {City} — buyers list gets it first.",
    howItWorks: [
      { title: "Tell us your criteria", body: "Asset type, size, market, and return targets. Thirty seconds." },
      { title: "Get matched deals", body: "We send off-market commercial and multi-family that fits, with the key numbers up front." },
      { title: "Lock it up", body: "Reply to move on it; we connect you to the deal and you close on your terms." },
    ],
    faqs: [
      { q: "What asset types do you send?", a: "Multi-family, retail, office, industrial, and mixed-use, with a focus on off-market and value-add opportunities." },
      { q: "Do you provide financials?", a: "We send the key numbers we have — units, rents, occupancy, and the value-add thesis — so you can screen fast and request the full package." },
      { q: "How off-market are these really?", a: "We source direct from owners before deals are packaged and shopped, so our buyers see them ahead of the broader market." },
      { q: "What deal sizes do you cover?", a: "From small multi-family up through larger commercial. Tell us your range and we'll match it." },
      { q: "Is there a fee to join?", a: "No. The list is free, no contract. We're compensated on the deal, not on you." },
      { q: "How do I stop the alerts?", a: "Reply STOP anytime to opt out instantly." },
    ],
    about: {
      headline: "Off-market commercial deals — sent to buyers who can close them.",
      body: "{Brand} sources off-market commercial and multi-family deals across {City} and the surrounding area — apartments, retail, office, and value-add plays — and sends them to a focused list of commercial buyers before they're ever shopped to the market. We give you the key numbers up front so you can screen quickly and act on the ones that fit.",
      trust: ["Off-market, pre-broker", "Numbers up front", "Built for serious buyers"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market commercial and multifamily, before it's shopped.",
        bodyHtml:
          "<p>By the time a <b>commercial</b> or <b>multi-family</b> deal is packaged and emailed around by a broker, the upside is usually priced in. {Brand} works upstream — we source off-market commercial deals across {City} directly from owners, including value-add plays the market hasn't seen, and send them to our buyers list with the key numbers up front.</p><p>That means you screen units, rents, occupancy, and the value-add thesis in minutes, and you see the deal before it becomes a bidding contest. Free to join, no contract — we're paid on the deal, not on you. <a href='/how-it-works'>See how it works →</a></p>",
        pullQuote: "We see the deal before it becomes a bidding war.",
      },
      {
        eyebrow: "Commercial in {City}",
        heading: "Where off-market commercial deals come from in {City}.",
        bodyHtml:
          "<p>{City} has owners ready to sell apartments, retail, and mixed-use quietly — tired operators, estates, partnership splits, and value-add properties that need a sharper hand. Those are the off-market <b>commercial real estate</b> deals with real upside, and finding them before they're shopped is what we do.</p><p>Tell us your asset type and return targets, and we'll send the deals that fit. <a href='/get-on-the-list'>Join free</a> and get first look at <a href='/properties'>commercial property for sale</a> before the broker blast.</p>",
      },
    ],
    types: [
      { title: "Multi-family & apartments", body: "Duplexes through apartment buildings, including value-add.", href: "/properties" },
      { title: "Retail & strip centers", body: "Off-market retail with occupancy or repositioning upside.", href: "/properties" },
      { title: "Office & medical", body: "Office and medical assets direct from owners.", href: "/properties" },
      { title: "Industrial & warehouse", body: "Industrial, flex, and warehouse in the path of demand.", href: "/properties" },
      { title: "Mixed-use", body: "Mixed-use buildings with multiple income streams.", href: "/properties" },
      { title: "Value-add plays", body: "Underperforming assets priced for a sharper operator to reposition.", href: "/properties" },
    ],
    areas: {
      heading: "Where we find deals",
      intro: "We source off-market commercial across {City} and nearby — browse by area:",
      singleLine: "We source off-market commercial deals throughout {City} and the surrounding area.",
    },
  },
  agent: {
    label: "Agents & realtors",
    eyebrow: "Off-market inventory for agents",
    headline: "Off-market and pocket listings in {City} — inventory to bring your buyers.",
    subhead:
      "{Brand} gives agents first access to off-market and pocket listings, so you can show your buyers properties no one else has — and win more clients and closings.",
    stat: "Off-market inventory to serve your clients",
    formTitle: "Get off-market inventory",
    formSubtitle: "New pocket listings, by text and email.",
    ctaLabel: "Send me listings",
    bannerCta: "Join the agent list",
    features: [
      { icon: "🗝️", title: "Inventory no one else has", body: "Off-market and pocket listings you can bring to your buyers when the MLS is dry." },
      { icon: "🤝", title: "Your client stays yours", body: "We feed you the inventory; you keep your buyer and your commission. We work the deal side." },
      { icon: "🥇", title: "First access", body: "Agents on our list see new off-market properties before they're ever listed or shopped." },
    ],
    announcement: "New off-market and pocket listings in {City} weekly — agents get first access.",
    howItWorks: [
      { title: "Tell us your buyers' boxes", body: "Areas, price, property type your clients want. Thirty seconds." },
      { title: "Get matched inventory", body: "We text you off-market and pocket listings that fit your buyers." },
      { title: "Bring your buyer", body: "Show it, write it up, and close: your client, your commission." },
    ],
    faqs: [
      { q: "Does this cut into my commission?", a: "No. You keep your buyer and your side of the deal. We make our money on the deal we control, not on your commission." },
      { q: "What kind of inventory is this?", a: "Off-market and pocket listings: distressed, motivated-seller, and wholesale properties that aren't on the MLS." },
      { q: "How do I show these to my clients?", a: "We give you the details to bring to your buyer; you handle the relationship and the closing as you normally would." },
      { q: "Is the inventory real and available?", a: "Yes. We control or represent the properties we send, so it's real inventory you can actually transact on." },
      { q: "Is there a cost to join?", a: "No. The list is free, no contract. We're compensated on the deal side, never on you." },
      { q: "How do I stop the texts?", a: "Reply STOP anytime to opt out instantly." },
    ],
    about: {
      headline: "Off-market inventory for agents who want an edge.",
      body: "{Brand} gives agents and realtors across {City} first access to off-market and pocket listings — distressed, motivated-seller, and wholesale properties that never hit the MLS. You bring the inventory to your buyers, keep your client and your commission, and win more business in a tight market. We handle the deal side; you look like the agent who always has something.",
      trust: ["Your client, your commission", "Real, transactable inventory", "First access"],
    },
    prose: [
      {
        eyebrow: "Why {Brand}",
        heading: "Off-market inventory to bring your buyers.",
        bodyHtml:
          "<p>When the MLS is dry, the agent who has something to show wins. {Brand} gives agents across {City} first access to <b>off-market</b> and <b>pocket listings</b> — distressed, motivated-seller, and wholesale properties that never hit the open market. You bring real inventory to your buyers when no one else can, and you keep your client and your commission.</p><p>We work the deal side; you work the relationship. It's free to join, with no contract — we make our money on the deal we control, not on your commission. <a href='/how-it-works'>See how it works →</a></p>",
        pullQuote: "Be the agent who always has something to show.",
      },
      {
        eyebrow: "For agents in {City}",
        heading: "Win more buyers in {City} with off-market inventory.",
        bodyHtml:
          "<p>Buyers in {City} are competing over a thin MLS, and the agent who can show them something off-market stands out. We send our agent list <b>pocket listings</b> and off-market deals as they come available, matched to the buyers you're working with.</p><p>Tell us what your clients are looking for, and we'll send inventory that fits. <a href='/get-on-the-list'>Join free</a> and get first access before these properties are ever listed.</p>",
      },
    ],
    types: [
      { title: "Pocket listings", body: "Off-market properties you can show buyers before they're listed.", href: "/properties" },
      { title: "Distressed & motivated-seller", body: "Below-market homes from sellers who need to move.", href: "/properties" },
      { title: "Wholesale inventory", body: "Controlled properties you can bring to your cash and investor clients.", href: "/properties" },
      { title: "Fixer-uppers", body: "Off-market homes that need work, for your flip and rehab buyers.", href: "/properties" },
      { title: "Investment properties", body: "Cash-flow and value-add deals for your investor clients.", href: "/properties" },
      { title: "Off-market land", body: "Lots and acreage for your land and builder clients.", href: "/properties" },
    ],
    areas: {
      heading: "Where we have inventory",
      intro: "We source off-market inventory across {City} and nearby — browse by area:",
      singleLine: "We source off-market inventory throughout {City} and the surrounding area.",
    },
  },
}

export function getPersona(id: SitePersona): PersonaContent {
  return PERSONAS[id] || PERSONAS.cash
}
