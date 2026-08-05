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
