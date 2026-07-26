# Constitution — Tally

*A calm, honest way to see where your money goes.*

---

## 1. Mission

Money apps make people feel bad — guilty, behind, judged by a red number. This app exists to remove that anxiety. It shows people the shape of their spending without lecturing them, and it lets couples see money together without either person feeling watched.

**North star:** opening the app should feel like checking the weather, not opening a report card.

---

## 2. Core Principles

**Calm over urgent.** No red alert banners, no shame-based nudges, no "you overspent!" push notifications. Insight is delivered quietly — a soft color shift, a gentle number, never a warning siren.

**Clarity over cleverness.** Every screen should be understandable in under 3 seconds. If a feature needs an explainer tooltip to be usable, the design failed, not the user.

**Show, don't lecture.** The app surfaces patterns ("you spend more on weekends") and lets the user draw their own conclusions. It never moralizes about what they bought.

**One primary view, mastered.** The calendar view is the product's identity — the thing competitors don't do. Every other view (list, category, trends) supports it; none competes with it for attention.

**Individually private, optionally shared.** Couples should default to *their own* view of their own spending. Shared visibility is something you turn on, not something the app assumes.

**Slow, deliberate motion.** Transitions are soft and unhurried — nothing snaps or jolts. Financial data deserves the same unhurried pacing as checking a bank balance in person, not the frantic energy of a stock ticker.

---

## 3. Visual Identity

**Palette:** Mostly neutral — off-white or near-black base depending on theme, generous negative space. One quiet accent color carries the whole brand (soft, desaturated — think sage, dusty rose, or muted coral rather than bank-app blue or alarm red). Category colors are muted pastels, never harsh or saturated; nothing should visually shout.

**Typography:** A single confident, rounded sans-serif. Numbers get slightly more visual weight than labels — the dollar amount is the hero, not the icon next to it. Avoid tabular, cold, spreadsheet-style numerals; numbers should feel human, not accounting-software sterile.

**Space:** Generous padding everywhere. When in doubt, remove an element rather than shrink it. Density is the enemy of calm.

**Iconography:** Soft, rounded, minimal line icons — never skeuomorphic, never cartoonish. Category icons should be identifiable at a glance without color-coding alone (accessibility).

**Motion:** Gentle fades and slides, ~250–350ms, ease-out. No bounce, no spring overshoot on financial numbers — that reads as playful/game-like, which undercuts trust.

---

## 4. Voice & Tone

Plain language. No finance jargon ("net cash flow," "MoM variance") unless the user is clearly power-user-mode. Write the way a smart friend would explain your spending to you over coffee.

- ✅ "You spent more on food this week than usual."
- ❌ "Discretionary dining expenditure exceeded your 7-day rolling average by 23%."

Never guilt, never congratulate performatively. Insight is neutral and factual; the user decides how to feel about it.

Empty states and onboarding copy should feel warm and a little witty — this is the one place personality shows. Everywhere money is actually shown, tone gets quieter and more precise.

---

## 5. Product Priorities (in order)

1. **The calendar view is non-negotiable and must be excellent** before any other view ships polish.
2. **Couple sharing is a first-class citizen**, not a bolt-on — build the data model for multi-user from day one, even if v1 ships solo-only.
3. **Manual entry must be as fast as bank sync.** Some users won't connect a bank (trust, or unsupported institution) — they shouldn't get a worse product.
4. **Categorization should be smart but always overridable** in one tap. Auto-categorization that can't be corrected instantly breaks trust immediately.
5. **No feature ships that requires a tutorial.** If it does, redesign it.

---

## 6. Monetization Philosophy

The subscription buys *calm and clarity*, not features gated behind anxiety. Never paywall the core insight (seeing where money went) — paywall depth and convenience (bank sync limits, couple sharing, multi-year history, export). The free tier should still feel respectful and complete, not a crippled demo designed to annoy people into paying.

Weekly and annual pricing, consistent with your existing apps — but copy around pricing should be as calm and jargon-free as the rest of the product. No countdown timers, no fake urgency.

---

## 7. What This App Will Never Do

- Send anxiety-inducing push notifications about spending
- Use red/alarm colors for normal spending information
- Shame, rank, or compare the user against strangers
- Default to sharing a partner's data without explicit opt-in
- Require jargon fluency to understand your own money
- Make the free tier deliberately annoying to use

---

*This document is the filter for every design and feature decision. If something doesn't fit here, it doesn't ship — or this constitution needs to be revisited on purpose, not drifted from by accident.*
