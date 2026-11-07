# Wallet Prop — Developer Handoff Spec (v0.2, living doc)

> **Status:** living document, updated as design decisions are made. Supersedes `WALLET-PROP-SPEC.md` v0.1.
> **Design canvas:** "Wallet Prop" Design artifact (3 artboards: Pass view, Organizer, Builder). Its Builder artboard is clickable, so use it to feel the intended interactions.
> **Owner:** Andrew Duong · **Last updated:** 2026-11-07

---

## 0. What this is, in one paragraph

This is a home-screen web app (PWA) used as an **on-camera prop** in a short film. It opens straight into a pixel-accurate replica of the iOS Wallet pass detail screen showing an event ticket, and the actor swipes horizontally through a set of tickets. A hidden **Organizer** (opened by long-pressing ⋯) lets the crew set how many tickets there are, organize them into named **takes**, and restyle any ticket in a **Builder**. The Builder can match a reference photo of any real-world ticket look quickly on set, including generating most of the styling automatically from the photo, with **no AI service, no API keys and no network**. Everything is stored on the device and works offline.

---

## 1. Hard rules

1. **One screen on camera.** The app launches directly into the pass view. There's no splash, landing page or onboarding.
2. **Nothing scannable.** There's no barcode, QR code or real NFC. The pass shows only the "Hold Near Reader" state.
3. **No real brand assets ship in the app.** Defaults use a fictional ticket brand ("passline"), artist and venue. The crew may upload their own images on set (see §8). The app must never bundle another company's logos.
4. **No AI or cloud dependency.** Every feature, including "Generate from reference", runs on-device with plain code and open-source libraries that are cached for offline use.
5. **Static site only.** HTML/CSS/vanilla JS (Vite + vanilla is fine). No backend. Deploy to GitHub Pages.
6. **Same architecture as `tiniryno-stack/golf-live-board`**, minus the backend.

---

## 2. Devices, viewport and the reference

- **Reference screenshot:** `docs/reference/wallet-pass.png` is **1206 × 2622 px @3x = 402 × 874 pt**. v0.1 said 1185 × 2576; that was wrong. **The screenshot wins over any number in this doc.**
- Targets: iPhone 15/16/17 and Pro models (393–402 pt wide). It must hold up on Plus/Pro Max (430–440 pt).
- **Layout rule:** horizontal insets are fixed at about 20 pt and the card width stretches. Vertical positions are measured from the top of the screen.
- Runs in **standalone mode**. The real iOS status bar draws over the app, so the top of the page is pure black behind it. **Don't draw a fake status bar.**

---

## 3. Home-screen app setup

- `manifest.webmanifest`: `display: standalone`, `background_color`/`theme_color: #000`, portrait, name **"Wallet"**, and our own generic wallet-style icon (not Apple's icon art).
- iOS meta: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-touch-icon`, `viewport-fit=cover`, `user-scalable=no`.
- Remove every sign that it's a web page:
  - `overscroll-behavior: none` on html/body
  - `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`
  - no double-tap zoom, no pinch zoom, no visible scrollbars
- **Screen Wake Lock** while the page is visible, re-requested on `visibilitychange`. Fail silently.
- **Service worker** caches everything for offline use, **including the OCR engine and its language data** (§9.3), so it works on set with no signal.

---

## 4. Screens and user flow

```
[1 Pass view]  --long-press ⋯ (600ms)-->  [2 Organizer]  --tap a ticket-->  [3 Builder]
      ^                                        |   ^                              |
      +------------- Done / close -------------+   +------ ‹ Tickets / Save ------+
```

Typical on-set flows:

- **Six identical tickets:** Organizer → set *Number of tickets* to 6 → tap Ticket 1 → build it (or *Generate from reference*) → **Apply to All 6** (keep seats on) → done.
- **One ticket that's different:** Organizer → tap that ticket → edit → **Save Ticket**.
- **Someone sends a new ticket look between shots:** Builder → upload reference → **Generate from reference** → check with **Wipe** → tweak → Apply to All → Save as Look for reuse.

The separate "Ticket editor" screen from earlier drafts is **removed**. The Builder replaces it.

---

## 5. Screen 1 — Pass view (on camera)

Measurements are in **pt on the 402 pt reference**, taken from `wallet-pass.png` at a scale of 3 px = 1 pt. All are about ±0.5 pt, so verify them with an overlay.

### 5.1 Top controls (on black)

| Element | Spec |
|---|---|
| Close button | Circle, about 43.5 pt diameter, centered at (38, 84). Fill `#1C1C1E`, 1 pt stroke `#2C2C2E`, white ✕ about 18 pt, 2.5 pt line. A tap does nothing except a slight press scale. |
| More (⋯) | The same circle, centered at (364, 84), with three white dots about 4.5 pt each. **A long press of 600 ms opens the Organizer.** A normal tap does nothing, so it's safe if the actor brushes it on camera. |

### 5.2 Pass card

| Part | Spec |
|---|---|
| Frame | x 20 → 382 (about 362 wide), y 128 → 509 (about 381 tall). **Corners are nearly square, about 3 pt** (v0.1 said 10, which is wrong). Default fill `#22262D`. |
| Shadow / glow | A soft dark drop shadow plus a faint glow in the band color, mostly on the left and bottom edges. |
| Notch | A semicircular bite out of the top edge, centered, about 65 pt wide and 16 pt deep (a circle of about 40 pt radius whose center sits about 24 pt above the edge). **Use a mask, not an overlaid black circle**, so the glow and shadow follow the cutout. |
| Header | y 128 → 193 (about 65 pt). Left: the header logo (image or text wordmark), inset about 13 pt, vertically centered. Right, inset about 15.5 pt: the time label (about 12 pt semibold, letter-spaced, in the label color) above the date (about 26 pt regular, value color). |
| Band | y 193 → 288 (about 95 pt), full width. Either a solid color with a centered logo about 58 pt tall, **or a full-bleed image** (see the Sphere-style reference). |
| Body | Inset about 15.5 pt left and right. Venue label at about y 302 (about 12 pt semibold, letter-spaced, uppercase, label color), with the event title below at about y 318 (about 17.5 pt regular, single line, auto-shrinking to 14 pt). |
| Field row 1 | Labels at about y 350, values at about y 368 (about 24.5 pt). SECTION left-aligned at the inset, ROW left-aligned at x about 199, SEAT right-aligned. |
| Field row 2 | Labels at about y 398, values at about y 415 (about 22.5 pt). ENTRY INFO on the left, TICKET TYPE left-aligned at x about 175. |
| Footer left | App icon: a 20 pt rounded square (about 5 pt radius) at about (27, 483). It can be turned on or off. |
| Footer right | One of: the **NFC symbol** (four arcs, about 19 × 23 pt, light gray `#C7C7CC`), **text** (e.g. `EXPIRED`, about 12 pt), or **nothing**. |

Default colors: label blue `#4C8DF6`, values `#FFFFFF`, band `#2D6BE0`. Every color can be changed per ticket (§7).

Fonts: `-apple-system` / SF Pro Text, and SF Pro Display at 20 pt and up. Use tabular numbers for seats and dates.

### 5.3 Peek, dots and NFC prompt

| Element | Spec |
|---|---|
| Peek | The next card starts at x about 390, which is an **8 pt gap with about 12 pt visible** (v0.1 said 25, which is wrong). The previous card peeks on the left the same way when you're past the first card. |
| Page dots | Centered at y about 526. 7 pt dots, about 17.6 pt from center to center. Active `#FFFFFF`, inactive `#5A5A5E`. One dot per ticket. Past about 10 tickets, shrink the outer dots the way iOS does. |
| NFC ring | Centered at (201, 587). About 63 pt outer diameter, with a **3.8 pt** blue stroke `#3A8DF5` and black inside. |
| NFC phone glyph | About 35.5 pt wide, its top about 16 pt above the ring's center, with a navy fill `#0E2A4F`, a 2 pt blue outline and about 6 pt corners. A blue speaker pill about 9.8 × 2.8 pt sits about 4.8 pt below the phone's top. **The phone runs down past the ring and is clipped by a circle a little larger than the ring's inner edge. It has a black outline of about 1.3 pt that cuts a thin black line through the blue ring where they overlap.** That black line is the "black ring" detail in the reference and must match. |
| NFC animation | **Measured frame by frame from a 60 fps screen recording** (`docs/reference/nfc-animation.mov`). The ring never moves and there's no glow. The phone glyph shrinks, as if it's moving away from the viewer toward the reader, then comes back. At the same time, a lighter fill sweeps across it diagonally. See §5.4. |
| Text | `Hold Near Reader`, about 22 pt regular, `#8E8E93`, centered at y about 643. |

### 5.4 NFC phone animation (measured)

Frames are at 60 fps, and t = 0 is the moment the pass finishes opening. Sizes are the phone's width including its outline, in pt.

| Time | Phone width | Phone top | Fill |
|---|---|---|---|
| 0–0.27 s | 36.7 pt (largest, right after opening) | 16 pt above the ring's center | All dark navy `#002445` |
| 0.27–0.6 s | shrinks to about 34 | rises about 2 pt (a slight tilt) | A lighter band `#063A76` enters at the **top-right corner** |
| 0.6–1.25 s | shrinks to **28.7 pt (about 78%)** | drops about 10 pt in total | The light band sweeps diagonally toward the bottom-left. **It peaks at about 87% of the visible phone and never covers all of it**: a dark sliver always stays in the bottom-left corner |
| 1.25–1.55 s | holds at 28.7 | holds | Holds at about 87% light |
| 1.55–2.3 s | grows back to about 33.3 (about 91%) | rises | The light band recedes back out through the top-right |
| 2.3 s onward | rests at about 33.3 | | Dark again (the recording ends here) |

Implementation:

- **The tilt is a 3D tilt, not a flat scale.** The top of the phone tips away from the viewer, the way you'd tip a phone's camera end down toward a reader. That gives a slight trapezoid: the top is narrower than the bottom, the phone looks shorter, and its top drops. I fitted a model to the measured frames, and these values reproduce the widths at two heights and the drop of the top to within about 0.3 pt:
  - Put `perspective: 160px; perspective-origin: 50% 50%` on the circular clip container. This assumes the 395 pt layout basis the mockup uses; multiply by 1.018 for 402.
  - Phone `transform-origin: 50% 75px`, measured from the phone's top. That's below the visible phone, near the bottom of the ring.
  - **Rest:** `translateZ(-12px) rotateX(4deg)`, about 91% width.
  - **Far:** `translateZ(-23px) rotateX(26deg)`, about 78% width, with the top about 10 pt lower and the top about 2.5% narrower than the lower part.
  - Animate only this transform. Don't fake it with `scale()`.
  - **Centering:** the video shows the phone exactly centered in the ring (to within 0.5 px at 3x) through the whole tilt. Lay out the ring, clip and phone on **whole-pixel coordinates**, so the ring is an odd width and the phone an odd width, sharing one center. Browsers snap 3D-transformed layers to whole pixels, and a fractional `left` shifted the phone about 0.5 pt off-center in the mockup.
  - The mockup's taper is a bit stronger than the video's (about 3.6% vs 2.4% across the same height). If it reads as too trapezoidal, lower `rotateX` toward about 18° and raise `perspective` slightly.
- **Sweep:** a hard-edged diagonal gradient layer (lighter `#063A76` at the top-right, transparent at the bottom-left), moved with `transform: translate()` inside the phone and clipped to it. **Make the layer much bigger than the phone** (the mockup uses 400 × 400 pt, centered on the phone) so its far edges never show at either end of the sweep. Only the diagonal edge should ever be visible.
  - **Light-band coverage over one loop (measured):** 0% → 14% (at 0.33 s) → 50% (0.57 s) → 75% (0.8 s) → **87% peak (0.93–1.2 s)** → 76% (1.5 s) → 50% (about 1.7 s) → 17% (1.9 s) → 0% (about 2.1 s). In the mockup's 3.2 s loop, the sweep layer's keyframes are 0–7% off-screen, 18% at center, **29–37% at the peak** (`translate(-6.5px, 6.5px)` in the mockup's geometry), 53% at center, and 64–100% off-screen. The tilt keyframes are 0% rest, 31–40% far, and 65–100% rest.
- **Speaker pill and outline:** both stay `#3A8DF5`.
- **Timing:** the mockup uses a 3.2 s loop between rest and far, with ease-in-out. The very first, flat 100% state happens only once, right after the phone enters (§5.5).
- **Still unknown:** how long it rests before repeating. The recording ends 0.6 s into the rest (§13).

**The pass opening transition**, also in the recording, isn't needed on camera because the app launches straight into the pass. It's documented here in case it's wanted later: the tapped pass rises out of the stacked Wallet list, the passes stacked above it collapse, and the neighboring passes slide out to the peek positions. It settles in about 0.45 s, and the dots and NFC prompt fade in at the end.

### 5.5 Swipe behavior (the most important thing to get right)

**Measured from a 60 fps recording of two swipes** (`docs/reference/swipe.mov`):

- **Geometry is confirmed:** the current card spans x 20 → 381.7 pt. The gap is 8.3 pt. The previous and next cards each peek about 11.7 pt.
- **Card motion:** a swipe takes about **0.4 s** from when the finger starts to when the card settles. After release, the remaining distance shrinks by about 40–45% every 2 frames (33 ms), which is a smooth decay with no overshoot. Native `scroll-snap` paging on iOS behaves this way. If a custom spring is used, make it **critically damped (no bounce)** and settle in about 0.25–0.3 s after release.
- **The NFC prompt resets on every swipe.** The ring, phone and "Hold Near Reader" text animate together, while the dots and the ✕ and ⋯ buttons stay fully visible:

| Time from swipe start | What happens |
|---|---|
| 0 → 0.15 s | The card follows the finger, and the NFC prompt stays fully visible. |
| about 0.15 → 0.37 s | The **ring, phone and text fade out** (opacity 1 → 0, ease-out) once the card is about ¾ of the way across. |
| about 0.37 → 0.5 s | The NFC prompt stays hidden while the card finishes settling. |
| about 0.5 → 0.7 s | The **ring and text fade back in** (0 → 1). The ring is **empty**, with no phone. |
| about 0.7 → 1.08 s | The **phone slides up into the ring from below**, about 42 pt of travel with a strong ease-out, clipped by the ring's circle so it appears to rise out of the bottom of the ring. It arrives flat at 100%. |
| about 1.08 → 1.4 s | The phone holds flat. |
| after that | The tilt loop from §5.4 starts. |

- Start this same entrance (fade the ring and text in, slide the phone up, hold, then loop) when the app launches. The mockup does this on load.
- If the user swipes again partway through, restart the sequence.

**Other swipe rules:**

- Horizontal paging with **native momentum**: 1:1 drag, velocity flick to the next or previous card, and a rubber-band stretch at both ends.
- Preferred approach: `scroll-snap-type: x mandatory` on a horizontal scroller (iOS momentum comes free). Fall back to a pointer-driven spring only if the peek layout can't be achieved with it.
- Only the cards move. The buttons, dots and NFC prompt stay fixed.
- Dots update live as a card crosses halfway. No vertical movement: lock the gesture to the horizontal axis.
- 60 fps on iPhone 15. Animate only `transform` and `opacity`.
- Every rendered field has its own element with a stable `data-field` attribute (used by the glitch phase, §11).

---

## 6. Screen 2 — Organizer (hidden, never on camera)

iOS Settings style, dark: black background, `#1C1C1E` grouped cells, `#0A84FF` tint.

**Current take group**

- **Take:** shows the active take name, with "Switch ›" to load a different one.
- **Number of tickets:** a − / + stepper (1–20 is fine). Adding a ticket **copies the last ticket**. Removing deletes from the end. Show a confirmation if the removed ticket had been edited.
- **New tickets copy:** which ticket new ones are copied from. Default: the last ticket.
- **Start on:** which ticket shows at launch. Default: Ticket 1.

**Tickets group**

- Each row shows a band-color thumbnail, the event title and "Sec · Row · Seat". **Tapping a row opens it in the Builder.**
- Swipe a row to duplicate or delete it. Drag ≡ to reorder.
- An "Add Ticket" row.

**Takes & setup group**

- **Save as New Take…**, plus load, rename and delete takes. The app reopens to the last loaded take.
- **Export JSON (Copy):** the whole config, **including images** (§10.3).
- **Import JSON (Paste):** this must reproduce a take exactly.

**Done / close:** returns to the pass view at the take's start ticket.

---

## 7. Screen 3 — Builder (the ticket editor)

The single place to edit a ticket's content and look. The main idea: **settings are precise controls tucked into a few collapsible menus, not drag and drop**, because dragging misses. Every move or resize happens in 0.5 pt steps with a numeric readout.

### 7.1 Layout: frozen top and bottom, with the settings scrolling between them

Like frozen rows in Excel, the preview never scrolls away:

| Region | Behavior |
|---|---|
| Nav bar (fixed) | `‹ Tickets` · **"Ticket N of M"** · ‹ › to step through tickets without leaving the Builder. |
| Card preview (fixed) | The real card at about 75% scale. Every element can be tapped to select it, and the selected element gets a 2 pt blue outline. The reference photo draws over it (§7.3). |
| Reference bar (fixed) | An upload-reference button · Overlay / Wipe / Off · one slider (opacity in Overlay, divider position in Wipe). |
| Element picker (fixed) | `‹ [Selected element name] ›`, plus "N of 13 · tap the card to jump". |
| Settings (scrolls) | The collapsible sections in §7.4. **Only this area scrolls.** |
| Bottom bar (fixed) | **Apply to All M** (secondary) · **Save Ticket** (primary). |

### 7.2 Selectable elements (13)

Header logo · Time · Date · Band · Venue · Event title · Section · Row · Seat · Entry info · Ticket type · App icon · Footer.

### 7.3 Reference photo: Overlay and Wipe

- **Upload:** pick an image from Photos. It's stored in the image library (§8).
- **Align once:** the photo has to be positioned and scaled to sit on the card. The automatic version is in §9.1. Manual fallback: drag and pinch the reference while in an "Align reference" mode. This is the only place dragging is allowed.
- **Overlay:** the reference sits on top of the card at an adjustable opacity (0–100%), for matching positions and text sizes.
- **Wipe:** the reference is **100% opaque on the left of a vertical divider** and your build shows on the right. Drag the divider with its round handle on the preview, or with the slider, or press "50/50" to snap it to the middle. Corner tags read "REFERENCE" and "YOUR BUILD". To match a color, drag the divider across it: if the color jumps at the line, it doesn't match yet. Implement it with `clip-path: inset(...)` on the reference layer.
- **Off:** hides the reference.

### 7.4 Settings sections (collapsible; only one open at a time)

1. **Content**
   - Text value, with "+ alt value" for the glitch phase.
   - For fields, an **editable label** too (e.g. SECTION → GATE).
   - For image slots (header logo, band, app icon): Upload… / Library / Use text.
   - Footer: NFC symbol / Text / None, plus the text value.
   - App icon: show or hide.
2. **Color & size**
   - Swatches (common presets) and the current hex value.
   - For fields, a separate **Label color**.
   - **Text size:** a − / + stepper in 0.5 pt steps plus a slider (8–60 pt), with a readout.
3. **Position**
   - **Left/right** and **up/down** offsets from the element's default position. Each has ← / → or ↑ / ↓ buttons that move **0.5 pt** per tap, a slider for big moves (±60 pt) and a readout.
   - Reset.
4. **Whole card & looks**
   - **Looks** (§7.6).
   - Card background color.
   - Field layout (open item, §13).

The top of the scroll area always has **Generate from reference** and **Swatches only** (§9).

### 7.5 Save vs Apply to All

- **Save Ticket:** saves only this ticket and returns to the Organizer.
- **Apply to All M:** opens a confirmation sheet ("Apply to all M tickets?"). It copies this ticket's text, labels, colors, sizes, positions and images onto every ticket in the take, replacing what's there.
  - A switch, **"Keep each ticket's Section, Row and Seat", is on by default**, so the tickets stay identical except for their seats.
  - Turning it off makes exact clones.
  - Cancel / Apply.
- There is no This-ticket / All-tickets mode toggle. That was tried and dropped in favor of this flow.

### 7.6 Looks (instant switching on set)

- A look is a saved **style** that covers card background, band (color or image), label color, value color, footer mode, footer color, app icon on/off, element sizes and positions, and images. It doesn't change text content.
- Tapping a look restyles the current ticket instantly. Combine it with Apply to All to restyle the whole take.
- "+ Save as look" saves the current ticket's style.
- Starter looks are based on the references: **Dark · blue band** (the default), **Lavender · black band** (light card, dark labels and values, no app icon) and **Dark · expired** (footer text "EXPIRED").

---

## 8. Image library

- Three image slots per ticket: **header logo**, **band** (a centered logo or a full-bleed image) and **app icon**.
- Uploads go into a device-wide **image library** so any ticket, take or look can reuse them.
- **Store images in IndexedDB as Blobs**, not in `localStorage`, which caps out at about 5 MB and would fill after a few images. Tickets reference images by `imageId`.
- Accept PNG, SVG, JPEG and WebP. Transparent PNG or SVG works best for logos.
- Every image slot can fall back to text (e.g. the "passline" wordmark).

---

## 9. Generate from reference (no AI)

This works because **every Wallet pass uses the same layout**: the app already knows where each part sits, so it only has to measure those spots. It runs entirely in the browser with `<canvas>` and `getImageData`, and it works offline.

### 9.1 Find the card in the photo

1. Load the image into an offscreen canvas.
2. If it's a full-screen iPhone screenshot (width 1170–1320 px and a matching aspect ratio), estimate where the card is from the known layout.
3. Refine the estimate by scanning for the card's rectangle: look for the long horizontal and vertical edges where the color changes from the screen background (black on the pass view, `#2C2C2E` on the gray detail sheet) to the card. Detect the notch to find the top edge.
4. Compute a transform from photo to card coordinates, and use it for both the overlay alignment and all sampling.
5. If no card is found, fall back to manual alignment (§7.3).

### 9.2 Colors and images

| Target | Method |
|---|---|
| Card background | The most common color (histogram mode) in the header area, ignoring the logo and date boxes. |
| Band | If the band area is low-variance, it's a **solid color** (take the mode). If it's high-variance, it's a **photo**, so crop the band rectangle into an image. |
| Header logo / app icon | Crop their known rectangles directly into images. |
| Label color | The main non-background color inside the label-row boxes. |
| Value color | The main non-background color inside the value-row boxes. |
| Footer right | Compare against an NFC-symbol template. Otherwise, if text pixels are found, it's Text. Otherwise None. |
| Layout | Check whether each field's box is empty. That catches tickets with no Ticket Type, or a value with no label (e.g. "General Admission"). |

### 9.3 Text (OCR, on-device)

- Use **Tesseract.js** (open source, runs in a WebAssembly worker). It's an on-device text reader, not a cloud AI service, and needs no account or tokens. Cache `eng.traineddata` and the worker in the service worker. It's a few MB on first load.
- OCR **each field's box separately** at its known position, upscaled about 2×, which makes it much more accurate than OCR-ing the whole image.
- Map the results to time, date, venue, title, the field labels and values, and the footer text.
- Mark any field with low OCR confidence with a dot in the Builder so it gets checked.

### 9.4 Swatches only

Reduce the photo's colors with **median-cut** or **k-means** (k about 8) on a downscaled copy (about 200 px wide) and show the 8 or so main colors as "From reference" swatches. Tapping one applies it to the selected element (or the band).

### 9.5 Expected accuracy

- **Screenshots:** about 90% of the way there. Colors and layout should be near exact. Fonts and sizes will be close, and you'll still nudge them.
- **Photos taken of a screen** at an angle, with glare or with moiré won't measure reliably. Use manual matching with Wipe for those.
- **Reminder:** cropping logos from a real ticket copies that brand's art. For anything shown on camera, replace the image slots with original art after generating.

---

## 10. Data model (v2)

### 10.1 Principles

- Every text field holds `values[]`. Today only `values[0]` is rendered, and the glitch phase cycles through the rest.
- Positions are **offsets in pt** from each element's default spot. Sizes are in pt.
- Images are stored by reference (`imageId`) and live in IndexedDB.

### 10.2 Shape

```json
{
  "version": 2,
  "activeTake": "take-1",
  "looks": {
    "look-dark": {
      "name": "Dark · blue band",
      "style": {
        "cardBg": "#22262D",
        "band": { "mode": "color", "color": "#2D6BE0", "imageId": null, "logoImageId": null },
        "labelColor": "#4C8DF6",
        "valueColor": "#FFFFFF",
        "footer": { "mode": "nfc", "color": "#C7C7CC" },
        "appIcon": { "visible": true, "imageId": null },
        "headerLogo": { "imageId": null, "text": "passline" },
        "elements": {}
      }
    }
  },
  "takes": {
    "take-1": {
      "name": "Take 1",
      "startIndex": 0,
      "newTicketSource": "last",
      "tickets": [
        {
          "id": "t1",
          "style": {
            "cardBg": "#22262D",
            "band": { "mode": "color", "color": "#2D6BE0", "imageId": null, "logoImageId": null },
            "footer": { "mode": "nfc", "color": "#C7C7CC", "text": "EXPIRED" },
            "appIcon": { "visible": true, "imageId": null },
            "headerLogo": { "imageId": null, "text": "passline", "size": 23, "x": 0, "y": 0 }
          },
          "fields": {
            "time":       { "values": ["7:00 PM"],     "size": 12,   "x": 0, "y": 0, "color": "#4C8DF6" },
            "date":       { "values": ["Nov 7, 2026"], "size": 26,   "x": 0, "y": 0, "color": "#FFFFFF" },
            "venueLabel": { "values": ["HALCYON ARENA"], "size": 12, "x": 0, "y": 0, "color": "#4C8DF6" },
            "eventTitle": { "values": ["NOVA REYES - AFTERGLOW ARENA TOUR"], "size": 17.5, "x": 0, "y": 0, "color": "#FFFFFF" },
            "section":    { "label": "SECTION",     "labelVisible": true, "values": ["114"], "size": 24.5, "x": 0, "y": 0, "color": "#FFFFFF", "labelColor": "#4C8DF6", "visible": true },
            "row":        { "label": "ROW",         "labelVisible": true, "values": ["19"],  "size": 24.5, "x": 0, "y": 0, "color": "#FFFFFF", "labelColor": "#4C8DF6", "visible": true },
            "seat":       { "label": "SEAT",        "labelVisible": true, "values": ["11"],  "size": 24.5, "x": 0, "y": 0, "color": "#FFFFFF", "labelColor": "#4C8DF6", "visible": true },
            "entryInfo":  { "label": "ENTRY INFO",  "labelVisible": true, "values": ["LOWER LEVEL"], "size": 22.5, "x": 0, "y": 0, "color": "#FFFFFF", "labelColor": "#4C8DF6", "visible": true },
            "ticketType": { "label": "TICKET TYPE", "labelVisible": true, "values": ["Card Member Presale"], "size": 22.5, "x": 0, "y": 0, "color": "#FFFFFF", "labelColor": "#4C8DF6", "visible": true }
          }
        }
      ]
    }
  }
}
```

### 10.3 Storage, export and import

- Store the config in `localStorage` under one versioned key (`walletProp.v2`). Store images in IndexedDB (`walletProp.images`, keyed by `imageId`).
- Migrate v1 configs on load: wrap the old fields and apply the default style.
- **Export** produces JSON with an `images` map of `imageId → base64 data URL`, so a setup moves between phones complete with its logos. Offer both Copy and Share/Save file, since images make the JSON large.
- **Import** restores the images into IndexedDB first, then the config. Export → import must reproduce a take exactly.

### 10.4 How Apply to All works

For each other ticket in the take, deep-copy `style` and every field from the source ticket. If "Keep seats" is on, keep that ticket's own `section`, `row` and `seat` **values** (labels, styles and positions still copy).

---

## 11. Glitch phase (later, don't build yet)

- Leave a `glitch.js` stub: `applyGlitch(fieldEl, nextValue, style)`.
- Keep every field in its own element with a stable `data-field` attribute.
- The alt values are already stored via "+ alt value". Triggers and effects are still to be decided.

---

## 12. Acceptance checklist

- [ ] Launched from the home screen on an iPhone 15/16/17, an overlay against `wallet-pass.png` lines up within about 1–2 pt on every element, **including the NFC phone's black line through the ring**.
- [ ] No browser chrome, bounce, zoom, text selection or tap highlight anywhere.
- [ ] Swiping through 6+ tickets feels like Wallet: momentum, snapping, about 12 pt of peek, rubber-banding.
- [ ] A long press on ⋯ opens the Organizer, and a normal tap does nothing.
- [ ] Changing the ticket count updates the dots and the cards immediately.
- [ ] In the Builder, the card preview stays visible while the settings scroll. Every element can be selected, and size and position move in 0.5 pt steps.
- [ ] Overlay and Wipe both work. The Wipe divider can be dragged and set with its slider.
- [ ] "Generate from reference" on the three reference screenshots gets the colors, band type, footer mode and the text of every field right (fixing OCR typos by hand is acceptable).
- [ ] Apply to All with "Keep seats" on keeps each ticket's own seats.
- [ ] Looks restyle a ticket in one tap.
- [ ] Takes persist across restarts, and export → import reproduces a take **with its images**.
- [ ] Fully offline after the first load, **including OCR**.
- [ ] The screen doesn't dim during a 2-minute take.
- [ ] No real brand assets bundled, and nothing scannable.

---

## 13. Open questions, with the v1 default for each (don't block on these)

| # | Question | **What to build in v1** |
|---|---|---|
| 1 | NFC loop length: the rest time between loops isn't known yet. | Use the 3.2 s loop from §5.4. Keep the timings in one constants object so they're easy to retune. |
| 2 | Second screen variant: Wallet's *pass detail* screen, shown in the `detail-sheet-*.png` references. It has a gray `#2C2C2E` sheet with a rounded top, ‹ back and ⓘ buttons, trash and hide-eye buttons at the bottom, and no dots or NFC prompt. | **Out of scope for v1.** Structure the pass view so a second `screenMode` can be added per take later. Use those references only to see the card variants they show: a light card, a photo band, and EXPIRED text in the footer. |
| 3 | Field layout options. | Every field gets `visible` and `labelVisible` toggles in Builder › Content. Presets in Whole card: **3+2** (default), **3+1** (Ticket Type hidden), and **1+GA** (Section shown, Row and Seat hidden, plus a right-aligned value with no label in row 1, like "General Admission"). |
| 4 | Peek on Plus / Pro Max screens. | Keep the gap at 8 pt and the visible peek at about 12 pt on every width. The card width stretches instead. |
| 5 | Card glow. | Keep it **very faint**: the reference shows only a slight blue haze at the left and bottom edges. The mockup's glow is too strong, so don't copy it. Aim for about 10–15% alpha at most. |

---

## 14. Decision log

| Date | Decision |
|---|---|
| 11-07 | Default content is a fictional brand, artist and venue. Real brand assets are never bundled. |
| 11-07 | The reference is 402 pt wide (1206 px @3x). Corrected the peek (about 12 pt), corner radius (about 3 pt) and notch geometry. |
| 11-07 | Ticket count is a stepper in the Organizer. New tickets copy the last one. |
| 11-07 | Three image slots (header logo, band, app icon) in an IndexedDB image library. |
| 11-07 | Dropped the This/All toggle. Replaced it with **Save Ticket** plus **Apply to All** (with confirmation and "Keep seats", on by default). |
| 11-07 | Added the Builder with a reference photo, **Overlay** (opacity) and **Wipe** (split divider). |
| 11-07 | Builder: no drag and drop for editing. Precise steppers and sliders in 0.5 pt steps, in collapsible menus. |
| 11-07 | Builder: the preview, reference bar and element picker stay frozen at the top and the save bar at the bottom, while the settings scroll. |
| 11-07 | Added **Generate from reference** and **Swatches only**: canvas sampling plus Tesseract.js OCR, offline, no AI service. |
| 11-07 | Removed the separate Ticket Editor screen. The Builder replaces it. |
| 11-07 | NFC phone glyph: a black outline about 1.3 pt cuts through the blue ring where the phone overlaps it. |
| 11-07 | NFC animation, measured from a 60 fps recording: the phone shrinks to about 78% (it recedes) while a lighter diagonal band sweeps from top-right to bottom-left, then reverses. The ring stays still, and there's no glow. |
| 11-07 | The NFC tilt is a real 3D `rotateX` with perspective (the top tips away, a slight trapezoid), not a flat scale. |
| 11-07 | Swipe measured: about 0.4 s with no overshoot. The NFC prompt fades out on each swipe, the ring fades back in empty, then the phone slides up into it and the tilt loop restarts. |

---

## 15. Repo and README

- New repo, e.g. `tiniryno-stack/wallet-prop`, deployed with GitHub Pages. `docs/reference/` holds the reference screenshots and recordings.
  - **The reference files show real ticketing brands and a real personal ticket.** Either make the repo **private** (GitHub Pages still works on paid plans), or keep `docs/reference/` out of the public repo by gitignoring it and storing it locally.
- **Fonts:** SF Pro comes from `-apple-system` on iPhone and must not be bundled. In desktop and Linux previews, the fallback fonts are wider and text overflows. That's expected, so always judge fidelity on an iPhone.
- The README covers:
  - how to add the app to the home screen
  - how to open the Organizer (long-press ⋯)
  - the Builder workflow
  - a **pre-shoot checklist**: turn off Live Activities, Focus mode on, brightness max, Low Power Mode off, open the app once online so OCR is cached
