# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Coaster enthusiasts: anyone who keeps a roller coaster count and wants to track,
rank and compare it. The current riders are Carter and a group of about a dozen
friends, but the product is meant for any enthusiast, not only that group.
Their jobs: log the rides from a park day (often in the park, on a phone), keep a
ranked list of favorites, and see how their count and rankings compare with
other riders'.

## Product Purpose
Coaster Hub is one place for a rider's whole coaster life: every credit and re-ride,
every park visited, a ranked list of favorites, and a shared database of parks and
coasters behind it. Success is a rider who keeps their count here instead of in a
spreadsheet or on another site, and who comes back to rank, compare and log.

## Positioning
Four things together, which the neighbors (coaster-count.com, Captain Coaster, a
spreadsheet) do not combine:
- **Rankings people agree on.** Each rider's ordered list, combined into Global
  rankings (average position across lists, 2+ lists to count); categories so the
  same ride at several parks is ranked once; Rank more to place unranked credits.
- **Friends side by side.** Following, friend activity, and comparing counts, maps
  and rankings with another rider.
- **Fast logging on a phone.** A park day or a single ride logged in the moment.
- **A clean shared database.** One curated list of parks, coasters, manufacturers
  and models that riders add to and fix together.

## Operating Context
- Mostly used on an iPhone, in Safari or as a home-screen web app; desktop second.
- Logging happens at parks, on mobile data, between rides.
- Ranking happens at home, in long sessions of dragging and comparing.
- Data lives in Cloudflare D1 behind a Worker; static JSON snapshots are the offline
  fallback. Accounts are per rider; one admin maintains the shared database.

## Capabilities and Constraints
- Pages: home (search, friends, friend activity, top users), /users, profiles,
  /credits (rides, parks, coasters views), /rankings (mine, global, categories,
  Rank more), /log, /add, /import, coaster, park, manufacturer, model and location
  pages, /map, /changes, /sitemap, /install.
- Stack is fixed: static HTML/CSS/vanilla JS on Cloudflare Workers with D1 and R2.
  No framework, no build step.
- Terminology: "credit" = a distinct coaster ridden; "ride" = one ride, re-rides
  included; "defunct" = closed coaster (shown last, in grey); "operating".
- Dates read "Sep 27, 2026"; lists default to A–Z.
- Laps are hidden sitewide until there is a standard for them (open decision).
- Major changes (navigation, page structure, whole-page redesigns) are proposed
  to Carter first; fixes and small improvements ship straight to main.

## Brand Commitments
- Name: Coaster Hub (coasterhub.org); the blue map-pin mark.
- Mobile first: the phone layout is the primary one.
- Light and dark themes are both first-class. Day is a light sky; night is a deep
  blue, with the hero's park skyline lit at night.
- Plain, direct voice. Minimal decoration, nothing that reads as generated filler.

## Evidence on Hand
- Real riders and real data: about a dozen accounts, ~1,000 operating coasters,
  ~250 parks, thousands of logged rides, several hundred ranked coasters.
- No testimonials, press, user counts beyond the database, or public metrics
  exist. Do not invent any.

## Product Principles
1. The rider's own count is the product; everything else helps them keep it, rank
   it or compare it.
2. Fast on a phone beats complete on a desktop.
3. One shared truth: a fix to the database helps every rider, and lists everywhere
   use the same rows and conventions.
4. Comparison is social, not competitive noise: friends first, then everyone.
5. Earn trust with accuracy: real counts, correct dates, no fabricated numbers.
