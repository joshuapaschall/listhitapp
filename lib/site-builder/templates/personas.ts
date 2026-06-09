import type { PersonaContent, SitePersona } from "../types"

// Buyer-acquisition / list-building copy. The site owner is a
// wholesaler/investor/agent building a buyer list; the visitor is the buyer.
export const PERSONAS: Record<SitePersona, PersonaContent> = {
  cash: {
    label: "Cash buyers",
    eyebrow: "Off-market cash deals",
    headline: "Get our best off-market deals before anyone else.",
    subhead:
      "Join our cash buyers list and get new wholesale and off-market properties — 30 to 50% under retail — the moment we lock them up. By text and email. Free to join.",
    stat: "New off-market deals, sent first",
    formTitle: "Get deals sent to you",
    formSubtitle: "New off-market properties, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🏠", title: "Off-market access", body: "Deals direct from distressed sellers, probate, and tax-delinquent owners — never on the MLS." },
      { icon: "⚡", title: "You move first", body: "Buyers on the list get every new deal by text the moment we lock it up." },
      { icon: "💵", title: "Free to join", body: "No fees, no contracts. We make money on the deals, not on the list." },
    ],
    announcement: "New off-market deals every week — join free and get them first.",
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
      { q: "How do I get off the list?", a: "Reply STOP to any text and you're out instantly. Re-join anytime." },
    ],
    about: {
      headline: "We find the deals. You buy them right.",
      body: "{Brand} is a wholesale team that locks up off-market properties and passes them straight to our buyer list — no retail markups, no bidding wars, just clean deals with real spread for serious buyers. We'd rather send you one deal you actually close than flood you with junk.",
      trust: ["Numbers you can trust", "We close on time", "Built for repeat buyers"],
    },
  },
  investor: {
    label: "Investor buyers",
    eyebrow: "Vetted investment deals",
    headline: "Funded deals, straight to your inbox.",
    subhead:
      "We send vetted flip and rental opportunities to our private investor network before they ever hit the market — with the numbers already run.",
    stat: "Funded-ready deals, matched to you",
    formTitle: "Join the investor list",
    formSubtitle: "Deal alerts by text and email.",
    ctaLabel: "Get the deals",
    bannerCta: "Join the investor list",
    features: [
      { icon: "📊", title: "Numbers already run", body: "Every deal comes with the spread, ARV, and rehab estimate so you can decide fast." },
      { icon: "🎯", title: "First look", body: "Our network sees opportunities before they reach the broader market." },
      { icon: "📈", title: "Built-in equity", body: "We've already negotiated the discount — you close with equity in place." },
    ],
    announcement: "New funded-ready deals weekly — sent to our investor list first.",
    howItWorks: [
      { title: "Join the list", body: "Tell us your buy box: flip, rental, price, area." },
      { title: "Get vetted deals", body: "We send underwritten opportunities with the math done." },
      { title: "Close with equity", body: "Reply to claim it; we hand you a clean, title-ready contract." },
    ],
    faqs: [
      { q: "How are deals vetted?", a: "We run comps, rehab, and ARV before sending — you see the math." },
      { q: "What returns should I expect?", a: "Varies by deal; every listing shows the spread so you judge for yourself." },
      { q: "Do you provide comps?", a: "Yes — comps and a repair estimate ship with each deal." },
      { q: "Is there a fee?", a: "No fee to join. We profit on the wholesale spread." },
      { q: "How do I stop alerts?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Deals that pencil — sent to buyers who close.",
      body: "{Brand} sources off-market flips and rentals and underwrites them before they ever reach you. We work with a tight network of serious investors because reliable closers get the best deals first.",
      trust: ["Underwriting included", "We close on time", "Repeat-buyer first"],
    },
  },
  rto: {
    label: "Rent-to-own buyers",
    eyebrow: "Rent-to-own homes",
    headline: "Own the home you're renting — no bank needed.",
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
    announcement: "New rent-to-own homes added weekly — see what you qualify for.",
    howItWorks: [
      { title: "Tell us what you want", body: "Bedrooms, area, budget — takes a minute." },
      { title: "Get matched", body: "We text you rent-to-own homes you can qualify for." },
      { title: "Move in & build", body: "Settle in and work toward owning, on terms that fit." },
    ],
    faqs: [
      { q: "Do I need good credit?", a: "No — past issues are okay; we look at your full situation." },
      { q: "How much do I need down?", a: "It varies by home; we'll tell you up front, no surprises." },
      { q: "Is this a scam?", a: "No. You'll see the home, the terms, and the path to owning in writing." },
      { q: "How long until I own?", a: "Depends on the agreement — we explain the timeline before you commit." },
      { q: "How do I start?", a: "Tell us what you want above and we'll match you." },
    ],
    about: {
      headline: "A real path to owning — even if the bank said no.",
      body: "{Brand} connects renters with rent-to-own homes and walks you through every step. No confusing fine print, no pressure — just an honest route from renting to owning.",
      trust: ["Credit-friendly", "Clear, simple terms", "Real homes, real owners"],
    },
  },
  owner: {
    label: "Owner-finance buyers",
    eyebrow: "Owner financing available",
    headline: "Buy a home with owner financing.",
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
    announcement: "New owner-financed homes weekly — skip the mortgage maze.",
    howItWorks: [
      { title: "Tell us your budget", body: "What you can put down and pay monthly." },
      { title: "Get matched", body: "We send owner-financed homes that fit." },
      { title: "Close with the seller", body: "Simple terms, no bank — we guide you through it." },
    ],
    faqs: [
      { q: "What is owner financing?", a: "You pay the seller directly over time instead of getting a bank loan." },
      { q: "Do I need a big down payment?", a: "It's flexible and set per home — we tell you before you commit." },
      { q: "Can I qualify if I'm self-employed?", a: "Often yes — sellers look at the whole picture." },
      { q: "Are the terms fair?", a: "You'll see every term in writing before agreeing to anything." },
      { q: "How do I start?", a: "Tell us your budget above and we'll match you." },
    ],
    about: {
      headline: "Homeownership without the bank's hoops.",
      body: "{Brand} matches buyers to owner-financed homes and makes the terms plain. If the traditional mortgage road hasn't worked, there's a simpler one — and we'll walk it with you.",
      trust: ["No bank required", "Terms that fit you", "Honest, plain paperwork"],
    },
  },
  creative: {
    label: "Creative-terms buyers",
    eyebrow: "Creative & flexible terms",
    headline: "Flexible terms for serious buyers.",
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
    announcement: "New creative-terms deals weekly — structured to fit your goals.",
    howItWorks: [
      { title: "Tell us your strategy", body: "Subject-to, lease option, seller finance — your play." },
      { title: "Get matched deals", body: "We send structures that fit your goals first." },
      { title: "Lock it up", body: "Reply to claim it; we help structure the terms." },
    ],
    faqs: [
      { q: "What's \"subject-to\"?", a: "Buying a property while leaving the existing financing in place — we explain each structure." },
      { q: "Do you only do creative deals?", a: "We focus on flexible structures, but cash deals come through too." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How fast do these move?", a: "Quickly — being on the list is the edge." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Deals most buyers can't see — structured to work.",
      body: "{Brand} sources properties that fit creative structures — subject-to, lease options, seller financing — and matches them to buyers who know how to use them.",
      trust: ["Structured to fit", "Off-market first", "Real profit room"],
    },
  },
  land: {
    label: "Land buyers",
    eyebrow: "Off-market land & lots",
    headline: "Off-market land deals, priced to move.",
    subhead:
      "Raw land, lots, and acreage at investor prices. Join our list and get first access before they hit the open market.",
    stat: "Off-market land & lots",
    formTitle: "Get land deals",
    formSubtitle: "New parcels by text and email.",
    ctaLabel: "Join the land list",
    bannerCta: "Get land deals",
    features: [
      { icon: "🌄", title: "Below-market parcels", body: "Raw land, lots, and acreage at prices the open market never sees." },
      { icon: "⚡", title: "First access", body: "Get new parcels by text the moment we have them." },
      { icon: "🖊️", title: "Close remotely", body: "Sign online and close from anywhere — no site visit required." },
    ],
    announcement: "New off-market land & lots weekly — priced to move.",
    howItWorks: [
      { title: "Join the list", body: "Tell us the type and area of land you buy." },
      { title: "Get parcels by text", body: "We send new land with price and key details." },
      { title: "Close remotely", body: "Reply to claim it and close from anywhere." },
    ],
    faqs: [
      { q: "What kind of land?", a: "Raw land, residential lots, and acreage — tell us your target." },
      { q: "Can I close remotely?", a: "Yes — most buyers close online without a visit." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How are prices set?", a: "Below market — we send the numbers so you judge." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Land deals before they hit the market.",
      body: "{Brand} sources off-market parcels — raw land, lots, and acreage — and sends them to land buyers first, at prices that leave room to profit.",
      trust: ["Below-market parcels", "First access", "Close from anywhere"],
    },
  },
  commercial: {
    label: "Commercial buyers",
    eyebrow: "Commercial opportunities",
    headline: "Commercial deals for serious investors.",
    subhead:
      "Multifamily, retail, and mixed-use opportunities sent to our private commercial buyer network before they reach the broader market.",
    stat: "Multifamily, retail & mixed-use",
    formTitle: "Join the network",
    formSubtitle: "Off-market commercial deals.",
    ctaLabel: "Get commercial deals",
    bannerCta: "Join the network",
    features: [
      { icon: "🏢", title: "Off-market commercial", body: "Multifamily, retail, and mixed-use before they reach the broader market." },
      { icon: "📊", title: "Underwriting included", body: "Each opportunity comes with the figures you need to move quickly." },
      { icon: "🎯", title: "First look", body: "Our private network sees deals first." },
    ],
    announcement: "New commercial opportunities weekly — sent to our network first.",
    howItWorks: [
      { title: "Join the network", body: "Tell us asset class, size, and target markets." },
      { title: "Get underwritten deals", body: "We send opportunities with the figures done." },
      { title: "Move fast", body: "Reply to engage; we coordinate the next steps." },
    ],
    faqs: [
      { q: "What asset classes?", a: "Multifamily, retail, mixed-use — tell us your focus." },
      { q: "Do you provide underwriting?", a: "Yes — figures ship with each opportunity." },
      { q: "Is this confidential?", a: "Yes — deals go to a private network." },
      { q: "Is there a fee?", a: "No fee to join." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Commercial opportunities, off-market and underwritten.",
      body: "{Brand} sources multifamily, retail, and mixed-use opportunities and sends them to a private network of serious buyers — with the underwriting already in hand.",
      trust: ["Underwriting included", "Off-market first", "Serious-buyer network"],
    },
  },
  agent: {
    label: "Agents & realtors",
    eyebrow: "Off-market & coming soon",
    headline: "Get my listings before anyone else.",
    subhead:
      "Be the first to know about my off-market and coming-soon listings. Join my private buyer list and never miss a deal.",
    stat: "First access to my listings",
    formTitle: "Get first access",
    formSubtitle: "Coming-soon listings by text and email.",
    ctaLabel: "Join my VIP list",
    bannerCta: "Join the VIP list",
    features: [
      { icon: "⭐", title: "Coming-soon first", body: "See my off-market and coming-soon listings before they hit the portals." },
      { icon: "🎯", title: "Matched to your search", body: "Tell me what you want and I'll only send what fits." },
      { icon: "🔕", title: "No portal noise", body: "No spam, no junk — just real listings worth your time." },
    ],
    announcement: "New off-market & coming-soon listings weekly — for my VIP buyers.",
    howItWorks: [
      { title: "Join my list", body: "Tell me what you're looking for." },
      { title: "Get listings first", body: "I text you matches before they hit the portals." },
      { title: "Tour & write", body: "See one you love? Reply and we move on it." },
    ],
    faqs: [
      { q: "Is this free?", a: "Yes — free to join my list." },
      { q: "Will you spam me?", a: "No — only listings that match what you told me." },
      { q: "Do I have to use you as my agent?", a: "Joining the list is no-obligation; we can talk when something fits." },
      { q: "How fast do listings go?", a: "Fast — being on the list is how you see them first." },
      { q: "How do I stop?", a: "Reply STOP anytime." },
    ],
    about: {
      headline: "Your inside track to homes before they list.",
      body: "I send my off-market and coming-soon listings to a private buyer list first. If you're serious about finding the right home, this is how you see it before everyone else.",
      trust: ["Coming-soon first", "Matched to you", "No portal noise"],
    },
  },
}

export function getPersona(id: SitePersona): PersonaContent {
  return PERSONAS[id] || PERSONAS.cash
}

// Shared, owner-editable placeholder reviews (not persona-specific). The owner
// replaces these in the editor; they ship as realistic defaults.
export const PLACEHOLDER_REVIEWS: { quote: string; author: string }[] = [
  { quote: "Closed 4 deals from this list in six months. The numbers are real and they move fast.", author: "Marcus T." },
  { quote: "Finally someone who sends actual deals, not junk. First one I got, I bought it.", author: "Dana K." },
  { quote: "I was on three other lists getting garbage. This is the only one I read now.", author: "Priya R." },
]
