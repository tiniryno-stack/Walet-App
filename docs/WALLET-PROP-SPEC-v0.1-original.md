# Wallet Prop — Spec (v0.1)

A home screen web app used as an **on-camera prop** for a short film. It opens straight into a replica of the iOS Wallet pass detail view, showing an event ticket, and the actor swipes horizontally through a set of tickets. The tickets are configured in a hidden organizer screen. Glitch effects come in a later phase, but the data model has to support them from day one.

Build it as a single static site on GitHub Pages and add it to the home screen. It uses the same architecture as `tiniryno-stack/golf-live-board`, but needs **no backend**: everything is stored on the device.

Reference screenshot: `docs/reference/wallet-pass.png` (iPhone, 1185×2576 @3x). **Match it pixel for pixel.** Every measurement below comes from that image, in points (px ÷ 3). If this spec and the screenshot disagree, the screenshot wins.

---

## 1. Hard rules

- **One screen on camera.** The app launches directly into the pass view. There's no splash, no landing page and no onboarding.
- **No barcode, QR code or anything scannable.** The pass shows only the NFC "Hold Near Reader" state, like the reference.
- Static only: HTML/CSS/vanilla JS (or Vite + vanilla, output to `/docs` or the `gh-pages` branch). No frameworks unless they're needed for gesture fidelity.

## 2. Devices and viewport

- Targets: iPhone 15, 15 Pro, 16, 16 Pro, 17, 17 Pro (393–402pt wide). Should also hold up on Plus and Pro Max (430–440pt).
- Lay out from a 393pt-wide baseline. The card's horizontal insets stay fixed at 20pt and the card width stretches. Vertical positions are measured from the top safe area.
- Runs in **standalone mode** (launched from the home screen). The real iOS status bar draws over the app, so the top of the page is pure black behind it.

## 3. Home screen app setup

- `manifest.webmanifest`: `display: standalone`, `background_color: #000`, `theme_color: #000`, portrait orientation, app name **"Wallet"**, plus icons. Use a generic wallet-style icon we design ourselves, not Apple's actual Wallet icon art.
- iOS meta tags: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-touch-icon`, `viewport-fit=cover`, `user-scalable=no`.
- Kill all web-feel tells:
  - `overscroll-behavior: none` on html/body, so there's no pull-to-refresh or page bounce
  - `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`
  - no double-tap zoom and no pinch zoom
  - no visible scrollbars
- Keep the screen awake during takes: request a **Screen Wake Lock** when the page is visible, and re-request it on `visibilitychange`. If that fails, fail silently.
- Service worker that caches everything so it works offline on set.

## 4. Layout (points, 393pt baseline)

Background: `#000000`.

**Top controls** (sit on black, below the status bar):
- Close button: circle, 43pt diameter, centered at x=37, y=83 (from the top of the screen). Fill `#1C1C1E`, 1pt stroke `#2C2C2E`, white ✕ glyph about 18pt, 2.5pt line weight. Tapping it does nothing (or plays a slight press scale only).
- More button (⋯): same circle, centered at x=357, y=83. Three white dots. **A long press (600ms) opens the Organizer (§6).** A normal tap does nothing, so it's safe if the actor brushes it on camera.

**Pass card** (the current ticket):
- Frame: x=20 → 375 (355pt wide), y=126 → 500 (about 374pt tall). Corner radius about 10pt. Fill `#22262D`. Soft drop shadow, plus a faint glow of the band color around the card (visible in the reference as a blue haze on the left and bottom edges).
- **Notch cutout**: a semicircular bite out of the top edge, centered horizontally, about 64pt wide and 16pt deep. It's transparent and shows black behind it. Build it with a mask or clip-path, not an overlaid black circle, so the glow and shadow stay correct.
- **Header** (y 126 → 189, 63pt):
  - Left: brand wordmark, white, vertically centered, inset 12pt.
  - Right, right-aligned and inset 15pt: time label (e.g. `7:00 PM`), about 12pt, semibold, letter-spaced, label blue. The date value below it (e.g. `Nov 7, 2026`) is about 26pt, regular, white.
- **Brand band** (y 189 → 283, 94pt, full card width): solid band color (default `#2D6BE0`), with the brand glyph centered in white at about 60pt tall.
- **Body** (y 283 → 500), inset 15pt left and right:
  - Venue label, uppercase, about 12pt semibold, letter-spaced, label blue (e.g. `ARIAT ARENA`), at about y 297. The event title below it, about 17pt regular, white, uppercase, single line, auto-shrinking down to 14pt to fit (e.g. `JOHN SUMMIT - CTRL ESCAPE ARENA TOUR`).
  - Row of three fields: SECTION (left-aligned), ROW (left-aligned at about x=195), SEAT (right-aligned). Labels as above, values about 24pt regular white.
  - Row of two fields: ENTRY INFO (left), TICKET TYPE (left-aligned at about x=171). Values about 22pt regular white.
  - Bottom-left: a small brand app icon, 20pt rounded square in the band color with a white glyph. Bottom-right: the contactless symbol (four arcs), about 18pt, light gray `#C7C7CC`.
- Label blue: `#4C8DF6` (sample from the reference and adjust).
- Font: `-apple-system` / SF Pro, with SF Pro Display for 20pt and up. Use tabular numbers for seats and dates.

**Peek**: the next card is visible past the right edge, about 25pt of it (x 383 → 393 and beyond, cut off by the screen). The previous card peeks on the left the same way when you're past the first card.

**Page dots**: centered, y about 517. 6pt dots spaced 18pt apart, active `#FFFFFF`, inactive `#5A5A5E`. One dot per ticket. If there are more than about 10 tickets, shrink the outer dots the way iOS does.

**NFC prompt** (sits on black, under the dots):
- Ring: 62pt diameter, centered at y about 577, 4pt stroke `#3A82F7`, a dark navy fill inside, and a phone glyph in it (navy phone, lighter outline, small pill speaker slot). Subtle slow pulse on the ring's glow (about a 2s cycle). Check it against real Wallet and keep it understated.
- Text: `Hold Near Reader`, about 22pt regular, `#8E8E93`, centered at y about 632.

## 5. Swipe behavior (the most important thing to get right)

- Horizontal paging through tickets with **native-feeling momentum**: a 1:1 drag under the finger, a velocity-based flick to the next or previous card, and a rubber-band stretch past the first and last card.
- Preferred approach: CSS `scroll-snap-type: x mandatory` on a horizontal scroller (iOS gives you real momentum for free), with cards spaced by the peek and gap amounts. Fall back to a custom pointer-driven spring only if scroll-snap can't hit the peek layout.
- Only the cards move. The close and ⋯ buttons, the dots and the NFC prompt stay fixed.
- Dots update live as a card crosses the halfway point.
- No vertical movement at all. Lock the gesture to the horizontal axis.
- 60fps on iPhone 15. Use only `transform` and `opacity` for anything animated.

## 6. Organizer (hidden settings)

Opens with a long press on ⋯. A full-screen sheet in iOS-settings style that is never shown on camera.

- **Ticket list**: add, duplicate, delete, drag to reorder. Each row shows the event title plus the section/row/seat.
- **Ticket editor**: every visible text field is editable, *including the labels* (so "SECTION" can become "GATE" and so on):
  - `time`, `date`, `venueLabel`, `eventTitle`
  - `section`, `row`, `seat`, `entryInfo`, `ticketType`, each with an editable label
  - `bandColor` (color picker plus presets)
- **Takes**: save the current ticket list as a named take ("Take 3 — arena entry"), load a take, rename it, delete it. The app opens to the last loaded take.
- **Start on**: pick which ticket is showing at launch (default: the first).
- **Export / Import**: copy the whole config as JSON, or paste JSON in, so setups can move between phones on set.
- Stored in `localStorage` under one versioned key.
- Close returns to the pass view at the chosen start ticket.

## 7. Data model (glitch-ready)

Each field holds an **array of values**. Today only `values[0]` is rendered. The later glitch phase cycles through the rest.

```json
{
  "version": 1,
  "activeTake": "take-1",
  "takes": {
    "take-1": {
      "name": "Take 1",
      "startIndex": 0,
      "tickets": [
        {
          "id": "t1",
          "bandColor": "#2D6BE0",
          "fields": {
            "time":       { "values": ["7:00 PM"] },
            "date":       { "values": ["Nov 7, 2026"] },
            "venueLabel": { "values": ["ARIAT ARENA"] },
            "eventTitle": { "values": ["JOHN SUMMIT - CTRL ESCAPE ARENA TOUR"] },
            "section":    { "label": "SECTION", "values": ["114"] },
            "row":        { "label": "ROW", "values": ["19"] },
            "seat":       { "label": "SEAT", "values": ["11"] },
            "entryInfo":  { "label": "ENTRY INFO", "values": ["LOWER LEVEL"] },
            "ticketType": { "label": "TICKET TYPE", "values": ["Presale"] }
          }
        }
      ]
    }
  }
}
```

In the Organizer, each field shows its first value with a "+ alt value" button. The alternate values are stored now and used by the glitch phase later.

## 8. Glitch phase (later, don't build yet)

Leave a `glitch.js` stub with `applyGlitch(fieldEl, nextValue, style)`, and keep every field rendered in its own element with a stable `data-field` attribute so the effects can target it. Triggers and styles are still to be decided.

## 9. Acceptance checklist

- [ ] Launched from the home screen on an iPhone 15/16/17, a side-by-side with `wallet-pass.png` lines up within about 2pt on every element.
- [ ] No browser chrome, bounce, zoom, text selection or tap highlight anywhere.
- [ ] Swiping through 6+ tickets feels like Wallet: momentum, snapping, peeking and rubber-banding.
- [ ] A long press on ⋯ opens the Organizer, and edits show up on the card immediately.
- [ ] Takes persist across app restarts, and export → import reproduces a take exactly.
- [ ] Works fully offline after the first load.
- [ ] The screen doesn't dim during a 2-minute take (wake lock).
- [ ] No real brand assets, and nothing scannable.

## 10. Repo

- New public repo, e.g. `tiniryno-stack/wallet-prop`, deployed with GitHub Pages.
- `docs/reference/` holds the reference screenshot(s).
- README: how to add it to the home screen, how to open the Organizer, and a pre-shoot checklist (turn off Live Activities, Focus mode on, brightness max, Low Power Mode off).
