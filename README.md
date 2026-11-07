# Wallet Prop

A home-screen web app used as an **on-camera prop**. It opens straight into a copy of an iOS Wallet event-ticket screen. The actor swipes through the tickets, and a hidden Organizer lets the crew restyle them on set. Everything runs on the phone and works offline. There's no backend, no account and no AI service.

**Live:** https://tiniryno-stack.github.io/Walet-App/

> GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. The app is plain static files, so there's no build step.

---

## 1. Put it on the home screen (iPhone)

1. Open the link above in **Safari** while you have signal.
2. Tap **Share → Add to Home Screen**. It's named **Wallet**.
3. Launch it from the home screen. It opens full screen, with the real status bar drawn over black.
4. Leave it open for about 10 seconds the first time, so it can cache everything, including the 10 MB text-reading engine. After that it works in airplane mode.

To update after a new deploy, open the app twice. The first launch downloads the update in the background and the second launch shows it.

## 2. On camera

- Swipe left and right through the tickets. You'll see 12 pt peeks, live dots, and the "Hold Near Reader" animation restarting after every swipe.
- **✕ and a normal tap on ⋯ do nothing**, so it's safe if the actor brushes them.
- **Long-press ⋯ for 0.6 s** to open the Organizer.
- The screen stays awake while the app is open.

## 3. Organizer (hidden)

| Control | What it does |
|---|---|
| **Take › Switch** | Load another saved take. The app reopens to the last take you loaded. |
| **Number of tickets** − / + | Adding copies the source ticket (see the next row). Removing deletes from the end, and asks first if that ticket had its own edits. |
| **New tickets copy** | Which ticket new ones are copied from (default: the last one). |
| **Start on** | Which ticket shows at launch. |
| Ticket rows | **Tap** to open the ticket in the Builder. **Swipe left** for Duplicate and Delete. **Drag ≡** to reorder. **Edit** shows inline delete and copy buttons. |
| **Save as New Take… / Rename / Delete** | Manage takes. |
| **Export JSON** | Copies the whole setup, **with images embedded**, or shares/saves it as a file. Use this to move a setup between phones. |
| **Import JSON** | Paste or pick a file. Restores the images first, then the config, so you get an exact copy. |
| **Done** | Back to the pass view, at the take's start ticket. |

## 4. Builder workflow

The top of the Builder stays frozen: a live preview of the card, the reference bar and the element picker. Only the settings scroll, and **Save Ticket / Apply to All** stay pinned at the bottom.

1. **Upload a reference** with the picture button. A full-screen iPhone screenshot lines up automatically. For anything else, tap **Align**, then drag and pinch the photo onto the card.
2. **Generate from reference** fills in the card color, band (solid or photo), label and value colors, footer type (NFC, text or none), the field layout and the logo crops. It also reads every field's text on the phone. Fields it wasn't sure about get an **orange dot**. **Swatches only** just pulls the 8 main colors out of the photo.
3. **Check it with Wipe.** The reference shows on the left of the divider and your build on the right. Drag the round handle or the slider, or tap 50/50. If a color jumps at the line, it doesn't match yet. **Overlay** shows the reference at an adjustable opacity, for matching positions.
4. **Tweak.** Tap any element on the card, or use ‹ ›, to pick one of the 13 elements. Then use:
   - **Content:** text, editable labels, *+ alt value* for the later glitch phase, show/hide, and images (Upload / Library / Use text).
   - **Color & size:** swatches, a hex code or a color picker, and text size in 0.5 pt steps.
   - **Position:** ← → ↑ ↓ moves 0.5 pt per tap, sliders do big moves, plus Reset.
   - **Whole card & looks:** looks, card background, and field layout (3 + 2, 3 + 1 or 1 + GA).
5. **Save Ticket** saves just this ticket. **Apply to All** copies this ticket onto every ticket in the take. *Keep each ticket's Section, Row and Seat* is on by default, so the seats stay unique.
6. **+ Save as look** stores the style for one-tap reuse. The starter looks are Dark · blue band, Lavender · black band and Dark · expired.

> ⚠️ Generated logo crops copy the original brand's art. For anything that's on camera, replace the header logo, band and app-icon images with original art.

## 5. Pre-shoot checklist

- [ ] Open the app once **with signal** so it's fully cached, including OCR. Then test it in airplane mode.
- [ ] Turn off **Live Activities** and any Dynamic Island apps, such as sports scores, timers and music.
- [ ] Turn a **Focus** mode on, so no notifications appear.
- [ ] Set **brightness to max**, and turn **auto-brightness** off if you need to.
- [ ] Turn **Low Power Mode off**. It can drop animations below 60 fps.
- [ ] Load the right **take** and check **Start on**.
- [ ] Do a test swipe through every ticket.

---

## Developer notes

- Vanilla ES modules, no build step. Serve the repo root (`python3 -m http.server`) and open it. Add `?nosw` to skip the service worker while developing.
- **All layout constants and animation timings** are in `js/constants.js`, so you can retune them after testing on a phone.
- Data: `localStorage["walletProp.v2"]`. Images: IndexedDB `walletProp.images`. v1 configs migrate automatically (`js/store.js`).
- Every rendered field has a stable `data-field` attribute. `js/glitch.js` is the stub for the glitch phase.
- The OCR engine (Tesseract.js 5, Apache-2.0) and its English data are bundled in `vendor/tesseract/`. The service worker caches them.
- Colors are stored as **Display P3** hex values, the same values you'd sample from an iPhone screenshot, and rendered with `color(display-p3 …)`.
- `docs/SPEC.md` is the spec, and its §14 is the decision log. `docs/design/` holds the mockups. `docs/reference/` (the real-brand screenshots) is **gitignored on purpose**. Keep it local only.
- Linux and desktop browsers don't have SF Pro, so text looks wider there. Always judge fidelity on an iPhone.
