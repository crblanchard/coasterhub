---
name: Coaster Hub
description: A coaster rider's count, rankings and park days, kept in one place.
colors:
  night-sky: "#080e20"
  night-panel: "#15203a"
  night-well: "#0b1228"
  night-ink: "#f3f4f6"
  night-muted: "#9ca8bb"
  night-signal-blue: "#4cc3ff"
  day-paper: "#f5f5f3"
  day-panel: "#ffffff"
  day-well: "#ebebe8"
  day-ink: "#16181b"
  day-muted: "#5f6770"
  day-signal-blue: "#0a6aa0"
  ride-yellow: "#ffcc1f"
  ride-yellow-ink: "#16181b"
  day-amber: "#b7791f"
  alarm-red-night: "#ff5a5f"
  alarm-red-day: "#d92c33"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.2rem, 5.6vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.7rem, 4vw, 2.4rem)"
    fontWeight: 800
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
  figure:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "tnum"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 700
    letterSpacing: "0.09em"
rounded:
  row: "10px"
  button: "12px"
  panel: "14px"
  card: "16px"
  pill: "999px"
spacing:
  hairline: "1px"
  tight: "8px"
  row: "12px"
  gutter: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ride-yellow}"
    textColor: "{colors.ride-yellow-ink}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-hero:
    backgroundColor: "{colors.ride-yellow}"
    textColor: "{colors.ride-yellow-ink}"
    rounded: "{rounded.row}"
    padding: "10px 18px"
  button-outline:
    backgroundColor: "{colors.day-panel}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.row}"
    padding: "10px 18px"
  panel:
    backgroundColor: "{colors.day-panel}"
    rounded: "{rounded.panel}"
  pill-badge:
    textColor: "{colors.day-signal-blue}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

# Design System: Coaster Hub

## Overview

**Creative North Star: "The Park Map"**

Coaster Hub should feel like the map you are handed at the gate: clear, friendly, and
easy to find your way around, with the rides as the point. By day it is a pale sky over
light paper; by night it is a deep blue park with the skyline lit. Everything sits on a
calm, flat page divided by hairlines and pale tinted bands, and one bright ride yellow is
saved for the thing you came to do: log, start your count, add a credit. Information is
dense where riders want it (lists of credits, rankings, stats) and quiet everywhere else.

Within that calm, the components are allowed to play. Carter chose "playful" for buttons
and cards: rounded shapes, park-themed touches like the admission-ticket "You're at" card,
the coaster-car and podium icons in the feeds, the count that ticks up after a park day,
and the skyline drawn into every hero. Playfulness lives in shape, iconography and small
moments. Color is allowed where it means something about the park or the ride (Carter, 2026-11-26: "they're okay i just don't want it to get too messy"); keep it restrained, never color for its own sake.

The voice is plain and direct, with the rider's own count as the product. Nothing on a
page should read as generated filler: no stock slogans, no invented numbers, no
decoration that does not say something about coasters or the rider.

**Key Characteristics:**
- Light and dark are both first-class; every color is a token defined for both.
- Flat surfaces, hairline borders and pale signal-blue tints carry the structure.
- Ride yellow means "do something" and nothing else.
- Numbers are bold, tabular and blue; their labels are tiny small caps.
- Park-themed shapes (ticket, timeline track, skyline) over generic UI chrome.
- Mobile first: the phone layout is the primary one, desktop second.

## Colors

A two-climate palette: a deep night blue and a light day paper, with one signal blue that
changes weight between them, and one ride yellow shared by both.

### Primary
- **Signal Blue** (night `#4cc3ff`, day `#0a6aa0`; token `--accent2`): links, figures,
  active tabs, the filled "now" dot on a timeline, park and coaster names that are links.
  It is the site's speaking voice.
- **Ride Yellow** (`#ffcc1f` in both themes, with `#16181b` text; tokens `--accentfill`
  / `--onaccent`): the primary action only (Log a day, + Log, Start your count, Add to
  credits) and the center Log button of the phone tab bar.

### Secondary
- **Day Amber** (`#b7791f`, light theme `--accent`): the "Defunct" flag and other
  warnings that are not errors, where yellow would not read on paper.

### Neutral
- **Night Sky** (`#080e20`, `--bg` dark) and **Day Paper** (`#f5f5f3`, `--bg` light):
  the page.
- **Night Panel** (`#15203a`) and **Day Panel** (`#ffffff`; `--panel`): cards, lists,
  the season card, the ticket.
- **Wells** (`#0b1228` / `#ebebe8`, `--well`): inputs and anything recessed below a panel.
- **Ink** (`#f3f4f6` / `#16181b`, `--fg`) and **Muted** (`#9ca8bb` / `#5f6770`,
  `--muted`): text and secondary text. Muted is for metadata, never for content the
  rider came to read.
- **Hairline** (`--line`: white 10% / ink 13%): every border and divider.
- **Tints** (`--tint` 7% and `--tint2` 14-15% of Signal Blue): bands, chips, the
  "×3 today" tag, hovered rows, the stats band.
- **Alarm Red** (`#ff5a5f` / `#d92c33`, `--bad`): destructive actions and errors only.

### Named Rules
**The One Yellow Rule.** Ride yellow is the "do something" color. One yellow control per
view where possible, never yellow text on paper, never yellow as decoration.

**The Tokens Only Rule.** Colors come from the `:root` custom properties, defined for
both themes. A new color that is not a token is a bug in one of the two themes.

**The Grey Means Gone Rule.** A defunct coaster's name and numbers go muted grey,
sitewide. Grey is not used to de-emphasize live content.

## Typography

**Display Font:** the platform system UI face (system-ui, -apple-system, Segoe UI,
Roboto, Helvetica, Arial, sans-serif).
**Body Font:** the same.
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, monospace` for @usernames only.

**Character:** one native family at very different weights. Headlines are heavy (800)
and tightly tracked; body is regular; labels are tiny bold small caps. It reads like a
well-set park map, not a magazine.

### Hierarchy
- **Display** (800, clamp(2.2rem, 5.6vw, 3.5rem), line-height 1.03, -0.02em): hero
  headlines: a rider's count ("610 credits."), a coaster's name, a page title. Headlines
  end with a period where they make a statement ("Log a day."), not on proper names
  ("Global rankings").
- **Headline** (800, clamp(1.7rem, 4vw, 2.4rem), -0.01em): section headings (Recent
  visits, On this day, Lost credits).
- **Title** (800, 1.25rem): card headings (Carter's 2026), list group heads.
- **Figure** (800, 1.3-1.6rem, tabular numbers, Signal Blue): stats in the coaster band,
  season card, number tiles.
- **Body** (400, 1rem / 15-16px, line-height 1.5): sentences, list rows (park and coaster
  names at 600).
- **Label** (700, 0.66-0.72rem, 0.08-0.09em tracking, uppercase): the words under a
  figure (HEIGHT, PARK DAYS), "YOU'RE AT", timeline years, status words
  (OPERATING, DEFUNCT).

### Named Rules
**The Small Caps Under Big Numbers Rule.** A figure is always big, bold and blue with a
tiny uppercase label beneath it. Never a sentence-case label, never a label above.

**The Specificity Trap Rule.** `.hero p`, `.hero p + p` and other broad rules outrank a
bare class; style text inside the hero as `.hero p.thing`. This has shrunk the Credits
count and broken the follow line before.

## Layout

A single centered container (~1032px wide content on desktop) with a 16px phone gutter.
Pages are a stack of sections separated by generous vertical space (24px between blocks
on a phone, more on desktop). Lists are single panels of hairline-divided rows. Wider
screens add columns (two or three for park groups, two for lost credits) rather than
stretching rows.

Below 680px the header loses its link row and a fixed bottom tab bar takes over
(Home, Explore, Log, Rankings, Me, with Log as a raised yellow button). Grids collapse
to two columns of figures. Hero padding comes from `--hero-t` / `--hero-b`, never inline
`padding`, so the phone layout can tighten it.

Full-bleed bands (the coaster stats band) break out of the container with a 100vw
pseudo-element; the page sets `body{overflow-x:clip}` so a desktop scrollbar does not add
a sideways scroll.

## Elevation & Depth

Flat with hairlines. Depth comes from tone, not shadow: page, then panel, then well;
pale Signal Blue tints for bands and selected states; 1px hairlines for every edge.
Shadows are rare and soft, used only where something genuinely sits above the page.

### Shadow Vocabulary
- **Panel whisper** (`box-shadow: 0 1px 2px rgba(17,24,39,.05)`): light theme cards and
  panels, so white on paper keeps an edge.
- **Lifted tile** (`box-shadow: 0 6px 18px -10px rgba(10,30,60,.35)`): reserved for a
  tile that is meant to float. Use sparingly.

### Named Rules
**The Flat By Default Rule.** Surfaces are flat at rest. Add a tint band before reaching
for a shadow; add a hairline before reaching for a fill.

## Shapes

Rounded, friendly corners throughout: rows and buttons 10-12px, panels 14px, cards 16px,
pills fully round. Avatars are circles with `background-origin:border-box` so the 1px
ring never reads as a shifted picture. Park-themed silhouettes are part of the language:
the ticket's notches (cut with a radial-gradient mask) and dashed tear line, the timeline
track with round stops, and the skyline line drawing.

## Components

### Buttons
- **Shape:** rounded rectangle (12px; 10px in heroes).
- **Primary:** Ride Yellow fill, Ink text, 600 weight, 13px 24px (10px 18px in heroes).
- **Outline:** Panel fill (never transparent over the skyline), 1px Hairline border,
  Ink text; hover turns border and text Signal Blue.
- **Hover / Focus:** border and color shift only, no movement, no glow.

### Pills and chips
- **Rider switcher / badge:** Signal Blue text on a faint tint, 1px Ring border, fully
  round, 6px 14px.
- **Segmented switch** (Mine | Global, Rides | Parks | Coasters): soft track, the active
  segment a solid Panel pill.
- **Tags:** "×3 today" as a Tint2 pill in Signal Blue; "New" as bold uppercase Signal Blue
  text without a pill.

### Cards / Containers
- **Corner Style:** 14-16px.
- **Background:** Panel on Page; Tint bands inside cards for figure rows.
- **Shadow Strategy:** see Elevation; hairline border always.
- **Internal Padding:** 14-18px (12-14px on a phone).

### Lists
- One panel, rows divided by Hairlines, name at 600 with muted metadata after it, a
  status word or year right-aligned. Tapping a row opens it in place (coaster facts,
  a day's rides). Closed rides fold under open ones.

### Inputs / Fields
- **Style:** Well background, 1px Hairline, 10-12px radius, 16px text on iOS (so Safari
  does not zoom).
- **Focus:** Ring-colored border.

### Navigation
- **Desktop:** brand left (it never shrinks under the links), five links centered with
  "+ Log" as a yellow pill, theme / search / avatar right.
- **Phone:** brand and search/avatar on top; a fixed tab bar at the bottom with a raised
  yellow Log button. The bars hold still during page transitions.

### Stats band (signature)
A pale Tint band edge to edge with hairlines above and below, figures in the page column,
vertical hairlines between them, small-caps labels. Used on coaster pages and inside the
season card.

### Admission ticket (signature)
The "You're at <park>" card: Panel fill, notches cut from both sides, "YOU'RE AT" in
small caps over the park name, a dashed tear line before the yellow-free Signal Blue
action.

### Timeline (signature)
Past locations: a 2px Hairline track with round stops, newest first; the running stop is
a filled Signal Blue dot with a soft halo and "2024 – now".

### Feed row icons
24px-grid line icons at 1.8 stroke in a 30px tinted square: a coaster car on track for a
logged day, a podium for a ranking, a lift hill with a plus for a new coaster, angle
brackets for a site update.

## Do's and Don'ts

### Do:
- **Do** use the `:root` tokens for every color and check both themes.
- **Do** keep Ride Yellow for the one main action on a view.
- **Do** give every figure a tiny uppercase label beneath it.
- **Do** reach for a park-themed shape (ticket, track, skyline) when a component needs
  personality.
- **Do** bump the `?v=` on `style.css`, `lists.css` and `app.js` in every page when they
  change.
- **Do** honor `prefers-reduced-motion`: the count tick and page slides skip it.

### Don't:
- **Don't** use gradients on text, glows, or glass as decoration.
- **Don't** put a transparent button over the skyline; outline buttons get a Panel fill.
- **Don't** use CSS shorthands (`background`, `font`) that reset longhands set elsewhere.
- **Don't** add a heading-sized "eyebrow" label above a heading.
- **Don't** invent numbers, testimonials or placeholder data on any page.
- **Don't** nest anything that must escape it (menus, popovers) inside `.hero`; it is
  `overflow:hidden`.
