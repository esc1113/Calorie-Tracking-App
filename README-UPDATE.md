# Fuel v2 — Diet targets, fridge tracking, food tags

## Install (2 files)
Replace these two files in your GitHub repo (edit → paste, or delete + re-upload):
1. **app.js**
2. **sw.js**

That's it — index.html, manifest, and icons are unchanged. Hard-refresh once (or close and reopen the installed app twice) and the new 🥦 **Diet** tab appears.

## What happens to your existing data
Migration is automatic on first load:
- Every food already in your library gets diet-group tags (seed foods get hand-verified tags, your photo imports get keyword-detected ones).
- New failsafe foods appear: canned salmon, sardines, kimchi, sauerkraut, kefir, tempeh, miso, pumpkin seeds, frozen wild blueberries, and more.
- Nothing you've logged is touched. Weekly counts start from today.

## New in this version
- **🥦 Diet tab**: "Eat next" recommendations, weekly targets with days-left context, today's food-group chips, distinct-plants + fermented-variety counters, fiber ramp watch.
- **Fridge**: log fresh groceries with purchase date → shelf-life countdown. Expiring items that fill a diet gap jump to the top of "Eat next."
- **Gut protocol**: ramp step selector — while on steps 1–2, legumes & cruciferous show "hold" and recommendations won't push them.
- **Tags everywhere**: photo/label/describe imports are tagged by the AI in the same call. Tap any food in Library to edit what it counts toward.
- Baked-in rules: fried ≠ fatty fish, juice ≠ fruit, white potato ≠ 400g produce, egg whites ≠ eggs, cottage cheese fermented only if you flip it on.
