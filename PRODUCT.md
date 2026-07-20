# Product

## Register

product

## Users

Trust-&-safety and ML-data engineers at UGC platforms, social networks, and dataset
marketplaces that ingest large volumes of user-submitted or crawled images. Their
context: they need bulk NSFW triage but cannot (or will not) ship image bytes to a
third-party moderation API — for privacy, cost, or compliance reasons. They want an
on-device pipeline they can run with only B2 credentials, inspect, and extend.

## Product Purpose

A self-hosted, on-device content-moderation pipeline. It scores every image 0–1
(1 = NSFW) using LAION-AI's CLIP-based NSFW Detector (CLIP ViT-L/14 embeddings ->
AutoKeras safety classifier), entirely on the operator's hardware. Backblaze B2 is the
staging, routing, quarantine, and audit-log store: images are ingested, scored, routed
to approved/quarantine, and logged for compliance review. Success = an operator can
point it at a bucket, create a batch, run it, and trust the routing + audit trail
without shipping a single image to an external service.

## Brand Personality

Confident, precise, quietly professional. Voice is direct and free of hype. The
interface should feel like a modern developer tool — considered, calm, trustworthy —
built for people who review sensitive content and need the tool to stay out of the way.
It is built on a neutral foundation whose design carries craft through restraint.

## Anti-references

- **Generic AI/SaaS slop.** No gradient text, hero-metric templates, identical
  icon-card grids, tracked uppercase eyebrows, or decorative glassmorphism. These are
  the exact 2026 AI tells this kit exists to help builders avoid.
- **Over-branded / loud.** No heavy brand-color drenching, decorative motion, or flashy
  effects. It is scaffolding to be rebranded, not a hero page.
- **Toy / prototype feel.** No missing states, inconsistent components, or placeholder
  polish. Must read as production-grade.
- **Enterprise-drab.** No Bootstrap-era gray boxes or dense-but-lifeless admin-panel
  look. Considered, like modern dev tools (Linear, GitHub Primer, Stripe).

## Design Principles

- **Practice what you preach.** The kit itself must model the production quality it
  asks agents to produce. Slop here propagates into every project built on it.
- **Neutral foundation, easy to rebrand.** Identity lives in tokens (`globals.css`) and
  one config file. Screens are built from the shared UI kit so a rebrand is a token
  swap, not a rewrite.
- **Earned familiarity over novelty.** Use standard, trusted affordances (top bar +
  side nav, command palette, data tables). The tool disappears into the task.
- **Every state is designed.** Default, hover, focus, active, disabled, loading (skeleton),
  empty (teaches the interface), and error (says what's wrong + offers retry) — never
  half-shipped.
- **Consistency is the feature.** One button vocabulary, one form-control set, one icon
  style across every screen. Divergence is a bug.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥ 4.5:1, large/bold text ≥ 3:1, visible focus
indicators on every interactive element, full keyboard navigation, correct semantic
landmarks and heading order, labelled form controls, and a `prefers-reduced-motion`
alternative for every animation. Full light and dark theme parity.
