# Fuel v2.1 — update

Replace **app.js** and **sw.js** in your GitHub repo. Then open Settings in the app:
if you see **"Fuel v2.1"** at the very bottom, the new build is live. If not, wait
~1 min for GitHub Pages to redeploy and reopen the app twice (that's the service
worker update cycle).

## v2.1
- **Log by grams**: pick any food → type the exact weight → calories/macros computed precisely. Works for every food whose serving has a gram weight (almost all of them).
- **Edit any food**: tap it in Library → change name, serving label, grams per serving, kcal/P/C/F/fiber. If you change the grams, choose "keep nutrition" (you're correcting a bad parse) or "scale nutrition" (you're redefining the portion — micros and diet tags scale too).
- **Test AI button** in Settings → shows exactly why photo AI fails (missing secret, no credit, bad URL…).
- Real error messages on photo/AI failures instead of "couldn't read photo."

## v2 (if you skipped it)
- 🥦 Diet tab: eat-next recommendations, weekly targets with days-left, fridge expiry tracking, gut-protocol ramp holds, distinct-plants & fermented-variety counters.
- Foods carry diet-group tags (AI-assigned on photo import, editable per food).

## v2.2
- **Tap any logged item** on Today to edit it: change servings, type exact grams, move it to a different meal, or delete — macros, micros, and diet tags all rescale correctly.
- **Separate Camera / Upload buttons** on Photo — Upload opens your photo library so screenshots finally work (the old single button forced the camera on phones).

## v2.3
- **Type the number of servings directly** everywhere: log pane, entry editor, and recipe builder (both ingredient amounts and "makes N servings"). Any value works — 1.33, 3, 0.6. The +/- buttons remain for quick nudges. Servings and grams stay in sync both directions.
- Settings footer now reads "Fuel v2.3" so you can confirm the build is live.

## v2.4
- **Add-food sheet no longer sinks under the keyboard**: the sheet is now fixed-height, so the search box stays at the top of the screen no matter how short the filtered list gets. Search inputs are also sticky, so they stay visible while scrolling long result lists. Same fix applied to the recipe builder.

## v2.5
- **✕ close button on the Add-food sheet** — v2.4's taller sheet left almost no backdrop to tap, which could trap you in the logging page. The ✕ in the header always exits (and cancels a batch label import mid-way).

## v2.6
- **✕ moved to the top-left and made permanently visible**: the Add-food sheet now has a fixed header bar that never scrolls away — the close button is on screen at all times, at any scroll position, keyboard open or not. Recipe builder got a top-left ✕ too.

## v2.7
- **Collapsible meal sections** (Cronometer-style): tap a meal header to fold it down to just the name + calorie subtotal (+ item count). State is remembered between sessions. Logging into a collapsed meal auto-expands it so nothing lands invisibly. The + button still works either way.

## v2.8
- **Search bar fixed for real**: removed the sticky-positioned inputs (mobile Safari makes sticky form fields untappable after scrolling) and rebuilt the sheet as fixed rows — header, tabs, search box — with only the results list scrolling. The search bar now sits in a normal, always-tappable position above the list on every tab.

## v2.9
- **Sign-in fixed for the installed app**: home-screen apps on iPhone open Google sign-in in a popup where the keyboard can never appear (buttons work, typing doesn't). The app now detects installed mode and uses the full-page redirect flow instead — you bounce to the real Google page and back. Redirect errors are now surfaced on the sign-in screen instead of failing silently.

## v3.0
- **App password sign-in** — the reliable path for the installed iPhone app. One-time setup: (1) Firebase console → Authentication → Sign-in method → enable **Email/Password**; (2) open the site in Safari (already signed in) → Settings → **App password** → set one; (3) in the installed app, sign in with your Gmail address + that password. It's linked to the same Google account, so all data is identical. No popups, no redirects — nothing iOS can break.

## v3.0.1
- **iPhone keyboard fix**: removed `user-scalable=no` from the viewport (a known iOS cause of inputs that focus but never raise the keyboard). Patched at runtime from app.js AND recommended as a one-line index.html edit. Inputs also forced selectable as insurance.

## v3.0.2
- **Keyboard-wedge mitigation for iPhone**: the app now blurs any focused input the instant it's backgrounded or the phone locks (the main trigger of iOS's "keyboard stops appearing" bug in home-screen apps), and force-focuses inputs whose tap didn't land. Recovery if it ever wedges anyway: force-close the app first; restart the phone only if that doesn't do it.

## v3.0.3
- **Photo-picker keyboard fix**: returning from the native camera/photo picker can wedge the iOS keyboard in installed apps — the app now runs a silent focus-cycle on your first tap after any picker use to re-engage the keyboard before you hit a real input.

## v3.0.4
- **Tap-only sign-in**: 📋 paste buttons beside the email and password fields fill them from the clipboard (with iOS's permission prompt) — sign in with zero keyboard use when the iOS keyboard bug strikes at launch. Version number now shows on the sign-in screen so you can verify the build before signing in.

## v3.1
- **Units that make sense per food**: liquids now show and log in **ml** (milks and juices updated automatically), solids in **g**; every label reflects the food's real unit. Grams stays the general default. You can set the amount + unit per serving for any food in its editor (Library → tap food).
- **Recipe amount popup**: tapping an ingredient (to add it or to change it) opens the same chooser as logging — type servings or type g/ml, live kcal — then Add/Update. No more cramped inline steppers.

## v3.2
- **Swipe left to delete** on phone for Library foods and logged entries — the delete button no longer sits beside +. Swipe reveals a red Delete; tap anywhere or swipe back to close. Vertical scrolling is unaffected. On desktop (no touch), the inline × remains.
