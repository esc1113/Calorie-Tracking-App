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
