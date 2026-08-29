// diet.js — weekly/daily nutrition-target engine (restored from the deployed v4.0 bundle)

export const GROUPS = {
            fatty_fish: {
                label: "Fatty fish",
                emoji: "\u{1F41F}"
            },
            legumes: {
                label: "Legumes",
                emoji: "\u{1FAD8}"
            },
            cruciferous: {
                label: "Cruciferous",
                emoji: "\u{1F966}"
            },
            leafy_greens: {
                label: "Leafy greens",
                emoji: "\u{1F96C}"
            },
            nuts_seeds: {
                label: "Nuts & seeds",
                emoji: "\u{1F330}"
            },
            berries: {
                label: "Berries",
                emoji: "\u{1FAD0}"
            },
            red_meat: {
                label: "Red meat",
                emoji: "\u{1F969}"
            },
            fruit: {
                label: "Fruit",
                emoji: "\u{1F34E}"
            },
            veg: {
                label: "Vegetables",
                emoji: "\u{1F955}"
            },
            orange_red: {
                label: "Orange/red veg",
                emoji: "\u{1FAD1}"
            },
            whole_grains: {
                label: "Whole grains",
                emoji: "\u{1F33E}"
            },
            fermented: {
                label: "Fermented",
                emoji: "\u{1F963}"
            },
            eggs: {
                label: "Eggs",
                emoji: "\u{1F95A}"
            }
        };

export const WEEKLY_TARGETS = [{
            id: "fatty_fish",
            type: "floor",
            target: 2,
            unit: "servings",
            conf: "guideline",
            hint: "canned salmon or sardines are the failsafe"
        }, {
            id: "legumes",
            type: "floor",
            target: 6,
            unit: "servings",
            conf: "guideline",
            ramp: !0,
            hint: "\xBD cup cooked = 1 serving"
        }, {
            id: "cruciferous",
            type: "floor",
            target: 5,
            unit: "servings",
            conf: "observational",
            ramp: !0,
            hint: "broccoli, cauli rice, kimchi count"
        }, {
            id: "leafy_greens",
            type: "floor",
            target: 6,
            unit: "servings",
            conf: "MIND diet",
            hint: "wilt spinach into hot dishes"
        }, {
            id: "nuts_seeds",
            type: "floor",
            target: 5,
            unit: "servings",
            conf: "MIND diet",
            hint: "20g portions \u2014 weigh them on a cut"
        }, {
            id: "berries",
            type: "range",
            low: 2,
            high: 5,
            unit: "servings",
            conf: "MIND diet",
            hint: "frozen wild blueberries punch above fresh"
        }, {
            id: "red_meat",
            type: "ceiling",
            target: 3,
            unit: "portions",
            conf: "guideline",
            hint: "1\u20132/wk is fine; fish & poultry cover the rest"
        }];

export const DAILY_TARGETS = [{
            id: "produceG",
            type: "floor",
            target: 400,
            unit: "g",
            label: "Fruit + veg",
            emoji: "\u{1F308}",
            soft: !0
        }, {
            id: "fruit",
            type: "floor",
            target: 2,
            unit: "servings"
        }, {
            id: "veg",
            type: "floor",
            target: 3,
            unit: "servings"
        }, {
            id: "orange_red",
            type: "floor",
            target: 1,
            unit: "serving"
        }, {
            id: "whole_grains",
            type: "floor",
            target: 3,
            unit: "servings"
        }, {
            id: "fermented",
            type: "range",
            low: 1,
            high: 2,
            unit: "servings"
        }, {
            id: "eggs",
            type: "range",
            low: 1,
            high: 2,
            unit: "eggs"
        }];

export const VARIETY = {
            plants: 30,
            ferms: 4
        };

export const RAMP_STEPS = [{
            id: 0,
            label: "Off / resolved",
            note: "Targets fully active."
        }, {
            id: 1,
            label: "Step 1 \xB7 wk 1\u20132",
            note: "Keto bread & pasta removed. Hold legumes, cruciferous, and fermented at current intake \u2014 don't push toward targets yet."
        }, {
            id: 2,
            label: "Step 2 \xB7 wk 3\u20134",
            note: "If unresolved: cut sugar alcohols (check protein powder & Creami mix labels). Still holding fiber sources steady."
        }, {
            id: 3,
            label: "Ramping",
            note: "Add ONE new fiber source at a time, +1 serving/week. Slow is the point."
        }];

export const RAMP_HELD = ["legumes", "cruciferous"];

export const MEDICAL_NOTE = "Bloating with pain, changed bowel habits, blood, or unintended weight change \u2192 see a clinician, not an elimination protocol.";

const R = (re, g, pg = 0, pl = null, fv = null) => ({ re, g, pg, pl, fv });

const RULES = [R(/salmon|sockeye|sardine|mackerel|trout|herring/, {
            fatty_fish: 1
        }), R(/lentil/, {
            legumes: 1,
            veg: 1
        }, 0, "lentil"), R(/chickpea|garbanzo/, {
            legumes: 1,
            veg: 1
        }, 0, "chickpea"), R(/black bean|kidney bean|pinto|navy bean|white bean|refried/, {
            legumes: 1,
            veg: 1
        }, 0, "bean"), R(/split pea/, {
            legumes: 1,
            veg: 1
        }, 0, "split pea"), R(/edamame/, {
            legumes: 1.5,
            veg: 1
        }, 120, "edamame"), R(/hummus/, {
            legumes: .25
        }, 0, "chickpea"), R(/broccoli/, {
            cruciferous: 1,
            veg: 1.5
        }, 130, "broccoli"), R(/cauliflower/, {
            cruciferous: 1,
            veg: 1.3
        }, 110, "cauliflower"), R(/brussels/, {
            cruciferous: 1,
            veg: 1.5
        }, 130, "brussels sprout"), R(/cabbage|coleslaw/, {
            cruciferous: 1,
            veg: 1
        }, 89, "cabbage"), R(/bok choy/, {
            cruciferous: 1,
            leafy_greens: 1,
            veg: 1
        }, 100, "bok choy"), R(/kale/, {
            cruciferous: 1,
            leafy_greens: 1.5,
            veg: 1.2
        }, 100, "kale"), R(/arugula/, {
            cruciferous: .4,
            leafy_greens: 1.5,
            veg: .5
        }, 40, "arugula"), R(/collard/, {
            cruciferous: 1,
            leafy_greens: 1.5,
            veg: 1.2
        }, 100, "collard greens"), R(/kimchi/, {
            fermented: 1,
            cruciferous: .5,
            veg: .5
        }, 75, "cabbage", "kimchi"), R(/sauerkraut/, {
            fermented: 1,
            cruciferous: .5,
            veg: .5
        }, 75, "cabbage", "sauerkraut"), R(/spinach/, {
            leafy_greens: 1.5,
            veg: 1
        }, 80, "spinach"), R(/romaine|mixed greens|spring mix|salad greens|swiss chard|lettuce/, {
            leafy_greens: 1.5,
            veg: 1
        }, 70, "greens"), R(/almond(?!\s*milk)/, {
            nuts_seeds: 1.4
        }, 0, "almond"), R(/walnut/, {
            nuts_seeds: 1.4
        }, 0, "walnut"), R(/cashew/, {
            nuts_seeds: 1.4
        }, 0, "cashew"), R(/pistachio/, {
            nuts_seeds: 1.4
        }, 0, "pistachio"), R(/pecan/, {
            nuts_seeds: 1.4
        }, 0, "pecan"), R(/pumpkin seed|pepitas/, {
            nuts_seeds: 1.4
        }, 0, "pumpkin seed"), R(/sunflower seed/, {
            nuts_seeds: 1.4
        }, 0, "sunflower seed"), R(/chia/, {
            nuts_seeds: 1.4
        }, 0, "chia"), R(/flax/, {
            nuts_seeds: .7
        }, 0, "flax"), R(/mixed nuts|trail mix/, {
            nuts_seeds: 1.4
        }, 0, "mixed nuts"), R(/peanut butter|peanut/, {
            nuts_seeds: .5
        }, 0, "peanut"), R(/blueberr/, {
            fruit: 1.5,
            berries: 1.5
        }, 120, "blueberry"), R(/strawberr/, {
            fruit: 1.5,
            berries: 1.5
        }, 120, "strawberry"), R(/raspberr/, {
            fruit: 1.5,
            berries: 1.5
        }, 110, "raspberry"), R(/blackberr/, {
            fruit: 1.5,
            berries: 1.5
        }, 110, "blackberry"), R(/beef|steak|sirloin|ribeye|brisket/, {
            red_meat: 1
        }), R(/\bpork\b|pork chop|tenderloin/, {
            red_meat: 1
        }), R(/\blamb\b/, {
            red_meat: 1
        }), R(/carrot/, {
            orange_red: 1,
            veg: .8
        }, 61, "carrot"), R(/sweet potato|yam/, {
            orange_red: 1,
            veg: 1
        }, 114, "sweet potato"), R(/bell pepper|red pepper|mini pepper/, {
            orange_red: 1,
            veg: 1.2
        }, 100, "bell pepper"), R(/tomato|marinara/, {
            orange_red: .8,
            veg: 1
        }, 100, "tomato"), R(/butternut|pumpkin(?!\s*seed)/, {
            orange_red: 1,
            veg: 1.2
        }, 120, "squash"), R(/oat/, {
            whole_grains: 2
        }, 0, "oats"), R(/brown rice|wild rice/, {
            whole_grains: 1.5
        }, 0, "brown rice"), R(/quinoa/, {
            whole_grains: 1.5
        }, 0, "quinoa"), R(/barley/, {
            whole_grains: 1.5
        }, 0, "barley"), R(/farro/, {
            whole_grains: 1.5
        }, 0, "farro"), R(/buckwheat/, {
            whole_grains: 1.5
        }, 0, "buckwheat"), R(/whole wheat|whole grain|wholemeal/, {
            whole_grains: 1
        }, 0, "wheat"), R(/greek yogurt|skyr/, {
            fermented: 1
        }, 0, null, "greek yogurt"), R(/kefir/, {
            fermented: 1
        }, 0, null, "kefir"), R(/yogurt/, {
            fermented: 1
        }, 0, null, "yogurt"), R(/tempeh/, {
            fermented: 1
        }, 0, "soy", "tempeh"), R(/miso/, {
            fermented: .5
        }, 0, "soy", "miso"), R(/kombucha/, {
            fermented: 1
        }, 0, null, "kombucha"), R(/\begg white/, {}), R(/\beggs?\b/, {
            eggs: 1
        }), R(/avocado/, {
            fruit: 1
        }, 100, "avocado"), R(/apple(?!\s*juice)/, {
            fruit: 1.5
        }, 150, "apple"), R(/banana/, {
            fruit: 1.5
        }, 118, "banana"), R(/orange(?!\s*juice)|clementine|mandarin/, {
            fruit: 1.5
        }, 130, "orange"), R(/grape(?!fruit)(?!\s*juice)/, {
            fruit: 1.5
        }, 130, "grape"), R(/grapefruit/, {
            fruit: 1.5
        }, 123, "grapefruit"), R(/watermelon|cantaloupe|honeydew|melon/, {
            fruit: 1.5
        }, 150, "melon"), R(/mango/, {
            fruit: 1.5
        }, 140, "mango"), R(/pineapple/, {
            fruit: 1.5
        }, 140, "pineapple"), R(/peach|nectarine|plum|apricot/, {
            fruit: 1.5
        }, 130, "stone fruit"), R(/pear/, {
            fruit: 1.5
        }, 150, "pear"), R(/cherr/, {
            fruit: 1.5
        }, 130, "cherry"), R(/kiwi/, {
            fruit: 1
        }, 69, "kiwi"), R(/pomegranate/, {
            fruit: 1
        }, 87, "pomegranate"), R(/cucumber|pickle/, {
            veg: .8
        }, 80, "cucumber"), R(/onion|shallot|leek/, {
            veg: .8
        }, 70, "onion"), R(/garlic/, {}, 0, "garlic"), R(/green bean/, {
            veg: 1.3
        }, 110, "green bean"), R(/zucchini|squash/, {
            veg: 1.5
        }, 130, "zucchini"), R(/mushroom/, {
            veg: 1.5
        }, 120, "mushroom"), R(/asparagus/, {
            veg: 1.5
        }, 130, "asparagus"), R(/celery/, {
            veg: .8
        }, 70, "celery"), R(/eggplant/, {
            veg: 1.3
        }, 110, "eggplant"), R(/corn(?!\s*tortilla)/, {
            veg: 1
        }, 0, "corn"), R(/\bpea(s)?\b/, {
            veg: 1,
            legumes: .5
        }, 80, "pea"), R(/beet/, {
            veg: 1
        }, 85, "beet"), R(/radish/, {
            cruciferous: .5,
            veg: .5
        }, 50, "radish"), R(/mixed vegetable|stir.?fry veg|veggie mix/, {
            veg: 2
        }, 160, "mixed vegetables"), R(/potato(?!\s*chip)/, {
            veg: 1
        }, 0, "potato")];

export function autoTag(name) {
  const s = (name || "").toLowerCase();
  const out = { g: {}, pg: 0, pl: null, fv: null };
  const fried = /fried|tempura|battered/.test(s);
  const juiced = /juice|smoothie(?!\s*bowl)/.test(s);
  const cottage = /cottage/.test(s);
  const eggwhite = /egg\s*white/.test(s);
  for (const r of RULES) if (r.re.test(s)) {
    for (const k of Object.keys(r.g)) {
      const v = r.g[k];
      if (k === "fatty_fish" && fried) continue;
      if ((k === "fruit" || k === "berries") && juiced) continue;
      if (k === "fermented" && cottage) continue;
      if (k === "eggs" && eggwhite) continue;
      out.g[k] = Math.max(out.g[k] || 0, v);
    }
    if (!juiced && r.pg > out.pg) out.pg = r.pg;
    if (!out.pl && r.pl) out.pl = r.pl;
    if (!out.fv && r.fv && !cottage) out.fv = r.fv;
  }
  if (/potato(?!\s*chip)/.test(s) && !/sweet/.test(s)) out.pg = 0;
  return out;
}

export function ensureTags(food) {
  const t = food.tags;
  if (t && (t.g || t.groups)) {
    const g = {};
    const src = t.g || t.groups || {};
    Object.keys(GROUPS).forEach((k) => { const v = +src[k]; if (v > 0) g[k] = Math.min(v, 5); });
    return { g, pg: Math.max(0, Math.min(+t.pg || +t.produce_g || 0, 1500)), pl: t.pl || t.plant || null, fv: t.fv || t.ferm || null };
  }
  return autoTag(food.name);
}

export function scaleEntryTags(tags, qty) {
  const tg = {};
  Object.keys(tags.g || {}).forEach((k) => (tg[k] = Math.round(tags.g[k] * qty * 100) / 100));
  return { tg, pgq: Math.round((tags.pg || 0) * qty), pl: tags.pl || null, fv: tags.fv || null };
}

export function dayTagTotals(day, MEALS) {
  const g = {}; let pg = 0, fb = 0; const pl = new Set(), fv = new Set();
  MEALS.forEach(({ key }) => (day.meals[key] || []).forEach((e) => {
    Object.keys(e.tg || {}).forEach((k) => (g[k] = Math.round(((g[k] || 0) + e.tg[k]) * 100) / 100));
    pg += e.pgq || 0; fb += e.fiber || 0;
    if (e.pl) pl.add(e.pl); if (e.fv) fv.add(e.fv);
  }));
  return { g, pg: Math.round(pg), fb: Math.round(fb * 10) / 10, pl: [...pl], fv: [...fv] };
}

export function sumWeek(dayTags, dates) {
  const g = {}; let pg = 0, fbSum = 0, fbN = 0; const pl = new Set(), fv = new Set();
  dates.forEach((d) => {
    const t = dayTags[d]; if (!t) return;
    Object.keys(t.g || {}).forEach((k) => (g[k] = Math.round(((g[k] || 0) + t.g[k]) * 100) / 100));
    pg += t.pg || 0;
    if (t.fb != null) { fbSum += t.fb; fbN++; }
    (t.pl || []).forEach((x) => pl.add(x)); (t.fv || []).forEach((x) => fv.add(x));
  });
  return { g, pg, fbAvg: fbN ? Math.round((fbSum / fbN) * 10) / 10 : 0, plants: pl.size, ferms: fv.size };
}

export const FOOD_IDEAS = {
        fatty_fish: "canned salmon or sardines \u2014 the cheap failsafe",
        legumes: "\xBD cup lentils or chickpeas into whatever you're cooking",
        cruciferous: "broccoli, cauliflower rice, or a scoop of kimchi",
        leafy_greens: "wilt spinach into eggs, pasta, or soup",
        nuts_seeds: "20g walnuts or pumpkin seeds (weigh it)",
        berries: "\xBD cup frozen wild blueberries on the Creami",
        fruit: "a banana or an apple \u2014 easy volume",
        veg: "any vegetable \u2014 cucumbers and zucchini are near-free calories",
        orange_red: "carrots keep 3+ weeks \u2014 lowest-waste option",
        whole_grains: "oats or \xBD cup brown rice",
        fermented: "Greek yogurt or kefir \u2014 vary the type across the week",
        eggs: "1\u20132 whole eggs (whites don't count here)"
    };

const SHELF = [
        [/raw chicken|chicken breast raw|ground (beef|turkey) raw|raw fish|raw salmon|raw shrimp/, 2],
        [/cooked chicken|cooked beef|cooked rice|leftover/, 4],
        [/arugula|herb|cilantro|basil|asparagus/, 4],
        [/spinach|mixed greens|spring mix|lettuce|salad/, 5],
        [/strawberr|blackberr|cherr/, 5],
        [/raspberr/, 3],
        [/blueberr/, 10],
        [/avocado|banana/, 4],
        [/grape/, 7],
        [/peach|nectarine|plum|mango/, 5],
        [/broccoli|green bean|zucchini|cucumber|mushroom|bell pepper/, 8],
        [/cauliflower|brussels/, 10],
        [/tomato/, 6],
        [/apple|orange|citrus/, 21],
        [/carrot|celery|beet/, 25],
        [/cabbage|onion/, 30],
        [/milk|kefir/, 7],
        [/greek yogurt|yogurt|cottage/, 12],
        [/tofu/, 7],
        [/hummus/, 7],
        [/egg/, 21],
        [/deli|sliced turkey|sliced ham/, 4],
        [/kimchi|sauerkraut|pickle|miso/, 60],
        [/bread|sourdough|tortilla/, 6],
        [/cheese/, 21]
    ];

export function guessShelf(name) {
  const s = (name || "").toLowerCase();
  for (const [re, d] of SHELF) if (re.test(s)) return d;
  return 7;
}

// Restored helper (superseded by the Next-up card in v4.0; kept for compatibility)
export function recommend({ week, today, held = [], daysLeft = 7 }) {
  const out = [];
  WEEKLY_TARGETS.forEach((w) => {
    if (w.type === "ceiling" || held.includes(w.id)) return;
    const goal = w.type === "range" ? w.low : w.target;
    const need = goal - (week.g[w.id] || 0);
    if (need > 0) out.push({ id: w.id, need, urgency: need / Math.max(1, daysLeft), idea: FOOD_IDEAS[w.id] });
  });
  DAILY_TARGETS.forEach((d) => {
    if (d.id === "produceG") return;
    const goal = d.type === "range" ? d.low : d.target;
    const have = today.g[d.id] || 0;
    if (have < goal) out.push({ id: d.id, need: goal - have, urgency: goal - have, idea: FOOD_IDEAS[d.id], daily: true });
  });
  return out.sort((a, b) => b.urgency - a.urgency);
}
