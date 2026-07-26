# Tally — icon & logo generation prompt

Use in Midjourney, Ideogram, ChatGPT image, or Figma AI.

## Primary prompt

```text
App icon and wordmark concept for “Tally”, a calm personal finance app (money planner).

Concept: a single soft mark that suggests quietly marking or tallying spending — not a bank, not a stock chart, not a piggy bank. Prefer an abstract glyph: a rounded vertical tally mark or a gentle check-stroke inside a soft rounded square, OR a minimal calendar-day motif with one quiet mark. Must read clearly at 29pt and 60pt.

Style: modern, warm, minimal. Soft rounded geometry. Generous padding inside the icon safe area. Matte, print-like finish — no gloss, no neon glow, no 3D bevel, no glassmorphism.

Color: warm off-white / parchment background (#F9F8F7). Single accent in muted sage olive (#486635). Dark ink for any optional wordmark (#32302F). No purple, no bright blue, no alarm red, no gold “wealth” clichés.

Typography (logo lockup only, separate from icon): rounded humanist sans-serif, confident but calm; word “Tally” only; optional tiny subtitle “Money planner” in lighter weight. Do not put the wordmark inside the app icon square.

Composition: deliver (1) app icon alone on #F9F8F7 with the sage mark centered, full-bleed square, no text; (2) horizontal logo lockup (mark + Tally) for marketing. Flat vector-friendly shapes, high contrast, accessible. Avoid emoji, coins, dollar signs, credit cards, bar charts, and busy calendars.
```

## Negative prompt (if supported)

```text
purple gradient, neon, 3D, glossy, crypto, dollar sign, piggy bank, stock chart, Inter font lookalike clutter, busy collage
```

## Asset targets (after generation)

| File | Notes |
|------|--------|
| `assets/icon.png` | 1024×1024 full-bleed app icon |
| `assets/android-icon-foreground.png` | Mark centered in ~66% safe zone |
| `assets/android-icon-background.png` | Solid `#f9f8f7` |
| `assets/splash-icon.png` | Mark on transparent or canvas |
| `assets/favicon.png` | Small square mark |
