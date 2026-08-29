import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut, signInWithEmailAndPassword, EmailAuthProvider, linkWithCredential, updatePassword } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, writeBatch } from "firebase/firestore";
import { SEED_FOODS } from "./seed.js";
import { GROUPS, WEEKLY_TARGETS, DAILY_TARGETS, VARIETY, RAMP_STEPS, RAMP_HELD, MEDICAL_NOTE, FOOD_IDEAS, autoTag, ensureTags, scaleEntryTags, dayTagTotals, sumWeek, recommend, guessShelf } from "./diet.js";

const CFG = (typeof window !== "undefined" && window.FUEL_CONFIG) || {};
if (CFG.workerUrl && !/^https?:\/\//i.test(CFG.workerUrl)) CFG.workerUrl = "https://" + CFG.workerUrl.replace(/^\/+/, "");
const IS_STANDALONE = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

// iOS keyboard-wedge mitigations + viewport hygiene (belt and braces; root cause fixed in index.html)
if (typeof document !== "undefined") try {
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && /user-scalable\s*=\s*no/i.test(vp.content)) vp.setAttribute("content", vp.content.replace(/,?\s*user-scalable\s*=\s*no/gi, "").replace(/,?\s*maximum-scale\s*=\s*[\d.]+/gi, ""));
  const st = document.createElement("style");
  st.textContent = "input, textarea, select { -webkit-user-select: text !important; user-select: text !important; }";
  document.head.appendChild(st);
  document.addEventListener("visibilitychange", () => { try { if (document.visibilityState === "hidden") document.activeElement?.blur?.(); } catch {} });
  window.addEventListener("pagehide", () => { try { document.activeElement?.blur?.(); } catch {} });
  document.addEventListener("touchend", (ev) => {
    const el = ev.target;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    setTimeout(() => { try { if (document.activeElement !== el && !el.disabled && !el.readOnly) el.focus({ preventScroll: true }); } catch {} }, 60);
  }, { passive: true });
  let pickerUsed = false;
  document.addEventListener("change", (ev) => { if (ev.target && ev.target.type === "file") pickerUsed = true; }, true);
  document.addEventListener("touchstart", () => {
    if (!pickerUsed) return; pickerUsed = false;
    try {
      const ghost = document.createElement("input");
      ghost.type = "text"; ghost.readOnly = true;
      ghost.style.cssText = "position:fixed;top:-100px;left:0;opacity:0;height:1px;width:1px;pointer-events:none;";
      document.body.appendChild(ghost);
      ghost.focus({ preventScroll: true });
      setTimeout(() => { ghost.blur(); ghost.remove(); }, 90);
    } catch {}
  }, { passive: true, capture: true });
} catch {}

const app = initializeApp(CFG.firebase || {});
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

const MEALS = [
  { key: "misc", label: "Miscellaneous", icon: "💊" },
  { key: "breakfast", label: "Breakfast", icon: "☀️" },
  { key: "lunch", label: "Lunch", icon: "🥗" },
  { key: "dinner", label: "Dinner", icon: "🍽" },
  { key: "snacks", label: "Snacks", icon: "🍿" },
];

const RDA = {
  fiber: { label: "Fiber", unit: "g", amt: 38 },
  vitA: { label: "Vitamin A", unit: "mcg", amt: 900 },
  vitC: { label: "Vitamin C", unit: "mg", amt: 90 },
  vitD: { label: "Vitamin D", unit: "mcg", amt: 15 },
  vitE: { label: "Vitamin E", unit: "mg", amt: 15 },
  vitK: { label: "Vitamin K", unit: "mcg", amt: 120 },
  b6: { label: "Vitamin B6", unit: "mg", amt: 1.3 },
  b12: { label: "Vitamin B12", unit: "mcg", amt: 2.4 },
  folate: { label: "Folate", unit: "mcg", amt: 400 },
  calcium: { label: "Calcium", unit: "mg", amt: 1000 },
  iron: { label: "Iron", unit: "mg", amt: 8 },
  magnesium: { label: "Magnesium", unit: "mg", amt: 400 },
  zinc: { label: "Zinc", unit: "mg", amt: 11 },
  potassium: { label: "Potassium", unit: "mg", amt: 3400 },
  sodium: { label: "Sodium", unit: "mg", amt: 2300, limit: true },
};

const THEMES = {
  light: { bg: "#F7FAF9", card: "#FFFFFF", cardAlt: "#F1F5F4", bg2: "#F1F5F4", border: "#E3EAE8", text: "#17211F", sub: "#5C6B68", mut: "#8CA09B", mint: "#0D9488", mintSoft: "#D6F0EC", green: "#1D9E75", red: "#E24B4A", amber: "#D97706", barBg: "#E6EDEB", navBg: "#FFFFFFEE" },
  dark: { bg: "#0F1514", card: "#182120", cardAlt: "#1F2A29", bg2: "#1F2A29", border: "#243230", text: "#E7EFED", sub: "#93A5A1", mut: "#61736F", mint: "#2DD4BF", mintSoft: "#123A36", green: "#4ADE80", red: "#F08080", amber: "#F0A93C", barBg: "#243230", navBg: "#141B1AEE" },
};

const pad2 = (n) => String(n).padStart(2, "0");
const dstr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => dstr(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return dstr(d); };
const addMonths = (s, n) => { const d = new Date(s + "T12:00:00"); d.setMonth(d.getMonth() + n); return dstr(d); };
const clampD = (s) => (s > todayStr() ? todayStr() : s);
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
const shortDate = (s) => new Date(s + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const mondayOf = (s) => addDays(s, -((new Date(s + "T12:00:00").getDay() + 6) % 7));
const nutrWeekStartOf = (s, mode) => { const g = new Date(s + "T12:00:00").getDay(); return mode === "mon" ? addDays(s, -((g + 6) % 7)) : addDays(s, -g); };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const rnd = (n, d = 0) => { const p = Math.pow(10, d); return Math.round(((+n || 0) + Number.EPSILON) * p) / p; };
const fmtN = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString());
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|\s|,)\w/g, (m) => m.toUpperCase());
const HAS_TOUCH = typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);

async function askClaude(content) {
  if (!CFG.workerUrl) throw new Error("no-worker");
  const res = await fetch(CFG.workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function aiErrMsg(e, fallback) {
  const m = (e && e.message) || "";
  if (m === "no-worker") return "Add your Worker URL in index.html to enable AI";
  if (m === "img-decode") return "Couldn't decode that image — use a JPG/PNG or a screenshot";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Can't reach your Worker — check the URL in index.html (needs https://) and your connection";
  if (m && m !== "API error") return "AI error: " + m.slice(0, 140);
  return fallback;
}

function extractJSON(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  const a = text.indexOf("["), b = text.lastIndexOf("]");
  let raw = null;
  if (a !== -1 && (s === -1 || a < s)) raw = text.slice(a, b + 1); else if (s !== -1) raw = text.slice(s, e + 1);
  if (!raw) throw new Error("No JSON in response");
  return JSON.parse(raw);
}

const FOOD_SCHEMA = '{"name": string, "brand": string|null, "serving": string like "1 scoop (31g)" or "1 cup (226g)", "cal": number, "p": grams protein, "c": grams carbs, "f": grams fat, "fiber": g|null, "sugar": g|null, "satfat": g|null, "micros": {"sodium": mg, "potassium": mg, "calcium": mg, "iron": mg, "magnesium": mg, "zinc": mg, "vitA": mcg, "vitC": mg, "vitD": mcg, "vitE": mg, "vitK": mcg, "b6": mg, "b12": mcg, "folate": mcg}, "tags": {"groups": {object with ONLY the applicable keys from [fatty_fish (not fried), legumes, cruciferous, leafy_greens, nuts_seeds (20g = 1), berries, red_meat (beef/pork/lamb), fruit (80g = 1; juice = 0), veg (80g = 1), orange_red (carrots/peppers/tomato/sweet potato/squash), whole_grains (16g whole grain = 1), fermented (live cultures only), eggs (whole eggs only)] mapped to servings-per-serving as numbers}, "produce_g": grams of fruit+vegetables per serving counting toward WHO 400g/day (0 for white potato and juice), "plant": lowercase plant identity like "broccoli" or null, "ferm": fermented type like "greek yogurt" or null}}';

async function parseLabelImage(base64, mediaType) {
  const txt = await askClaude([
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    { type: "text", text: `Read the nutrition information in this image carefully. It may be a printed nutrition facts label OR a screenshot of nutrition info from an app or website. Extract per-serving values. Respond with ONLY valid JSON, no markdown fences, exactly this shape: ${FOOD_SCHEMA}. In micros, include only nutrients actually shown; omit the rest. Convert %DV to amounts if needed (use FDA adult daily values). Use null for values not shown. If the image contains no nutrition information at all, return {"error":"no nutrition info"}.` },
  ]);
  return extractJSON(txt);
}

async function parseMealImage(base64, mediaType) {
  const txt = await askClaude([
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    { type: "text", text: `Estimate the nutrition of the food shown in this photo as one combined entry. Use USDA-typical values and visually estimate portion sizes. Respond with ONLY valid JSON, no markdown, exactly: ${FOOD_SCHEMA}. Set serving to a portion description like "1 plate as shown". Estimate the main micros. If no food is visible, return {"error":"no food"}.` },
  ]);
  return extractJSON(txt);
}

async function parseTextFood(desc) {
  const txt = await askClaude([
    { type: "text", text: `The user ate: "${desc}". Using USDA-typical nutrition data, estimate the total for exactly that quantity as one entry. Respond with ONLY valid JSON, no markdown, exactly: ${FOOD_SCHEMA}. Set serving to the quantity described. Give a short clean name. Include your best estimate of the listed micros.` },
  ]);
  return extractJSON(txt);
}

async function suggestForGaps(summary) {
  const txt = await askClaude([
    { type: "text", text: `A user tracking their diet has these remaining targets today: ${summary}. Suggest 3 specific foods with approximate amounts that fill the biggest gaps efficiently. Respond ONLY with JSON: [{"food": string, "amount": string, "why": string under 12 words}]` },
  ]);
  return extractJSON(txt);
}

async function usdaSearch(q) {
  if (!CFG.usdaKey) return [];
  try {
    const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(CFG.usdaKey)}&query=${encodeURIComponent(q)}&pageSize=8&dataType=Foundation,SR%20Legacy,Branded`);
    const j = await r.json();
    return (j.foods || []).map((fd) => {
      const n = {}; (fd.foodNutrients || []).forEach((x) => { if (n[x.nutrientId] == null) n[x.nutrientId] = x.value; });
      const g = (id) => +n[id] || 0;
      return {
        name: titleCase(fd.description), brand: fd.brandOwner || fd.brandName || null, serving: "100 g",
        cal: g(1008) || g(2047) || g(2048), p: g(1003), c: g(1005), f: g(1004), fiber: g(1079), sugar: n[2000] == null ? null : g(2000),
        micros: { sodium: g(1093), potassium: g(1092), calcium: g(1087), iron: g(1089), magnesium: g(1090), zinc: g(1095), vitA: g(1106), vitC: g(1162), vitD: g(1114), vitE: g(1109), vitK: g(1185), b6: g(1175), b12: g(1178), folate: g(1190) || g(1177) },
        src: "usda",
      };
    }).filter((x) => x.cal > 0 || x.p > 0 || x.c > 0 || x.f > 0);
  } catch { return []; }
}

async function offSearch(q) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments`);
    const j = await r.json();
    return (j.products || []).map((pr) => {
      const n = pr.nutriments || {};
      return {
        name: titleCase(pr.product_name || "Unknown"), brand: (pr.brands || "").split(",")[0] || null, serving: "100 g",
        cal: +n["energy-kcal_100g"] || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0,
        fiber: +n.fiber_100g || 0, sugar: n.sugars_100g == null ? null : +n.sugars_100g,
        micros: { sodium: rnd((+n.sodium_100g || 0) * 1000), calcium: rnd((+n.calcium_100g || 0) * 1000), iron: rnd((+n.iron_100g || 0) * 1000, 1), potassium: rnd((+n.potassium_100g || 0) * 1000) },
        src: "off",
      };
    }).filter((x) => x.cal > 0 && x.name !== "Unknown");
  } catch { return []; }
}

function downscale(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.88).split(",")[1]);
      };
      img.onerror = () => reject(new Error("img-decode"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("img-decode"));
    reader.readAsDataURL(file);
  });
}

// serving-unit model: prefer explicit gServ/uServ on the food, else parse the last "(N g|ml)" in the serving text
function servUnit(food) {
  if (food.gServ > 0) return { amt: food.gServ, unit: food.uServ === "ml" ? "ml" : "g" };
  const m = [...String(food.serving || "").matchAll(/(\d+(?:\.\d+)?)\s*(g|ml)\b/gi)];
  if (!m.length) return null;
  const last = m[m.length - 1];
  return { amt: +last[1], unit: last[2].toLowerCase() };
}
function servG(food) { const u = servUnit(food); return u ? u.amt : null; }

const M0 = () => ({ sodium: 0, potassium: 0, calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitA: 0, vitC: 0, vitD: 0, vitE: 0, vitK: 0, b6: 0, b12: 0, folate: 0 });
function mkFood(o, src) {
  return { id: uid(), name: o.name || "Food", brand: o.brand || null, serving: o.serving || "1 serving", cal: rnd(o.cal || 0), p: rnd(o.p || 0, 1), c: rnd(o.c || 0, 1), f: rnd(o.f || 0, 1), fiber: rnd(o.fiber || 0, 1), sugar: o.sugar == null ? null : rnd(o.sugar, 1), satfat: o.satfat == null ? null : rnd(o.satfat, 1), micros: { ...M0(), ...(o.micros || {}) }, gServ: o.gServ || null, uServ: o.uServ || null, tags: ensureTags(o), fav: false, uses: 0, lastUsed: null, kind: o.kind || "food", src: o.src || src };
}

function emptyDay() { return { meals: { misc: [], breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0 }; }

function entryFromFood(food, qty) {
  const m = {}; Object.keys(M0()).forEach((k) => (m[k] = rnd((food.micros?.[k] || 0) * qty, 1)));
  const t = scaleEntryTags(food.tags && food.tags.g ? food.tags : autoTag(food.name), qty);
  return { id: uid(), foodId: food.id, name: food.name, serving: food.serving, qty, cal: rnd(food.cal * qty), p: rnd(food.p * qty, 1), c: rnd(food.c * qty, 1), f: rnd(food.f * qty, 1), fiber: rnd((food.fiber || 0) * qty, 1), micros: m, tg: t.tg, pgq: t.pgq, pl: t.pl, fv: t.fv, time: Date.now() };
}

function rescaleEntry(entry, food, qty) {
  const q0 = entry.qty || 1;
  const per = food
    ? { cal: food.cal, p: food.p, c: food.c, f: food.f, fiber: food.fiber || 0, micros: food.micros || {}, tags: food.tags && food.tags.g ? food.tags : autoTag(food.name) }
    : { cal: entry.cal / q0, p: entry.p / q0, c: entry.c / q0, f: entry.f / q0, fiber: (entry.fiber || 0) / q0,
        micros: Object.fromEntries(Object.keys(entry.micros || {}).map((k) => [k, (entry.micros[k] || 0) / q0])),
        tags: { g: Object.fromEntries(Object.keys(entry.tg || {}).map((k) => [k, entry.tg[k] / q0])), pg: (entry.pgq || 0) / q0, pl: entry.pl, fv: entry.fv } };
  const m = {}; Object.keys(M0()).forEach((k) => (m[k] = rnd((per.micros[k] || 0) * qty, 1)));
  const t = scaleEntryTags(per.tags, qty);
  return { ...entry, qty: rnd(qty, 4), cal: rnd(per.cal * qty), p: rnd(per.p * qty, 1), c: rnd(per.c * qty, 1), f: rnd(per.f * qty, 1), fiber: rnd(per.fiber * qty, 1), micros: m, tg: t.tg, pgq: t.pgq };
}

function sumEntries(items) {
  const t = { cal: 0, p: 0, c: 0, f: 0, fiber: 0, pg: 0, micros: M0(), tg: {} };
  (items || []).forEach((e) => {
    t.cal += e.cal || 0; t.p += e.p || 0; t.c += e.c || 0; t.f += e.f || 0; t.fiber += e.fiber || 0; t.pg += e.pgq || 0;
    Object.keys(t.micros).forEach((k) => (t.micros[k] += e.micros?.[k] || 0));
    Object.keys(e.tg || {}).forEach((k) => (t.tg[k] = rnd((t.tg[k] || 0) + e.tg[k], 2)));
  });
  t.cal = Math.round(t.cal);
  ["p", "c", "f", "fiber"].forEach((k) => (t[k] = rnd(t[k], 1)));
  Object.keys(t.micros).forEach((k) => (t.micros[k] = rnd(t.micros[k], 1)));
  t.pg = Math.round(t.pg);
  return t;
}

function dayTotals(day) {
  const t = { cal: 0, p: 0, c: 0, f: 0, fiber: 0, micros: M0(), count: 0 };
  if (!day) return t;
  MEALS.forEach(({ key }) => (day.meals[key] || []).forEach((e) => {
    t.cal += e.cal; t.p += e.p; t.c += e.c; t.f += e.f; t.fiber += e.fiber || 0; t.count++;
    Object.keys(t.micros).forEach((k) => (t.micros[k] += e.micros?.[k] || 0));
  }));
  return t;
}

function ewmaTrend(ws) { let t = null; return ws.map((x) => { t = t == null ? x.w : t + 0.3 * (x.w - t); return { ...x, t: rnd(t, 2) }; }); }

function calcTDEE(logCals, weightsMap, windowDays = 21, endDate = null) {
  const end = endDate || todayStr();
  const all = Object.keys(weightsMap).sort().map((d) => ({ d, w: weightsMap[d] }));
  const start = addDays(end, -windowDays);
  const trend = ewmaTrend(all).filter((x) => x.d >= start && x.d <= end);
  if (trend.length < 4) return { ok: false, why: "Need at least 4 weigh-ins in the last 3 weeks" };
  const first = trend[0], last = trend[trend.length - 1];
  const span = daysBetween(first.d, last.d);
  if (span < 7) return { ok: false, why: "Weigh-ins need to span at least 7 days" };
  const days = [];
  for (let d = first.d; d < last.d; d = addDays(d, 1)) if (logCals[d] && logCals[d] > 400) days.push(logCals[d]);
  if (days.length < 5) return { ok: false, why: "Need at least 5 logged days in the window" };
  const avgIn = days.reduce((a, b) => a + b, 0) / days.length;
  const delta = last.t - first.t;
  const tdee = avgIn - (delta * 3500) / span;
  return { ok: true, tdee: Math.round(tdee), avgIn: Math.round(avgIn), rate: rnd((delta / span) * 7, 2), nDays: days.length, span, trendNow: last.t };
}

function stepsTdeeFit(logCals, weightsMap, stepsMap) {
  const today = todayStr();
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const end = addDays(today, -7 * k);
    const t = calcTDEE(logCals, weightsMap, 21, end);
    if (!t.ok) continue;
    const vals = [];
    for (let d = addDays(end, -20); d <= end; d = addDays(d, 1)) if (stepsMap[d] > 0) vals.push(stepsMap[d]);
    if (vals.length < 12) continue;
    pts.push({ x: vals.reduce((a, b) => a + b, 0) / vals.length, y: t.tdee });
  }
  if (pts.length < 4) return { ok: false, n: pts.length };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const spread = Math.max(...xs) - Math.min(...xs);
  if (spread < 1500) return { ok: false, n: pts.length, flat: true };
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  pts.forEach((p) => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  const slope = num / den;
  const per1k = slope * 1000;
  if (per1k < 5 || per1k > 150) return { ok: false, n: pts.length, weird: true };
  const base = my - slope * mx;
  return { ok: true, per1k: Math.round(per1k), base: Math.round(base), n: pts.length };
}

function Bar({ pct, color, bg, h = 6 }) {
  return (<div style={{ height: h, background: bg, borderRadius: h / 2, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: h, background: color, borderRadius: h / 2, transition: "width .3s" }} />
  </div>);
}

function WeightSVG({ T, data, goal }) {
  if (data.length < 2) return null;
  const W = 320, H = 130, P = 8;
  const vals = data.flatMap((x) => [x.w, x.t]);
  let lo = Math.min(...vals, goal || Infinity), hi = Math.max(...vals, goal || -Infinity);
  if (goal && (goal < lo - 8 || goal > hi + 8)) { lo = Math.min(...vals); hi = Math.max(...vals); }
  lo -= 0.6; hi += 0.6;
  const X = (i) => P + (i / (data.length - 1)) * (W - 2 * P);
  const Y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = data.map((x, i) => `${i ? "L" : "M"}${rnd(X(i), 1)},${rnd(Y(x.t), 1)}`).join(" ");
  const gY = goal && goal >= lo && goal <= hi ? Y(goal) : null;
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
    {gY != null && <line x1={P} x2={W - P} y1={gY} y2={gY} stroke={T.mut} strokeDasharray="4 4" strokeWidth="1" />}
    {data.map((x, i) => <circle key={i} cx={X(i)} cy={Y(x.w)} r="2.4" fill={T.mut} opacity="0.7" />)}
    <path d={path} fill="none" stroke={T.mint} strokeWidth="2.5" strokeLinecap="round" />
    <text x={P} y={12} fontSize="9" fill={T.mut}>{rnd(hi - 0.6, 1)}</text>
    <text x={P} y={H - 2} fontSize="9" fill={T.mut}>{rnd(lo + 0.6, 1)}</text>
  </svg>);
}

const btn = (T) => ({ minWidth: 30, height: 30, borderRadius: 15, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 15, cursor: "pointer", padding: "0 8px" });
const pill = (T) => ({ padding: "9px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.cardAlt, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const inp = (T) => ({ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardAlt, color: T.text, fontSize: 16, outline: "none", boxSizing: "border-box" });
function autoMeal() { const h = new Date().getHours(); return h < 10.5 ? "breakfast" : h < 15 ? "lunch" : h < 20.5 ? "dinner" : "snacks"; }

const DEFAULT_SETTINGS = { theme: "light", calTarget: 2650, macroMode: "pct", macroPct: { p: 30, c: 45, f: 25 }, macroG: { p: 199, c: 298, f: 74 }, waterGoal: 64, calView: "remaining", goalW: 140, rate: 1, nutrWeekStart: "sun", ramp: 1 };

export default function App() {
  const [user, setUser] = useState(undefined);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("today");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [foods, setFoods] = useState([]);
  const [weightsMap, setWeightsMap] = useState({});
  const [stepsMap, setStepsMap] = useState({});
  const [logCals, setLogCals] = useState({});
  const [dayTags, setDayTags] = useState({});
  const [fridge, setFridge] = useState({});
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState(emptyDay());
  const [sheet, setSheet] = useState(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [dpOpen, setDpOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [microsOpen, setMicrosOpen] = useState(false);
  const [aiTips, setAiTips] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [mealSum, setMealSum] = useState(null);
  const [tagFood, setTagFood] = useState(null);
  const [mealMenu, setMealMenu] = useState(null);

  const T = THEMES[settings.theme];
  const say = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const mainRef = () => doc(db, "fuel_users", user.uid);

  const [macroView, setMacroView] = useState(() => { try { return localStorage.getItem("fuel_macroview") || "goal"; } catch { return "goal"; } });
  const [collapsed, setCollapsed] = useState(() => { try { return JSON.parse(localStorage.getItem("fuel_collapsed") || "{}"); } catch { return {}; } });
  const toggleCollapse = (k) => setCollapsed((c) => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem("fuel_collapsed", JSON.stringify(n)); } catch {} return n; });

  const todayRef = useRef(todayStr());
  useEffect(() => {
    const check = () => {
      const t = todayStr();
      if (t !== todayRef.current) {
        const old = todayRef.current;
        todayRef.current = t;
        setDate((d) => (d === old ? t : d));
      }
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(check, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(iv); };
  }, []);

  // Health-sync intake: a Shortcut can open ?steps=N[&date=YYYY-MM-DD] and we log it
  const stepsParamDone = useRef(false);
  useEffect(() => {
    if (!user || stepsParamDone.current) return;
    stepsParamDone.current = true;
    try {
      const u = new URL(window.location.href);
      const n = Math.round(+u.searchParams.get("steps"));
      if (n > 0 && n < 200000) {
        const dp = u.searchParams.get("date") || "";
        const d = /^\d{4}-\d{2}-\d{2}$/.test(dp) ? dp : todayStr();
        setSteps(d, n);
        say(`👟 ${fmtN(n)} steps synced${d === todayStr() ? "" : " · " + shortDate(d)}`);
        u.searchParams.delete("steps"); u.searchParams.delete("date");
        window.history.replaceState({}, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""));
      }
    } catch {}
  }, [user]);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", T.bg);
    document.body.style.background = T.bg;
  }, [settings.theme]);

  useEffect(() => { if (!user) return; (async () => {
    const main = await getDoc(doc(db, "fuel_users", user.uid));
    if (!main.exists() || !main.data().seeded) {
      const batch = writeBatch(db);
      const seeded = SEED_FOODS.map((s) => mkFood(s, "seed"));
      seeded.forEach((f) => batch.set(doc(db, "fuel_users", user.uid, "foods", f.id), f));
      batch.set(doc(db, "fuel_users", user.uid), { seeded: true, tagsV: 3, settings: DEFAULT_SETTINGS, weights: {}, logcals: {}, daytags: {}, fridge: {}, steps: {} }, { merge: true });
      await batch.commit();
      setFoods(seeded); setSettings(DEFAULT_SETTINGS); setWeightsMap({}); setLogCals({}); setDayTags({}); setFridge({});
    } else {
      const d = main.data();
      setSettings({ ...DEFAULT_SETTINGS, ...(d.settings || {}) });
      setWeightsMap(d.weights || {}); setLogCals(d.logcals || {}); setStepsMap(d.steps || {}); setDayTags(d.daytags || {}); setFridge(d.fridge || {});
      let fs = (await getDocs(collection(db, "fuel_users", user.uid, "foods"))).docs.map((x) => x.data());
      if ((d.tagsV || 0) < 3) {
        const batch = writeBatch(db);
        const MLFIX = { "Milk, skim": "1 cup (240ml)", "Milk, 2%": "1 cup (240ml)", "Milk, whole": "1 cup (240ml)", "Orange juice": "1 cup (240ml)", "Apple juice": "1 cup (240ml)" };
        if ((d.tagsV || 0) < 2) {
          fs = fs.map((f) => {
            if (f.tags && f.tags.g) return f;
            const seedMatch = SEED_FOODS.find((s) => s.name === f.name);
            const tags = seedMatch ? ensureTags(seedMatch) : autoTag(f.name);
            batch.set(doc(db, "fuel_users", user.uid, "foods", f.id), { tags }, { merge: true });
            return { ...f, tags };
          });
          SEED_FOODS.forEach((s) => {
            if (!fs.find((f) => f.name === s.name)) {
              const nf = mkFood(s, "seed");
              batch.set(doc(db, "fuel_users", user.uid, "foods", nf.id), nf);
              fs.push(nf);
            }
          });
        }
        fs = fs.map((f) => {
          if (!MLFIX[f.name] || f.uServ === "ml") return f;
          batch.set(doc(db, "fuel_users", user.uid, "foods", f.id), { serving: MLFIX[f.name], uServ: "ml" }, { merge: true });
          return { ...f, serving: MLFIX[f.name], uServ: "ml" };
        });
        batch.update(doc(db, "fuel_users", user.uid), { tagsV: 3 });
        batch.commit().catch(console.error);
      }
      setFoods(fs);
    }
    const dd = await getDoc(doc(db, "fuel_users", user.uid, "days", todayStr()));
    setDay(dd.exists() ? dd.data() : emptyDay());
    setReady(true);
  })().catch((e) => { console.error(e); say("Couldn't load data — check your Firebase config"); }); }, [user]);

  useEffect(() => { if (!ready || !user) return; (async () => {
    const dd = await getDoc(doc(db, "fuel_users", user.uid, "days", date));
    setDay(dd.exists() ? dd.data() : emptyDay());
  })(); }, [date]);

  const persistSettings = (s) => { setSettings(s); if (user) updateDoc(mainRef(), { settings: s }).catch(console.error); };
  const saveDay = (nd) => {
    setDay(nd);
    const c = Math.round(dayTotals(nd).cal);
    const tags = dayTagTotals(nd, MEALS);
    setLogCals((p) => ({ ...p, [date]: c }));
    setDayTags((p) => ({ ...p, [date]: tags }));
    if (user) {
      setDoc(doc(db, "fuel_users", user.uid, "days", date), nd).catch(console.error);
      updateDoc(mainRef(), { [`logcals.${date}`]: c, [`daytags.${date}`]: tags }).catch(console.error);
    }
  };
  const addFoodToLib = (f) => { setFoods((fs) => (fs.find((x) => x.id === f.id) ? fs : [...fs, f])); if (user) setDoc(doc(db, "fuel_users", user.uid, "foods", f.id), f).catch(console.error); };
  const patchFood = (id, patch) => { setFoods((fs) => fs.map((x) => (x.id === id ? { ...x, ...patch } : x))); if (user) setDoc(doc(db, "fuel_users", user.uid, "foods", id), patch, { merge: true }).catch(console.error); };
  const setFoodTags = (id, tags) => patchFood(id, { tags });
  const deleteFood = (id) => { setFoods((fs) => fs.filter((x) => x.id !== id)); if (user) deleteDoc(doc(db, "fuel_users", user.uid, "foods", id)).catch(console.error); };
  const setWeight = (d, v) => { setWeightsMap((m) => ({ ...m, [d]: v })); if (user) updateDoc(mainRef(), { [`weights.${d}`]: v }).catch(console.error); };
  const delWeight = (d) => { setWeightsMap((m) => { const n = { ...m }; delete n[d]; return n; }); if (user) updateDoc(mainRef(), { [`weights.${d}`]: deleteField() }).catch(console.error); };
  const setSteps = (d, n) => {
    const v = Math.round(+n);
    if (!v || v <= 0) return;
    setStepsMap((m) => ({ ...m, [d]: v }));
    if (user) updateDoc(mainRef(), { [`steps.${d}`]: v }).catch(console.error);
  };
  const delSteps = (d) => {
    setStepsMap((m) => { const n = { ...m }; delete n[d]; return n; });
    if (user) updateDoc(mainRef(), { [`steps.${d}`]: deleteField() }).catch(console.error);
  };
  const addFridgeItem = (item) => { setFridge((f) => ({ ...f, [item.id]: item })); if (user) updateDoc(mainRef(), { [`fridge.${item.id}`]: item }).catch(console.error); };
  const delFridgeItem = (id) => { setFridge((f) => { const n = { ...f }; delete n[id]; return n; }); if (user) updateDoc(mainRef(), { [`fridge.${id}`]: deleteField() }).catch(console.error); };

  const totals = useMemo(() => dayTotals(day), [day]);
  const gramTargets = useMemo(() => {
    if (settings.macroMode === "g") return settings.macroG;
    const c = settings.calTarget, m = settings.macroPct;
    return { p: Math.round((c * m.p) / 100 / 4), c: Math.round((c * m.c) / 100 / 4), f: Math.round((c * m.f) / 100 / 9) };
  }, [settings]);

  const logFood = (food, qty, meal) => {
    saveDay({ ...day, meals: { ...day.meals, [meal]: [...day.meals[meal], entryFromFood(food, qty)] } });
    patchFood(food.id, { uses: (food.uses || 0) + 1, lastUsed: Date.now() });
    if (collapsed[meal]) toggleCollapse(meal);
    say(`Added to ${MEALS.find((m) => m.key === meal).label}`);
  };
  const removeEntry = (meal, id) => saveDay({ ...day, meals: { ...day.meals, [meal]: day.meals[meal].filter((e) => e.id !== id) } });
  const updateEntry = (fromMeal, toMeal, entry) => {
    const nd = { ...day, meals: { ...day.meals } };
    nd.meals[fromMeal] = nd.meals[fromMeal].filter((e) => e.id !== entry.id);
    nd.meals[toMeal] = [...(fromMeal === toMeal ? nd.meals[toMeal] : nd.meals[toMeal]), entry];
    saveDay(nd);
  };
  const setWater = (oz) => saveDay({ ...day, water: Math.max(0, oz) });
  const openDay = (d) => { setDate(d); setTab("today"); setDpOpen(false); };

  const openLog = (name) => {
    const n = (name || "").toLowerCase();
    const f = foods.find((x) => x.name.toLowerCase() === n) || foods.find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
    if (f) setSheet({ meal: autoMeal(), tab: "search", pre: f });
    else { setSheet({ meal: autoMeal(), tab: "search" }); say("Pick it from search"); }
  };
  const copyMealFromPrev = async (mealKey, label) => {
    const yd = await getDoc(doc(db, "fuel_users", user.uid, "days", addDays(date, -1)));
    const src = yd.exists() ? (yd.data().meals?.[mealKey] || []) : [];
    if (src.length === 0) return say(`Nothing in the previous day's ${label}`);
    const nd = { ...day, meals: { ...day.meals, [mealKey]: [...day.meals[mealKey], ...src.map((e) => ({ ...e, id: uid() }))] } };
    saveDay(nd); say(`Copied ${label} from the previous day`);
  };
  const clearMeal = (mealKey, label) => {
    saveDay({ ...day, meals: { ...day.meals, [mealKey]: [] } });
    say(`${label} cleared`);
  };
  const clearDay = () => {
    const m = {}; MEALS.forEach(({ key }) => (m[key] = []));
    saveDay({ ...day, meals: m });
    say("Day cleared");
  };
  const copyYesterday = async () => {
    const yd = await getDoc(doc(db, "fuel_users", user.uid, "days", addDays(date, -1)));
    if (!yd.exists()) return say("Nothing logged yesterday");
    const y = yd.data();
    const nd = { ...day, meals: { ...day.meals } };
    MEALS.forEach(({ key }) => { nd.meals[key] = [...nd.meals[key], ...(y.meals[key] || []).map((e) => ({ ...e, id: uid() }))]; });
    saveDay(nd); say("Copied yesterday's log");
  };

  const tdee = useMemo(() => calcTDEE(logCals, weightsMap), [logCals, weightsMap]);

  const askAI = async () => {
    setAiBusy(true); setAiTips(null);
    try {
      const remainCal = Math.max(0, settings.calTarget - totals.cal);
      const gaps = Object.keys(RDA).filter((k) => !RDA[k].limit).map((k) => { const v = k === "fiber" ? totals.fiber : totals.micros[k]; return { k, pct: (v / RDA[k].amt) * 100 }; }).sort((a, b) => a.pct - b.pct).slice(0, 3).map((g) => `${RDA[g.k].label} at ${Math.round(g.pct)}%`).join(", ");
      setAiTips(await suggestForGaps(`${Math.round(remainCal)} kcal, ${Math.max(0, gramTargets.p - Math.round(totals.p))}g protein remaining; lowest micros: ${gaps}`));
    } catch (e) { say(aiErrMsg(e, "AI suggestion failed — try again")); }
    setAiBusy(false);
  };

  if (user === undefined) return <Center T={THEMES.light} msg="Loading…" />;
  if (user === null) return <SignIn />;
  if (!ready) return <Center T={T} msg="Syncing your data…" />;

  const S = { card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 } };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "'DM Sans','Inter',system-ui,sans-serif", transition: "background .25s" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 14px) 16px 110px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setDate(addDays(date, -1))} style={btn(T)}>‹</button>
            <button onClick={() => setDpOpen(!dpOpen)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", color: T.text, padding: 0 }}>
              <div style={{ fontSize: 12, color: date > todayStr() ? T.amber : T.mut }}>{date === todayStr() ? "Today" : date > todayStr() ? "🗓 Planning ahead" : "Tap to jump ▾"}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtDate(date)} ▾</div>
            </button>
            <button onClick={() => setDate(addDays(date, 1))} style={btn(T)}>›</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tab === "today" && <button onClick={() => setMealMenu("day")} style={btn(T)}>⋯</button>}
            <button onClick={() => persistSettings({ ...settings, theme: settings.theme === "light" ? "dark" : "light" })} style={btn(T)}>{settings.theme === "light" ? "🌙" : "☀️"}</button>
          </div>
        </div>

        {dpOpen && <div style={{ ...S.card, marginBottom: 10 }}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={inp(T)} />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {[["« month", () => setDate(addMonths(date, -1))], ["‹ week", () => setDate(addDays(date, -7))], ["Today", () => setDate(todayStr())], ["week ›", () => setDate(addDays(date, 7))], ["month »", () => setDate(addMonths(date, 1))]].map(([l, fn]) => (
              <button key={l} onClick={fn} style={{ ...pill(T), flex: 1, padding: "7px 4px", fontSize: 12 }}>{l}</button>))}
          </div>
        </div>}

        {tab === "today" && <>
          <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setTab("trends")}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 700, color: T.sub }}>Calories</span><span style={{ fontSize: 11, color: T.mut }}>history ›</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
              <div><span style={{ fontSize: 30, fontWeight: 700 }}>{fmtN(totals.cal)} cal</span><span style={{ fontSize: 14, color: T.sub }}> / {fmtN(settings.calTarget)}</span></div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: totals.cal > settings.calTarget ? T.red : T.text }}>{fmtN(Math.abs(settings.calTarget - totals.cal))}</span>
                <span style={{ fontSize: 12, color: totals.cal > settings.calTarget ? T.red : T.mut }}> {totals.cal > settings.calTarget ? "over" : "left"}</span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 8, background: T.barBg, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${Math.min(100, (totals.cal / settings.calTarget) * 100)}%`, background: T.mint }} />
                {totals.cal > settings.calTarget && <div style={{ width: `${Math.min(30, ((totals.cal - settings.calTarget) / settings.calTarget) * 100)}%`, background: T.red }} />}
              </div>
            </div>
          </div>

          <div style={{ ...S.card, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.sub }}>Macros</span>
              <button onClick={() => setMacroView((v) => { const n = v === "goal" ? "left" : "goal"; try { localStorage.setItem("fuel_macroview", n); } catch {} return n; })} style={{ ...pill(T), padding: "4px 10px", fontSize: 12 }}>⇄ {macroView === "goal" ? "eaten / goal" : "remaining"}</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              {[["Protein", totals.p, gramTargets.p, MACRO_COLORS.p], ["Carbs", totals.c, gramTargets.c, MACRO_COLORS.c], ["Fat", totals.f, gramTargets.f, MACRO_COLORS.f]].map(([l, v, g, col]) => {
                const left = g - v, over = left < 0;
                return (<div key={l} style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, color: T.sub }}>
                    <span><span style={{ color: col }}>●</span> {l}</span>
                    <span style={{ color: macroView === "left" && over ? T.red : T.text, fontWeight: 600, fontSize: 11.5 }}>
                      {macroView === "goal" ? `${Math.round(v)} / ${g}g` : `${Math.round(Math.abs(left))}g ${over ? "over" : "left"}`}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}><Bar pct={(v / g) * 100} color={over ? T.red : col} bg={T.barBg} h={5} /></div>
                </div>);
              })}
            </div>
          </div>

          <div style={{ ...S.card, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setMicrosOpen(!microsOpen)}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Nutrient targets</span>
              <span style={{ fontSize: 12, color: T.mut }}>{microsOpen ? "hide" : "vs daily recommended ▾"}</span>
            </div>
            {microsOpen && <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginTop: 12 }}>
                {Object.keys(RDA).map((k) => {
                  const r = RDA[k]; const v = k === "fiber" ? totals.fiber : totals.micros[k]; const pct = (v / r.amt) * 100;
                  const col = r.limit ? (pct > 100 ? T.red : T.sub) : pct >= 100 ? T.green : T.mint;
                  return (<div key={k}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: T.sub }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: col }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ marginTop: 3 }}><Bar pct={pct} color={col} bg={T.barBg} h={4} /></div>
                    <div style={{ fontSize: 10, color: T.mut, marginTop: 2 }}>{rnd(v, 1)} / {r.amt} {r.unit}{r.limit ? " limit" : ""}</div>
                  </div>);
                })}
              </div>
              <button onClick={(e) => { e.stopPropagation(); askAI(); }} style={{ ...pill(T), marginTop: 12, width: "100%" }}>{aiBusy ? "Thinking…" : "✨ What should I eat to fill my gaps?"}</button>
              {aiTips && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {aiTips.map((t, i) => (<div key={i} style={{ background: T.cardAlt, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.food} <span style={{ color: T.mut, fontWeight: 400 }}>· {t.amount}</span></div>
                  <div style={{ fontSize: 11, color: T.sub }}>{t.why}</div>
                </div>))}
              </div>}
            </>}
          </div>

          <div style={{ ...S.card, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Water</span>
              <span style={{ fontSize: 12, color: T.sub }}>{day.water} / {settings.waterGoal} fl oz</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {Array.from({ length: Math.min(12, Math.ceil(settings.waterGoal / 8)) }).map((_, i) => {
                const filled = day.water >= (i + 1) * 8;
                return <button key={i} onClick={() => setWater(filled && day.water === (i + 1) * 8 ? i * 8 : (i + 1) * 8)}
                  style={{ width: 26, height: 34, borderRadius: "4px 4px 8px 8px", border: `1.5px solid ${filled ? T.mint : T.border}`, background: filled ? T.mintSoft : "transparent", color: T.mint, fontSize: 12, cursor: "pointer" }}>{filled ? "💧" : ""}</button>;
              })}
              <button onClick={() => setWater(day.water - 8)} style={btn(T)}>−</button>
              <button onClick={() => setWater(day.water + 8)} style={btn(T)}>+</button>
            </div>
            <div style={{ marginTop: 8 }}><Bar pct={(day.water / settings.waterGoal) * 100} color={T.mint} bg={T.barBg} /></div>
          </div>

          {totals.count === 0 && <button onClick={copyYesterday} style={{ ...pill(T), marginTop: 10, width: "100%" }}>⧉ Copy yesterday's log</button>}

          {MEALS.map(({ key, label, icon }) => {
            const items = day.meals[key] || []; const sub = items.reduce((a, e) => a + e.cal, 0);
            const closed = !!collapsed[key];
            return (<div key={key} style={{ ...S.card, marginTop: 10 }}>
              <div onClick={() => toggleCollapse(key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{closed ? "▸" : "▾"} {icon} {label}{closed && items.length > 0 ? <span style={{ fontSize: 11, color: T.mut, fontWeight: 400 }}> · {items.length}</span> : ""}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {sub > 0 && <span style={{ fontSize: 12, color: T.sub, fontWeight: closed ? 700 : 400 }}>{fmtN(sub)} kcal</span>}
                  <button onClick={(ev) => { ev.stopPropagation(); setSheet({ meal: key, tab: "search" }); }} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>+</button>
                  <button onClick={(ev) => { ev.stopPropagation(); setMealMenu(key); }} style={{ ...btn(T), color: T.mut }}>⋯</button>
                </div>
              </div>
              {!closed && items.map((e) => (<SwipeRow key={e.id} T={T} onDelete={() => removeEntry(key, e.id)} wrapStyle={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <div onClick={() => setEditEntry({ meal: key, entry: e })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: T.mut }}>{rnd(e.qty, 2)} × {e.serving} · P{Math.round(e.p)} C{Math.round(e.c)} F{Math.round(e.f)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.mint }}>{fmtN(e.cal)}</span>
                  {!HAS_TOUCH && <button onClick={() => removeEntry(key, e.id)} style={{ ...btn(T), color: T.mut }}>×</button>}
                </div>
              </div></SwipeRow>))}
              {!closed && items.length > 0 && (() => { const mt = sumEntries(items); return (
                <button onClick={() => setMealSum(key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 0 0", marginTop: 8, borderTop: `1px dashed ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.mut }}>P <b style={{ color: T.sub }}>{Math.round(mt.p)}</b> · C <b style={{ color: T.sub }}>{Math.round(mt.c)}</b> · F <b style={{ color: T.sub }}>{Math.round(mt.f)}</b> g</span>
                  <span style={{ fontSize: 11, color: T.mint }}>summary ›</span>
                </button>); })()}
            </div>);
          })}
        </>}

        {tab === "diet" && <DietTab T={T} S={S} settings={settings} persistSettings={persistSettings} dayTags={dayTags} fridge={fridge} addFridgeItem={addFridgeItem} delFridgeItem={delFridgeItem} viewDate={date} user={user} day={day} todayCals={Math.round(totals.cal)} todayP={rnd(totals.p, 1)} gramTargets={gramTargets} openLog={openLog} say={say} />}
        {tab === "trends" && <Trends T={T} S={S} logCals={logCals} settings={settings} weightsMap={weightsMap} setWeight={setWeight} delWeight={delWeight} stepsMap={stepsMap} setSteps={setSteps} delSteps={delSteps} tdee={tdee} openDay={openDay} say={say} />}
        {tab === "library" && <Library T={T} S={S} foods={foods} patchFood={patchFood} deleteFood={deleteFood} onLog={(f) => setSheet({ meal: autoMeal(), tab: "search", pre: f })} openEditor={(f) => setTagFood(f)} openRecipe={() => setRecipeOpen({})} openQuick={() => setQuickOpen(true)} say={say} />}
        {tab === "settings" && <Settings T={T} S={S} settings={settings} persistSettings={persistSettings} gramTargets={gramTargets} user={user} say={say} />}
      </div>

      <button onClick={() => setSheet({ meal: autoMeal(), tab: "search" })}
        style={{ position: "fixed", right: "max(16px, calc(50% - 224px))", bottom: "calc(env(safe-area-inset-bottom) + 84px)", width: 56, height: 56, borderRadius: 28, background: T.mint, color: settings.theme === "light" ? "#fff" : "#04342C", fontSize: 28, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(13,148,136,.35)" }}>+</button>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.navBg, backdropFilter: "blur(10px)", borderTop: `1px solid ${T.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {[["today", "Today", "🏠"], ["diet", "Diet", "🥦"], ["trends", "Trends", "📈"], ["library", "Library", "📚"], ["settings", "Settings", "⚙️"]].map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 0 12px", background: "none", border: "none", cursor: "pointer", color: tab === k ? T.mint : T.mut, fontWeight: tab === k ? 700 : 500, fontSize: 11 }}>
              <div style={{ fontSize: 18 }}>{ic}</div>{l}
            </button>))}
        </div>
      </div>

      {sheet && <AddSheet T={T} sheet={sheet} setSheet={setSheet} foods={foods} addFoodToLib={addFoodToLib} logFood={logFood} openQuick={() => { setSheet(null); setQuickOpen(true); }} say={say} />}
      {recipeOpen && <RecipeBuilder T={T} foods={foods} addFoodToLib={addFoodToLib} editing={recipeOpen.editing || null} copy={!!recipeOpen.copy} patchFood={patchFood} setFoodTags={setFoodTags} close={() => setRecipeOpen(false)} say={say} />}
      {quickOpen && <QuickFood T={T} addFoodToLib={addFoodToLib} close={() => setQuickOpen(false)} say={say} />}
      {tagFood && <TagEditor T={T} food={tagFood} foods={foods} setFoodTags={setFoodTags} patchFood={patchFood} openRecipeEdit={(f) => { setTagFood(null); setRecipeOpen({ editing: f }); }} openRecipeCopy={(f) => { setTagFood(null); setRecipeOpen({ editing: f, copy: true }); }} close={() => setTagFood(null)} say={say} />}
      {editEntry && <EntryEdit T={T} info={editEntry} foods={foods} updateEntry={updateEntry} removeEntry={removeEntry} close={() => setEditEntry(null)} say={say} />}
      {mealSum && <MealSummary T={T} meal={MEALS.find((m) => m.key === mealSum)} items={day.meals[mealSum] || []} dayCal={totals.cal} settings={settings} gramTargets={gramTargets} date={date} close={() => setMealSum(null)} />}
      {mealMenu && (() => {
        const isDay = mealMenu === "day";
        const m = isDay ? null : MEALS.find((x) => x.key === mealMenu);
        const rel = date === todayStr() ? "yesterday" : "previous day";
        const actions = isDay
          ? [
              { label: `⧉ Copy entire ${rel}`, onTap: () => { copyYesterday(); setMealMenu(null); } },
              { label: "🗑 Clear entire day", danger: true, onTap: () => { clearDay(); setMealMenu(null); } },
            ]
          : [
              { label: `⧉ Copy ${m.label} from ${rel}`, onTap: () => { copyMealFromPrev(m.key, m.label); setMealMenu(null); } },
              { label: `🗑 Clear ${m.label}`, danger: true, onTap: () => { clearMeal(m.key, m.label); setMealMenu(null); } },
            ];
        return <ActionMenu T={T} title={isDay ? fmtDate(date) : `${m.icon} ${m.label}`} actions={actions} close={() => setMealMenu(null)} />;
      })()}
      {toast && <div style={{ position: "fixed", bottom: 150, left: "50%", transform: "translateX(-50%)", background: T.text, color: T.bg, fontSize: 13, padding: "8px 16px", borderRadius: 20, zIndex: 80, whiteSpace: "nowrap" }}>{toast}</div>}
    </div>
  );
}

function Center({ T, msg }) {
  return <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui", color: T.sub }}>{msg}</div>;
}

function SignIn() {
  const T = THEMES.light;
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const pasteInto = async (setter) => {
    try { const t = await navigator.clipboard.readText(); if (t) setter(t.trim()); }
    catch { setErr("Clipboard blocked — or long-press the field and choose Paste"); }
  };
  const goEmail = async () => {
    if (!em.trim() || !pw) return setErr("Enter email and password");
    setErr(null); setBusy(true);
    try { await signInWithEmailAndPassword(auth, em.trim(), pw); }
    catch (e) {
      const c = e?.code || "";
      setErr(c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")
        ? "Wrong email or password — set/reset it from Settings → App password while signed in on Safari."
        : c.includes("operation-not-allowed")
        ? "Email sign-in isn't enabled yet — Firebase console → Authentication → Sign-in method → enable Email/Password."
        : e.message);
      setBusy(false);
    }
  };
  const goGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setErr(null); setBusy(true);
    if (IS_STANDALONE) {
      try { await signInWithRedirect(auth, provider); } catch (e) { setErr(e.message); setBusy(false); }
      return;
    }
    try { await signInWithPopup(auth, provider); }
    catch { try { await signInWithRedirect(auth, provider); } catch (e2) { setErr(e2.message); setBusy(false); } }
  };
  return (<div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui", padding: 24, textAlign: "center" }}>
    <div style={{ width: 72, height: 72, borderRadius: 20, background: T.mint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>F</div>
    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 16, color: T.text }}>Fuel</div>
    <div style={{ fontSize: 12, color: T.mut, marginTop: 4 }}>Fuel v4.1</div>
    <div style={{ fontSize: 14, color: T.sub, marginTop: 6, maxWidth: 280 }}>Photo-powered food logging, micros, and your real TDEE — synced to your account.</div>
    <button onClick={goGoogle} disabled={busy} style={{ marginTop: 24, padding: "13px 22px", borderRadius: 14, border: "none", background: T.mint, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>Continue with Google</button>
    <button onClick={() => setShowEmail(!showEmail)} style={{ marginTop: 12, background: "none", border: "none", color: T.sub, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Sign in with app password</button>
    {showEmail && <div style={{ marginTop: 12, width: "100%", maxWidth: 300 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input placeholder="Email" autoCapitalize="none" value={em} onChange={(e) => setEm(e.target.value)} style={inp(T)} />
        <button onClick={() => pasteInto(setEm)} style={{ ...pill(T), padding: "8px 10px", flexShrink: 0 }}>📋</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inp(T)} />
        <button onClick={() => pasteInto(setPw)} style={{ ...pill(T), padding: "8px 10px", flexShrink: 0 }}>📋</button>
      </div>
      <button onClick={goEmail} disabled={busy} style={{ ...pill(T), width: "100%", marginTop: 10, background: T.mint, color: "#fff", borderColor: T.mint }}>{busy ? "Signing in…" : "Sign in"}</button>
      <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>Set the password once from Settings → App password while signed in with Google in Safari.</div>
    </div>}
    {err && <div style={{ marginTop: 14, fontSize: 12, color: T.red, maxWidth: 300 }}>{err}</div>}
  </div>);
}

function SwipeRow({ T, onDelete, wrapStyle, children }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef(null);
  const onTouchStart = (e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; setDrag(false); };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x;
    const ddy = e.touches[0].clientY - start.current.y;
    if (!drag && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) setDrag(true);
    if (drag || (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy))) setDx(Math.min(0, ddx));
  };
  const onTouchEnd = () => {
    if (dx < -70) { setDx(-500); setTimeout(onDelete, 150); }
    else setDx(0);
    start.current = null; setDrag(false);
  };
  return (<div style={{ position: "relative", overflow: "hidden", ...wrapStyle }}>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, background: T.red, borderRadius: 8, opacity: dx < -8 ? 1 : 0 }}>
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Delete</span>
    </div>
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ transform: `translateX(${dx}px)`, transition: drag ? "none" : "transform .18s ease", background: T.card, position: "relative" }}>
      {children}
    </div>
  </div>);
}

function FoodPick({ T, f, onPick }) {
  return (<button onClick={onPick} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", color: T.text, textAlign: "left" }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{f.fav ? "★ " : ""}{f.name}{f.kind === "recipe" ? " 🧾" : ""}</div>
      <div style={{ fontSize: 11, color: T.mut }}>{f.serving} · P{Math.round(f.p)} C{Math.round(f.c)} F{Math.round(f.f)}</div>
    </div>
    <span style={{ fontSize: 13, fontWeight: 600, color: T.mint, flexShrink: 0 }}>{fmtN(f.cal)}</span>
  </button>);
}

const MACRO_COLORS = { c: "#2DD4BF", f: "#A78BFA", p: "#FBBF24" };
function MacroRing({ T, cal, p, c, f, size = 66 }) {
  const calC = (+c || 0) * 4, calF = (+f || 0) * 9, calP = (+p || 0) * 4;
  const tot = Math.max(1, calC + calF + calP);
  const R = (size - 10) / 2, CIRC = 2 * Math.PI * R;
  const segs = [[calC / tot, MACRO_COLORS.c], [calF / tot, MACRO_COLORS.f], [calP / tot, MACRO_COLORS.p]];
  let off = 0;
  return (<svg width={size} height={size} style={{ flexShrink: 0 }}>
    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={T.barBg} strokeWidth="7" />
      {segs.map(([fr, col], i) => { const el = <circle key={i} cx={size / 2} cy={size / 2} r={R} fill="none" stroke={col} strokeWidth="7" strokeDasharray={`${Math.max(0, fr * CIRC - 1)} ${CIRC}`} strokeDashoffset={-off * CIRC} />; off += fr; return el; })}
    </g>
    <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill={T.text}>{fmtN(cal)}</text>
    <text x="50%" y="68%" textAnchor="middle" fontSize={size * 0.15} fill={T.mut}>cal</text>
  </svg>);
}
function MacroPct({ T, p, c, f }) {
  const tot = Math.max(1, (+c || 0) * 4 + (+f || 0) * 9 + (+p || 0) * 4);
  return (<div style={{ display: "flex", flex: 1, justifyContent: "space-around" }}>
    {[["Carbs", c, (+c || 0) * 4, MACRO_COLORS.c], ["Fat", f, (+f || 0) * 9, MACRO_COLORS.f], ["Protein", p, (+p || 0) * 4, MACRO_COLORS.p]].map(([l, g, cc, col]) => (
      <div key={l} style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{Math.round((cc / tot) * 100)}%</div>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{rnd(+g || 0, 1)} g</div>
        <div style={{ fontSize: 11, color: T.mut }}>{l}</div>
      </div>))}
  </div>);
}
function NutritionList({ T, it }) {
  const row = (label, val, unit, sub) => (val == null ? null :
    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", paddingLeft: sub ? 16 : 0, borderBottom: `1px solid ${T.border}`, fontSize: sub ? 12.5 : 13.5, color: sub ? T.sub : T.text }}>
      <span>{label}</span><span style={{ fontWeight: sub ? 400 : 600 }}>{val === "-" ? "–" : `${fmtN(rnd(val, 1))} ${unit}`}</span>
    </div>);
  const m = it.micros || {};
  const vit = [["Vitamin A", m.vitA, "µg"], ["Vitamin C", m.vitC, "mg"], ["Vitamin D", m.vitD, "µg"], ["Vitamin E", m.vitE, "mg"], ["Vitamin K", m.vitK, "µg"], ["Vitamin B6", m.b6, "mg"], ["Vitamin B12", m.b12, "µg"], ["Folate", m.folate, "µg"], ["Magnesium", m.magnesium, "mg"], ["Zinc", m.zinc, "mg"]];
  return (<div style={{ marginTop: 4 }}>
    {row("Calories", it.cal, "kcal")}
    {row("Total fat", it.f, "g")}
    {row("Saturated", it.satfat == null ? "-" : it.satfat, "g", true)}
    {row("Total carbohydrates", it.c, "g")}
    {row("Dietary fiber", it.fiber || 0, "g", true)}
    {row("Sugar", it.sugar == null ? "-" : it.sugar, "g", true)}
    {row("Protein", it.p, "g")}
    {row("Sodium", m.sodium || 0, "mg")}
    {row("Potassium", m.potassium || 0, "mg")}
    {row("Calcium", m.calcium || 0, "mg")}
    {row("Iron", m.iron || 0, "mg")}
    {vit.map(([l, v, u]) => (v > 0 ? row(l, v, u) : null))}
  </div>);
}

function MealSummary({ T, meal, items, dayCal, settings, gramTargets, date, close }) {
  const mt = sumEntries(items);
  const [nutsOpen, setNutsOpen] = useState(false);
  const pctDay = dayCal > 0 ? Math.round((mt.cal / dayCal) * 100) : 0;
  const pctTarget = Math.round((mt.cal / settings.calTarget) * 100);
  const tp = (v, g) => (g > 0 ? Math.round((v / g) * 100) : 0);
  const ov = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" };
  const sh = { background: T.bg, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" };
  return (<div style={ov} onClick={close}><div style={sh} onClick={(e) => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontWeight: 700, fontSize: 15 }}>{meal.icon} {meal.label}</div><div style={{ fontSize: 11, color: T.mut }}>{fmtDate(date)} · {items.length} item{items.length === 1 ? "" : "s"}</div></div>
      <button onClick={close} style={{ ...pill(T), padding: "6px 10px" }}>✕</button>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, background: T.bg2, borderRadius: 12, padding: "10px 12px" }}>
      <MacroRing T={T} cal={mt.cal} p={mt.p} c={mt.c} f={mt.f} />
      <MacroPct T={T} p={mt.p} c={mt.c} f={mt.f} />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub, marginTop: 10 }}>
      <span><b style={{ color: T.text }}>{pctDay}%</b> of today's intake</span>
      <span><b style={{ color: T.text }}>{pctTarget}%</b> of your {fmtN(settings.calTarget)} goal</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.mut, marginTop: 6 }}>
      <span>of daily macro targets:</span>
      <span>P <b style={{ color: T.sub }}>{tp(mt.p, gramTargets.p)}%</b> · C <b style={{ color: T.sub }}>{tp(mt.c, gramTargets.c)}%</b> · F <b style={{ color: T.sub }}>{tp(mt.f, gramTargets.f)}%</b></span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.mut, marginTop: 6 }}>
      <span>Fiber <b style={{ color: T.sub }}>{mt.fiber}g</b> · Sodium <b style={{ color: T.sub }}>{fmtN(mt.micros.sodium)}mg</b></span>
      {mt.pg > 0 && <span><b style={{ color: T.sub }}>{mt.pg}g</b> produce</span>}
    </div>
    {Object.keys(mt.tg).length > 0 && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8, background: T.bg2, borderRadius: 10, padding: "7px 10px" }}>
      Counts toward: {Object.keys(mt.tg).map((k) => `${GROUPS[k]?.emoji || ""} ${GROUPS[k]?.label || k} ×${rnd(mt.tg[k], 1)}`).join(" · ")}
    </div>}
    <div style={{ marginTop: 10 }}>
      {items.map((e) => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.sub }}>{e.name}{e.qty !== 1 ? ` ×${rnd(e.qty, 2)}` : ""}</span>
        <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{fmtN(e.cal)}</span>
      </div>))}
    </div>
    <button onClick={() => setNutsOpen(!nutsOpen)} style={{ ...pill(T), width: "100%", marginTop: 10, padding: "9px", fontSize: 12.5 }}>{nutsOpen ? "Hide nutrition facts ▴" : "Nutrition facts ▾"}</button>
    {nutsOpen && <NutritionList T={T} it={{ cal: mt.cal, p: mt.p, c: mt.c, f: mt.f, fiber: mt.fiber, sugar: null, satfat: null, micros: mt.micros }} />}
  </div></div>);
}

function ActionMenu({ T, title, actions, close }) {
  const [confirmIdx, setConfirmIdx] = useState(null);
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, background: T.bg, borderRadius: 16, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{title}</div>
      {actions.map((a, i) => (
        <button key={i}
          onClick={() => { if (a.danger && confirmIdx !== i) return setConfirmIdx(i); a.onTap(); }}
          style={{ ...pill(T), display: "block", width: "100%", textAlign: "left", padding: "12px 12px", marginTop: 6,
            color: a.danger ? (confirmIdx === i ? "#fff" : T.red) : T.text,
            background: a.danger && confirmIdx === i ? T.red : T.cardAlt,
            borderColor: a.danger ? T.red : T.border, fontSize: 13.5, fontWeight: 600 }}>
          {a.danger && confirmIdx === i ? "Tap again to confirm" : a.label}
        </button>))}
      <button onClick={close} style={{ ...pill(T), display: "block", width: "100%", padding: "11px", marginTop: 10, fontSize: 13 }}>Cancel</button>
    </div>
  </div>);
}

function EntryEdit({ T, info, foods, updateEntry, removeEntry, close, say }) {
  const { meal, entry } = info;
  const food = foods.find((f) => f.id === entry.foodId) || null;
  const unit = servUnit({ serving: entry.serving, gServ: food?.gServ, uServ: food?.uServ });
  const perAmt = unit && unit.amt;
  const [qty, setQty] = useState(entry.qty || 1);
  const [gIn, setGIn] = useState(null);
  const [qIn, setQIn] = useState(null);
  const [toMeal, setToMeal] = useState(meal);
  const q0 = entry.qty || 1;
  const per = food
    ? { cal: food.cal, p: food.p, c: food.c, f: food.f, fiber: food.fiber || 0, sugar: food.sugar, satfat: food.satfat, micros: food.micros || {} }
    : { cal: entry.cal / q0, p: entry.p / q0, c: entry.c / q0, f: entry.f / q0, fiber: (entry.fiber || 0) / q0, sugar: null, satfat: null, micros: Object.fromEntries(Object.keys(entry.micros || {}).map((k) => [k, (entry.micros[k] || 0) / q0])) };
  const perCal = per.cal;
  const [nutsOpen, setNutsOpen] = useState(false);
  const save = () => { updateEntry(meal, toMeal, rescaleEntry(entry, food, qty)); say(toMeal !== meal ? "Updated & moved" : "Updated"); close(); };
  const del = () => { removeEntry(meal, entry.id); say("Removed"); close(); };
  const ov = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" };
  const sh = { background: T.bg, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" };
  return (<div style={ov} onClick={close}><div style={sh} onClick={(e) => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</div>
        <div style={{ fontSize: 11, color: T.mut }}>1 serving = {entry.serving}</div>
      </div>
      <button onClick={close} style={{ ...pill(T), padding: "6px 10px", flexShrink: 0 }}>✕</button>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
      <span style={{ fontSize: 13, color: T.sub }}>Servings</span>
      <button onClick={() => { setQty(Math.max(0.05, rnd(qty - 0.25, 2))); setGIn(null); setQIn(null); }} style={btn(T)}>−</button>
      <input type="number" inputMode="decimal" step="any" min="0" value={qIn !== null ? qIn : String(rnd(qty, 2))}
        onFocus={(e) => { setQIn(String(rnd(qty, 2))); e.target.select(); }}
        onChange={(e) => { setQIn(e.target.value); const v = +e.target.value; if (v > 0) setQty(v); }}
        onBlur={() => setQIn(null)}
        style={{ ...inp(T), width: 64, textAlign: "center", fontWeight: 700, padding: "8px 4px" }} />
      <button onClick={() => { setQty(rnd(qty + 0.25, 2)); setGIn(null); setQIn(null); }} style={btn(T)}>+</button>
      <span style={{ marginLeft: "auto", fontWeight: 700, color: T.mint }}>{fmtN(perCal * qty)} kcal</span>
    </div>
    {perAmt > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
      <span style={{ fontSize: 13, color: T.sub }}>{unit.unit === "ml" ? "Milliliters" : "Grams"}</span>
      <input type="number" inputMode="decimal" step="any" min="0" value={gIn !== null ? gIn : String(rnd(perAmt * qty))}
        onFocus={(e) => { setGIn(String(rnd(perAmt * qty))); e.target.select(); }}
        onChange={(e) => { setGIn(e.target.value); const g = +e.target.value; if (g > 0) setQty(g / perAmt); }}
        onBlur={() => setGIn(null)}
        style={{ ...inp(T), width: 90, textAlign: "center", fontWeight: 700, padding: "8px 6px" }} />
      <span style={{ fontSize: 11, color: T.mut }}>{unit.unit} total · {perAmt}{unit.unit}/serving</span>
    </div>}
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
      <span style={{ fontSize: 13, color: T.sub }}>Meal</span>
      <select value={toMeal} onChange={(e) => setToMeal(e.target.value)} style={{ ...inp(T), width: "auto", padding: "7px 10px" }}>
        {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, background: T.bg2, borderRadius: 12, padding: "10px 12px" }}>
      <MacroRing T={T} cal={per.cal * qty} p={per.p * qty} c={per.c * qty} f={per.f * qty} />
      <MacroPct T={T} p={per.p * qty} c={per.c * qty} f={per.f * qty} />
    </div>
    <button onClick={() => setNutsOpen(!nutsOpen)} style={{ ...pill(T), width: "100%", marginTop: 8, padding: "9px", fontSize: 12.5 }}>{nutsOpen ? "Hide nutrition facts ▴" : "Nutrition facts ▾"}</button>
    {nutsOpen && <div style={{ maxHeight: 220, overflowY: "auto" }}><NutritionList T={T} it={{ cal: per.cal * qty, p: per.p * qty, c: per.c * qty, f: per.f * qty, fiber: per.fiber * qty, sugar: per.sugar == null ? null : per.sugar * qty, satfat: per.satfat == null ? null : per.satfat * qty, micros: Object.fromEntries(Object.keys(per.micros).map((k) => [k, (per.micros[k] || 0) * qty])) }} /></div>}
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <button onClick={del} style={{ ...pill(T), flex: 1, color: T.red, borderColor: T.red, background: "transparent" }}>Delete</button>
      <button onClick={save} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Save</button>
    </div>
  </div></div>);
}

function AddSheet({ T, sheet, setSheet, foods, addFoodToLib, logFood, openQuick, say }) {
  const [q, setQ] = useState("");
  const [oq, setOq] = useState("");
  const [oResults, setOResults] = useState(null);
  const [oBusy, setOBusy] = useState(false);
  const [qty, setQty] = useState(1);
  const [gIn, setGIn] = useState(null);
  const [sIn, setSIn] = useState(null);
  const [meal, setMeal] = useState(sheet.meal);
  const [mode, setMode] = useState(sheet.tab);
  const [photoKind, setPhotoKind] = useState("label");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(sheet.pre || null);
  const [nutsOpen, setNutsOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [queue, setQueue] = useState(null);
  const [qIdx, setQIdx] = useState(0);
  const savedRef = useRef(0);
  const camRef = useRef();
  const upRef = useRef();

  useEffect(() => { setQty(1); setGIn(null); setSIn(null); setNutsOpen(false); }, [preview && preview.id]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return foods.filter((f) => !s || f.name.toLowerCase().includes(s) || (f.brand || "").toLowerCase().includes(s))
      .sort((a, b) => (b.fav - a.fav) || (b.lastUsed || 0) - (a.lastUsed || 0) || (b.uses || 0) - (a.uses || 0)).slice(0, 40);
  }, [q, foods]);
  const recent = useMemo(() => foods.filter((f) => f.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 12), [foods]);

  const searchOnline = async () => {
    if (!oq.trim()) return;
    setOBusy(true); setOResults(null);
    const [u, o] = await Promise.all([usdaSearch(oq.trim()), offSearch(oq.trim())]);
    setOResults([...u, ...o].slice(0, 12));
    setOBusy(false);
  };

  const advance = () => {
    if (!queue) return;
    if (qIdx + 1 >= queue.length) {
      say(`Imported ${savedRef.current} food${savedRef.current === 1 ? "" : "s"} to your library`);
      setQueue(null); setPreview(null); setMode("search"); setQ("");
    } else setQIdx(qIdx + 1);
  };

  useEffect(() => {
    if (!queue || qIdx >= queue.length) return;
    (async () => {
      setBusy(true); setPreview(null);
      try {
        const b64 = await downscale(queue[qIdx]);
        const p = await parseLabelImage(b64, "image/jpeg");
        if (p.error) { say("One skipped — no nutrition info found"); setBusy(false); advance(); return; }
        setPreview(mkFood(p, "photo"));
      } catch (e) { say(aiErrMsg(e, "One photo failed — skipped")); setBusy(false); advance(); return; }
      setBusy(false);
    })();
  }, [queue, qIdx]);

  const handleFiles = async (list) => {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    if (arr.length > 1 && photoKind === "label") { savedRef.current = 0; setQueue(arr); setQIdx(0); return; }
    setBusy(true);
    try {
      const b64 = await downscale(arr[0]);
      const parsed = photoKind === "label" ? await parseLabelImage(b64, "image/jpeg") : await parseMealImage(b64, "image/jpeg");
      if (parsed.error) say(photoKind === "label" ? "No nutrition info found in that image" : "No food detected");
      else setPreview(mkFood(parsed, photoKind === "label" ? "photo" : "meal-photo"));
    } catch (e) { say(aiErrMsg(e, "Couldn't read that photo — try again")); }
    setBusy(false);
  };
  const handleText = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try { setPreview(mkFood(await parseTextFood(desc.trim()), "text")); }
    catch (e) { say(aiErrMsg(e, "Couldn't parse that — try rephrasing")); }
    setBusy(false);
  };

  const atwater = preview ? Math.round(preview.p * 4 + preview.c * 4 + preview.f * 9) : 0;
  const atwaterOff = preview && preview.cal > 60 && Math.abs(atwater - preview.cal) / preview.cal > 0.15;
  const inLib = preview && foods.find((x) => x.id === preview.id);
  const previewTags = preview ? (preview.tags && preview.tags.g ? preview.tags : autoTag(preview.name)) : null;
  const tagLine = previewTags ? Object.keys(previewTags.g).map((k) => `${GROUPS[k]?.emoji || ""}${previewTags.g[k] !== 1 ? " ×" + previewTags.g[k] : ""}`).join(" ") : "";
  const unit = preview ? servUnit(preview) : null;
  const perAmt = unit && unit.amt;
  const confirmSingle = () => { addFoodToLib(preview); logFood(inLib ? inLib : preview, qty, meal); setSheet(null); };

  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setSheet(null)}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "92dvh", maxHeight: "92dvh", background: T.card, borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={() => setSheet(null)} style={{ ...pill(T), padding: "6px 12px", flexShrink: 0 }}>✕</button>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{queue ? `Import labels · ${qIdx + 1} of ${queue.length}` : "Add food"}</span>
        {!queue && <select value={meal} onChange={(e) => setMeal(e.target.value)} style={{ ...inp(T), width: "auto", padding: "6px 10px", flexShrink: 0 }}>
          {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px", overflow: "hidden" }}>
        {queue && busy && <div style={{ padding: 32, textAlign: "center", color: T.sub, fontSize: 14 }}>Reading label {qIdx + 1}…</div>}

        {!preview && !queue && <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
            {[["search", "My foods"], ["online", "🌐 Online"], ["photo", "📷 Photo"], ["describe", "Describe"], ["recent", "Recent"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} style={{ ...pill(T), flex: "1 1 30%", padding: "8px 2px", fontSize: 12, background: mode === k ? T.mintSoft : T.cardAlt, color: mode === k ? T.mint : T.sub, borderColor: mode === k ? T.mint : T.border }}>{l}</button>))}
          </div>

          {mode === "search" && <>
            <input placeholder="Search your food library…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp(T), marginTop: 12 }} />
            <div style={{ marginTop: 8 }}>
              {filtered.map((f) => <FoodPick key={f.id} T={T} f={f} onPick={() => setPreview(f)} />)}
              {filtered.length === 0 && <div style={{ fontSize: 13, color: T.mut, padding: 16, textAlign: "center" }}>
                Nothing found — try Online search, snap a photo, or
                <button onClick={openQuick} style={{ background: "none", border: "none", color: T.mint, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>enter it manually</button>
              </div>}
            </div>
          </>}

          {mode === "online" && <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="Search USDA + Open Food Facts…" value={oq} onChange={(e) => setOq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchOnline()} style={inp(T)} />
              <button onClick={searchOnline} style={{ ...pill(T), background: T.mint, color: "#fff", borderColor: T.mint }}>{oBusy ? "…" : "Go"}</button>
            </div>
            <div style={{ fontSize: 11, color: T.mut, marginTop: 6 }}>Verified data, listed per 100 g — adjust servings after picking. Saved to your library automatically.{!CFG.usdaKey ? " (Add a free USDA key in index.html for the full government database.)" : ""}</div>
            <div style={{ marginTop: 6 }}>
              {oResults && oResults.map((r, i) => (<button key={i} onClick={() => setPreview(mkFood(r, r.src))} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", color: T.text, textAlign: "left" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}{r.brand ? ` · ${r.brand}` : ""}</div>
                  <div style={{ fontSize: 11, color: T.mut }}>per 100 g · P{Math.round(r.p)} C{Math.round(r.c)} F{Math.round(r.f)} · {r.src === "usda" ? "USDA" : "OFF"}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.mint, flexShrink: 0 }}>{fmtN(r.cal)}</span>
              </button>))}
              {oResults && oResults.length === 0 && !oBusy && <div style={{ fontSize: 13, color: T.mut, padding: 16, textAlign: "center" }}>No matches — try fewer words.</div>}
            </div>
          </div>}

          {mode === "photo" && <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[["label", "Nutrition label"], ["meal", "Plate of food"]].map(([k, l]) => (
                <button key={k} onClick={() => setPhotoKind(k)} style={{ ...pill(T), flex: 1, background: photoKind === k ? T.mintSoft : T.cardAlt, color: photoKind === k ? T.mint : T.sub, borderColor: photoKind === k ? T.mint : T.border }}>{l}</button>))}
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <input ref={upRef} type="file" accept="image/*" multiple={photoKind === "label"} style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => camRef.current.click()} disabled={busy} style={{ ...pill(T), flex: 1, padding: 20, borderStyle: "dashed", background: "transparent" }}>{busy ? "Reading…" : "📷 Camera"}</button>
              <button onClick={() => upRef.current.click()} disabled={busy} style={{ ...pill(T), flex: 1, padding: 20, borderStyle: "dashed", background: "transparent" }}>{busy ? "Reading…" : "🖼 Upload"}</button>
            </div>
            <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>{photoKind === "label" ? "Works on printed labels and app screenshots. Upload several to batch-import — everything lands in your library so you never scan it twice." : "AI portion estimate — good, not gospel. You can edit before saving."}</div>
          </div>}

          {mode === "describe" && <div style={{ marginTop: 14 }}>
            <textarea rows={3} placeholder={'e.g. "200g grilled chicken breast and 1 cup white rice"'} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inp(T), resize: "none" }} />
            <button onClick={handleText} disabled={busy} style={{ ...pill(T), width: "100%", marginTop: 8, background: T.mint, color: "#fff", borderColor: T.mint }}>{busy ? "Estimating…" : "Estimate nutrition"}</button>
          </div>}

          {mode === "recent" && <div style={{ marginTop: 8 }}>
            {recent.map((f) => <FoodPick key={f.id} T={T} f={f} onPick={() => setPreview(f)} />)}
            {recent.length === 0 && <div style={{ fontSize: 13, color: T.mut, padding: 16, textAlign: "center" }}>Foods you log will show up here.</div>}
          </div>}
        </div>}

        {preview && <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 14, paddingBottom: 16 }}>
          <input value={preview.name} onChange={(e) => setPreview({ ...preview, name: e.target.value })} style={{ ...inp(T), fontWeight: 700 }} />
          <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>Per serving: {preview.serving}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>
            {[["cal", "kcal"], ["p", "P g"], ["c", "C g"], ["f", "F g"]].map(([k, l]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: T.mut }}>{l}</div>
                <input type="number" value={preview[k]} onChange={(e) => setPreview({ ...preview, [k]: +e.target.value })} style={{ ...inp(T), padding: "8px 8px" }} />
              </div>))}
          </div>
          {atwaterOff && <div style={{ fontSize: 11, color: T.amber, marginTop: 8 }}>⚠ Macros imply ~{atwater} kcal but this says {Math.round(preview.cal)} — double-check.</div>}
          {tagLine && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8 }}>Counts as: {tagLine}{previewTags.pg > 0 ? ` · ${previewTags.pg}g produce` : ""}</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, background: T.bg2, borderRadius: 12, padding: "10px 12px" }}>
            <MacroRing T={T} cal={preview.cal * qty} p={preview.p * qty} c={preview.c * qty} f={preview.f * qty} />
            <MacroPct T={T} p={preview.p * qty} c={preview.c * qty} f={preview.f * qty} />
          </div>
          <button onClick={() => setNutsOpen(!nutsOpen)} style={{ ...pill(T), width: "100%", marginTop: 8, padding: "9px", fontSize: 12.5 }}>{nutsOpen ? "Hide nutrition facts ▴" : "Nutrition facts ▾"}</button>
          {nutsOpen && <div style={{ maxHeight: 200, overflowY: "auto" }}><NutritionList T={T} it={{ cal: preview.cal * qty, p: preview.p * qty, c: preview.c * qty, f: preview.f * qty, fiber: (preview.fiber || 0) * qty, sugar: preview.sugar == null ? null : preview.sugar * qty, satfat: preview.satfat == null ? null : preview.satfat * qty, micros: Object.fromEntries(Object.keys(preview.micros || {}).map((k) => [k, (preview.micros[k] || 0) * qty])) }} /></div>}

          {queue ? <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => advance()} style={{ ...pill(T), flex: 1 }}>Skip</button>
            <button onClick={() => { addFoodToLib(preview); savedRef.current++; advance(); }} style={{ ...pill(T), flex: 1, color: T.mint, borderColor: T.mint, background: "transparent" }}>Save</button>
            <button onClick={() => { addFoodToLib(preview); logFood(preview, 1, meal); savedRef.current++; advance(); }} style={{ ...pill(T), flex: 1, background: T.mint, color: "#fff", borderColor: T.mint }}>Save + log</button>
          </div> : <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <span style={{ fontSize: 13, color: T.sub }}>Servings</span>
              <button onClick={() => { setQty(Math.max(0.05, rnd(qty - 0.25, 2))); setGIn(null); setSIn(null); }} style={btn(T)}>−</button>
              <input type="number" inputMode="decimal" step="any" min="0" value={sIn !== null ? sIn : String(rnd(qty, 2))}
                onFocus={(e) => { setSIn(String(rnd(qty, 2))); e.target.select(); }}
                onChange={(e) => { setSIn(e.target.value); const v = +e.target.value; if (v > 0) setQty(v); }}
                onBlur={() => setSIn(null)}
                style={{ ...inp(T), width: 64, textAlign: "center", fontWeight: 700, padding: "8px 4px" }} />
              <button onClick={() => { setQty(rnd(qty + 0.25, 2)); setGIn(null); setSIn(null); }} style={btn(T)}>+</button>
              <span style={{ marginLeft: "auto", fontWeight: 700, color: T.mint }}>{fmtN(preview.cal * qty)} kcal</span>
            </div>
            {perAmt > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 13, color: T.sub }}>{unit.unit === "ml" ? "Milliliters" : "Grams"}</span>
              <input type="number" inputMode="decimal" step="any" min="0" value={gIn !== null ? gIn : String(rnd(perAmt * qty))}
                onFocus={(e) => { setGIn(String(rnd(perAmt * qty))); e.target.select(); }}
                onChange={(e) => { setGIn(e.target.value); const g = +e.target.value; if (g > 0) setQty(g / perAmt); }}
                onBlur={() => setGIn(null)}
                style={{ ...inp(T), width: 90, textAlign: "center", fontWeight: 700, padding: "8px 6px" }} />
              <span style={{ fontSize: 11, color: T.mut }}>{unit.unit} total · {perAmt}{unit.unit}/serving</span>
            </div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setPreview(null)} style={{ ...pill(T), flex: 1 }}>Back</button>
              <button onClick={confirmSingle} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Log{inLib ? "" : " + save to library"}</button>
            </div>
          </>}
        </div>}
      </div>
    </div>
  </div>);
}

function Pips({ T, val, low, high, ceiling }) {
  const goal = ceiling ? high : low;
  const bonus = ceiling ? 0 : Math.max(0, (high || low) - low);
  const dots = [];
  for (let i = 0; i < goal; i++) dots.push({ big: true, on: val >= i + 1 });
  for (let i = 0; i < bonus; i++) dots.push({ big: false, on: val >= goal + i + 1 });
  const overCeil = ceiling && val > high;
  return (<span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
    {dots.map((d, i) => (<span key={i} style={{ width: d.big ? 11 : 8, height: d.big ? 11 : 8, borderRadius: "50%",
      background: d.on ? (ceiling ? (overCeil ? T.red : T.amber) : T.green) : "transparent",
      border: `1.5px solid ${d.on ? "transparent" : T.border}` }} />))}
    {overCeil && <span style={{ fontSize: 10, color: T.red, fontWeight: 700 }}>+{rnd(val - high, 1)}</span>}
  </span>);
}

function GroupDetail({ T, gid, weekDates, dayTags, user, close }) {
  const g = GROUPS[gid] || DAILY_TARGETS.find((d) => d.id === gid) || { label: gid, emoji: "" };
  const [items, setItems] = useState(null);
  useEffect(() => { (async () => {
    const out = [];
    for (const d of weekDates) {
      if (d > todayStr()) continue;
      const t = dayTags[d];
      if (!t || !(gid === "produceG" ? t.pg > 0 : (t.g?.[gid] || 0) > 0)) { out.push({ d, list: [] }); continue; }
      try {
        const dd = await getDoc(doc(db, "fuel_users", user.uid, "days", d));
        const list = [];
        if (dd.exists()) {
          const day = dd.data();
          MEALS.forEach(({ key }) => (day.meals[key] || []).forEach((e) => {
            const v = gid === "produceG" ? (e.pgq || 0) : (e.tg?.[gid] || 0);
            if (v > 0) list.push({ name: e.name, v });
          }));
        }
        out.push({ d, list });
      } catch { out.push({ d, list: [] }); }
    }
    setItems(out);
  })(); }, [gid]);
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", background: T.bg, borderRadius: "18px 18px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{g.emoji} {g.label} · this week</span>
        <button onClick={close} style={{ ...pill(T), padding: "6px 10px" }}>✕</button>
      </div>
      {!items && <div style={{ padding: 20, textAlign: "center", color: T.mut, fontSize: 13 }}>Loading…</div>}
      {items && items.map(({ d, list }) => (<div key={d} style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.sub }}>{new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{d === todayStr() ? " · today" : ""}</div>
        {list.length === 0 && <div style={{ fontSize: 12, color: T.mut, padding: "4px 0 2px" }}>—</div>}
        {list.map((x, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.sub, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</span>
          <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{gid === "produceG" ? `${Math.round(x.v)}g` : `×${rnd(x.v, 1)}`}</span>
        </div>))}
      </div>))}
    </div>
  </div>);
}

function DietTab({ T, S, settings, persistSettings, dayTags, fridge, addFridgeItem, delFridgeItem, viewDate, user, day, todayCals, todayP, gramTargets, openLog, say }) {
  const dsel = viewDate;
  const wkStart = nutrWeekStartOf(dsel, settings.nutrWeekStart);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));
  const daysLeft = Math.max(1, 7 - weekDates.filter((d) => d < todayStr()).length);
  const week = useMemo(() => sumWeek(dayTags, weekDates), [dayTags, dsel]);
  const today = dayTags[dsel] || { g: {}, pg: 0, fb: 0, pl: [], fv: [] };
  const held = settings.ramp === 1 || settings.ramp === 2 ? RAMP_HELD : [];
  const [detail, setDetail] = useState(null);
  const [fOpen, setFOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fDays, setFDays] = useState("");
  const [ideasAI, setIdeasAI] = useState(null);
  const [ideasBusy, setIdeasBusy] = useState(false);

  const calLeft = Math.max(0, settings.calTarget - todayCals);
  const pLeft = Math.max(0, gramTargets.p - Math.round(todayP));
  const hour = new Date().getHours();
  const slots = ["breakfast", "lunch", "dinner", "snacks"];
  const cutoffs = { breakfast: 11, lunch: 15, dinner: 21, snacks: 24 };
  const nextSlot = dsel > todayStr() ? "breakfast" : slots.find((s) => (day.meals[s] || []).length === 0 && hour < cutoffs[s]) || "snacks";
  const emptyAhead = dsel > todayStr() ? slots.length : Math.max(1, slots.filter((s) => (day.meals[s] || []).length === 0 && hour < cutoffs[s]).length);
  const budgetCal = Math.round(calLeft / emptyAhead / 25) * 25;
  const budgetP = Math.round(pLeft / emptyAhead / 5) * 5;
  const mealMeta = MEALS.find((m) => m.key === nextSlot);

  const unmetWeekly = WEEKLY_TARGETS.filter((w) => {
    if (w.type === "ceiling" || held.includes(w.id)) return false;
    const goal = w.type === "range" ? w.low : w.target;
    return (week.g[w.id] || 0) < goal;
  }).sort((a, b) => {
    const need = (w) => ((w.type === "range" ? w.low : w.target) - (week.g[w.id] || 0));
    return need(b) - need(a);
  });
  const unmetDaily = DAILY_TARGETS.filter((d) => {
    if (d.id === "produceG") return false;
    const goal = d.type === "range" ? d.low : d.target;
    return (today.g[d.id] || 0) < goal;
  });
  const fridgeSoon = Object.values(fridge).filter((f) => {
    const left = f.days - Math.max(0, daysBetween(f.added, todayStr()));
    return left <= 3;
  }).sort((a, b) => (a.days - daysBetween(a.added, todayStr())) - (b.days - daysBetween(b.added, todayStr())));

  const ideas = [];
  fridgeSoon.slice(0, 2).forEach((f) => { const left = f.days - Math.max(0, daysBetween(f.added, todayStr())); ideas.push({ what: f.name, why: left <= 0 ? "in your fridge · use today" : `in your fridge · ${left}d left`, fridge: true }); });
  unmetWeekly.slice(0, Math.max(0, 3 - ideas.length)).forEach((w) => { const goal = w.type === "range" ? w.low : w.target; ideas.push({ what: FOOD_IDEAS[w.id], why: `${GROUPS[w.id].emoji} ${GROUPS[w.id].label}: ${rnd(week.g[w.id] || 0, 1)}/${goal} this week` }); });
  unmetDaily.slice(0, Math.max(0, 3 - ideas.length)).forEach((d) => { const label = GROUPS[d.id]?.label || d.label; const emoji = GROUPS[d.id]?.emoji || d.emoji || ""; ideas.push({ what: FOOD_IDEAS[d.id], why: `${emoji} ${label}: not yet today` }); });

  const askIdeas = async () => {
    setIdeasBusy(true); setIdeasAI(null);
    try {
      const gapsW = unmetWeekly.slice(0, 4).map((w) => `${GROUPS[w.id].label} ${rnd(week.g[w.id] || 0, 1)}/${w.type === "range" ? w.low : w.target} for the week`).join(", ");
      const res = await suggestForGaps(`${budgetCal} kcal and ${budgetP}g protein budget for ${mealMeta.label}; weekly food-group gaps: ${gapsW || "none"}; prefers high-protein, no cooking oil`);
      setIdeasAI(res);
    } catch (e) { say(aiErrMsg(e, "AI suggestion failed — try again")); }
    setIdeasBusy(false);
  };

  const addF = () => {
    if (!fName.trim()) return;
    const days = +fDays > 0 ? Math.round(+fDays) : guessShelf(fName);
    addFridgeItem({ id: uid(), name: fName.trim(), days, added: todayStr() });
    setFName(""); setFDays(""); setFOpen(false);
  };
  const fridgeFillsGap = (name) => {
    const t = autoTag(name);
    const hit = Object.keys(t.g).find((k) => unmetWeekly.find((w) => w.id === k));
    return hit ? GROUPS[hit].emoji : null;
  };
  const ramp = RAMP_STEPS.find((r) => r.id === settings.ramp) || RAMP_STEPS[0];

  return (<>
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Next up · {mealMeta.icon} {mealMeta.label}{dsel > todayStr() ? " · planned" : ""}</span>
        <span style={{ fontSize: 12, color: T.sub }}>~<b style={{ color: T.text }}>{fmtN(budgetCal)}</b> kcal · <b style={{ color: T.text }}>{budgetP}</b>g P</span>
      </div>
      {ideas.length > 0 && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {ideas.slice(0, 3).map((x, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.cardAlt, borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.what}</div>
            <div style={{ fontSize: 10.5, color: T.mut }}>{x.why}</div>
          </div>
          {x.fridge && <button onClick={() => openLog(x.what)} style={{ ...pill(T), padding: "5px 10px", fontSize: 11.5, color: T.mint, borderColor: T.mint, background: "transparent", flexShrink: 0, marginLeft: 8 }}>Log</button>}
        </div>))}
      </div>}
      <button onClick={askIdeas} style={{ ...pill(T), width: "100%", marginTop: 8, fontSize: 12.5 }}>{ideasBusy ? "Thinking…" : `✨ Ideas for ${mealMeta.label.toLowerCase()} (${fmtN(budgetCal)} kcal · ${budgetP}g P)`}</button>
      {ideasAI && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {ideasAI.map((t, i) => (<div key={i} style={{ background: T.cardAlt, borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.food} <span style={{ color: T.mut, fontWeight: 400 }}>· {t.amount}</span></div>
          <div style={{ fontSize: 10.5, color: T.sub }}>{t.why}</div>
        </div>))}
      </div>}
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Today{dsel !== todayStr() ? ` · ${shortDate(dsel)}` : ""}</span>
        <span style={{ fontSize: 11.5, color: T.sub }}>🌈 <b style={{ color: today.pg >= 400 ? T.green : T.text }}>{today.pg}</b>/400g produce</span>
      </div>
      <div style={{ marginTop: 6 }}><Bar pct={(today.pg / 400) * 100} color={today.pg >= 400 ? T.green : T.mint} bg={T.barBg} h={5} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 10 }}>
        {DAILY_TARGETS.filter((d) => d.id !== "produceG").map((d) => {
          const v = today.g[d.id] || 0;
          const label = GROUPS[d.id]?.label || d.label;
          const emoji = GROUPS[d.id]?.emoji || d.emoji || "";
          return (<button key={d.id} onClick={() => setDetail(d.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "3px 0", cursor: "pointer", color: T.text }}>
            <span style={{ fontSize: 12 }}>{emoji} {label}</span>
            <Pips T={T} val={v} low={d.type === "range" ? d.low : d.target} high={d.type === "range" ? d.high : d.target} ceiling={false} />
          </button>);
        })}
      </div>
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>This week</span>
        <span style={{ fontSize: 11, color: T.mut }}>{shortDate(wkStart)} – {shortDate(addDays(wkStart, 6))} · {daysLeft}d left</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {WEEKLY_TARGETS.map((w) => {
          const v = week.g[w.id] || 0;
          const isHeld = held.includes(w.id);
          const goal = w.type === "range" ? w.low : w.target;
          return (<button key={w.id} onClick={() => setDetail(w.id)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "7px 0", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", color: T.text, opacity: isHeld ? 0.55 : 1 }}>
            <span style={{ fontSize: 12.5 }}>{GROUPS[w.id].emoji} {GROUPS[w.id].label}{isHeld ? " ⏸" : ""}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pips T={T} val={v} low={w.type === "range" ? w.low : w.target} high={w.type === "range" ? w.high : w.target} ceiling={w.type === "ceiling"} />
              <span style={{ fontSize: 11.5, color: w.type === "ceiling" ? (v > w.target ? T.red : T.sub) : v >= goal ? T.green : T.sub, fontWeight: 600, minWidth: 34, textAlign: "right" }}>{rnd(v, 1)}/{w.type === "range" ? `${w.low}–${w.high}` : w.target}</span>
            </span>
          </button>);
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.sub, marginTop: 8 }}>
        <span>🌿 <b style={{ color: week.plants >= VARIETY.plants ? T.green : T.text }}>{week.plants}</b>/{VARIETY.plants} plants</span>
        <span>🥣 <b style={{ color: week.ferms >= VARIETY.ferms ? T.green : T.text }}>{week.ferms}</b>/{VARIETY.ferms} ferment types</span>
        <span>fiber ▲ <b style={{ color: T.text }}>{week.fbAvg}</b>g/d</span>
      </div>
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Fridge</span>
        <button onClick={() => setFOpen(!fOpen)} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>+</button>
      </div>
      {fOpen && <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input placeholder="What did you buy?" value={fName} onChange={(e) => setFName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addF()} style={inp(T)} />
        <input placeholder={fName.trim() ? `${guessShelf(fName)}d` : "days"} value={fDays} onChange={(e) => setFDays(e.target.value)} type="number" style={{ ...inp(T), width: 74 }} />
        <button onClick={addF} style={{ ...pill(T), background: T.mint, color: "#fff", borderColor: T.mint, flexShrink: 0 }}>Add</button>
      </div>}
      <div style={{ marginTop: 4 }}>
        {Object.values(fridge).length === 0 && !fOpen && <div style={{ fontSize: 12, color: T.mut, padding: "8px 0" }}>Track what's perishable — expiring items surface as meal ideas before they turn.</div>}
        {Object.values(fridge).sort((a, b) => (a.days - daysBetween(a.added, todayStr())) - (b.days - daysBetween(b.added, todayStr()))).map((f) => {
          const left = f.days - Math.max(0, daysBetween(f.added, todayStr()));
          const gap = fridgeFillsGap(f.name);
          return (<div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ flex: 1, fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}{gap ? ` ${gap}` : ""}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: left <= 0 ? T.red : left <= 2 ? T.amber : T.mut, flexShrink: 0 }}>{left <= 0 ? "use now" : `${left}d`}</span>
            <button onClick={() => openLog(f.name)} style={{ ...pill(T), padding: "4px 9px", fontSize: 11.5, flexShrink: 0 }}>Log</button>
            <button onClick={() => { delFridgeItem(f.id); say("Removed"); }} style={{ ...btn(T), color: T.mut, flexShrink: 0 }}>✓</button>
          </div>);
        })}
      </div>
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Gut protocol</span>
        <select value={settings.ramp} onChange={(e) => persistSettings({ ...settings, ramp: +e.target.value })} style={{ ...inp(T), width: "auto", padding: "6px 10px" }}>
          {RAMP_STEPS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.5 }}>{ramp.note}</div>
      <div style={{ fontSize: 10, color: T.mut, marginTop: 8 }}>{MEDICAL_NOTE}</div>
    </div>

    {detail && <GroupDetail T={T} gid={detail} weekDates={weekDates} dayTags={dayTags} user={user} close={() => setDetail(null)} />}
  </>);
}

function TagEditor({ T, food, foods, setFoodTags, patchFood, openRecipeEdit, openRecipeCopy, close, say }) {
  const [name, setName] = useState(food.name);
  const [serving, setServing] = useState(food.serving || "1 serving");
  const origG = servG(food);
  const [grams, setGrams] = useState(origG ? String(origG) : "");
  const [unitSel, setUnitSel] = useState((servUnit(food) || {}).unit === "ml" ? "ml" : "g");
  const [vals, setVals] = useState({ cal: food.cal, p: food.p, c: food.c, f: food.f, fiber: food.fiber || 0 });
  const [extras, setExtras] = useState({ sugar: food.sugar, satfat: food.satfat, micros: { ...M0(), ...(food.micros || {}) } });
  const t0 = ensureTags(food);
  const [tg, setTg] = useState({ ...t0.g });
  const [pg, setPg] = useState(t0.pg || 0);
  const [pl, setPl] = useState(t0.pl || "");
  const [fv, setFv] = useState(t0.fv || "");
  const gramsNum = +grams > 0 ? +grams : null;
  const gramsChanged = origG && gramsNum && Math.abs(gramsNum - origG) > 0.01;
  const [scaleDone, setScaleDone] = useState(false);

  const applyScale = () => {
    const r = gramsNum / origG;
    setVals((v) => ({ cal: rnd(v.cal * r), p: rnd(v.p * r, 1), c: rnd(v.c * r, 1), f: rnd(v.f * r, 1), fiber: rnd(v.fiber * r, 1) }));
    setExtras((x) => ({ sugar: x.sugar == null ? null : rnd(x.sugar * r, 1), satfat: x.satfat == null ? null : rnd(x.satfat * r, 1), micros: Object.fromEntries(Object.keys(x.micros).map((k) => [k, rnd(x.micros[k] * r, 1)])) }));
    setScaleDone(true);
    say("Nutrition scaled to the new amount");
  };

  const step = (k, d) => setTg((g) => { const v = Math.max(0, rnd((g[k] || 0) + d, 2)); const n = { ...g }; if (v === 0) delete n[k]; else n[k] = v; return n; });

  const save = () => {
    if (!name.trim()) return say("Name can't be empty");
    patchFood(food.id, { name: name.trim(), serving: serving.trim() || "1 serving", gServ: gramsNum, uServ: gramsNum ? unitSel : food.uServ || null, cal: +vals.cal || 0, p: +vals.p || 0, c: +vals.c || 0, f: +vals.f || 0, fiber: +vals.fiber || 0, sugar: extras.sugar, satfat: extras.satfat, micros: extras.micros });
    setFoodTags(food.id, { g: tg, pg: Math.max(0, Math.round(+pg || 0)), pl: pl.trim() || null, fv: fv.trim() || null });
    say("Food updated"); close();
  };

  const ov = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" };
  const sh = { background: T.bg, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" };
  return (<div style={ov} onClick={close}><div style={sh} onClick={(e) => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>Edit food</span>
      <button onClick={close} style={{ ...pill(T), padding: "6px 10px" }}>✕</button>
    </div>
    <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp(T), fontWeight: 700, marginTop: 12 }} />
    <input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="Serving description" style={{ ...inp(T), marginTop: 8 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 13, color: T.sub }}>Per serving</span>
      <input type="number" inputMode="decimal" value={grams} onChange={(e) => { setGrams(e.target.value); setScaleDone(false); }} placeholder="—" style={{ ...inp(T), width: 84, textAlign: "center", padding: "8px 6px" }} />
      <select value={unitSel} onChange={(e) => setUnitSel(e.target.value)} style={{ ...inp(T), width: "auto", padding: "7px 10px" }}>
        <option value="g">g</option><option value="ml">ml</option>
      </select>
      <span style={{ fontSize: 11, color: T.mut }}>enables gram logging</span>
    </div>
    {gramsChanged && !scaleDone && <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: T.amber, flex: 1 }}>Amount changed {origG}{unitSel} → {gramsNum}{unitSel}:</span>
      <button onClick={applyScale} style={{ ...pill(T), padding: "6px 10px", fontSize: 12, color: T.mint, borderColor: T.mint, background: "transparent" }}>Scale nutrition</button>
      <button onClick={() => setScaleDone(true)} style={{ ...pill(T), padding: "6px 10px", fontSize: 12 }}>Keep numbers</button>
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 10 }}>
      {[["cal", "kcal"], ["p", "P g"], ["c", "C g"], ["f", "F g"], ["fiber", "Fib g"]].map(([k, l]) => (
        <div key={k}>
          <div style={{ fontSize: 10, color: T.mut }}>{l}</div>
          <input type="number" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} style={{ ...inp(T), padding: "8px 6px" }} />
        </div>))}
    </div>

    {food.kind === "recipe" && <div style={{ marginTop: 14, background: T.bg2, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>🧾 Ingredients</span>
        <div style={{ display: "flex", gap: 6 }}>
          {food.recipe && <button onClick={() => openRecipeCopy(food)} style={{ ...pill(T), padding: "5px 10px", fontSize: 12 }}>⧉ Duplicate</button>}
          {food.recipe && <button onClick={() => openRecipeEdit(food)} style={{ ...pill(T), padding: "5px 10px", fontSize: 12, color: T.mint, borderColor: T.mint, background: "transparent" }}>✎ Edit recipe</button>}
        </div>
      </div>
      {food.recipe ? <>
        {food.recipe.items.map((it, i) => {
          const ing = (foods || []).find((x) => x.id === it.foodId);
          const u = ing ? servUnit(ing) : null;
          return (<div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: i < food.recipe.items.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <span style={{ color: T.sub }}>{it.name}</span>
            <span style={{ fontWeight: 600 }}>{u ? `${rnd(it.qty * u.amt)} ${u.unit}` : `${rnd(it.qty, 2)} srv`}</span>
          </div>);
        })}
        <div style={{ fontSize: 11, color: T.mut, marginTop: 6 }}>Makes {food.recipe.servings} serving{food.recipe.servings === 1 ? "" : "s"} · nutrition shown per serving</div>
      </> : <div style={{ fontSize: 11.5, color: T.mut, marginTop: 6 }}>Built before ingredient tracking — recreate it once via + Recipe to enable viewing and editing.</div>}
    </div>}

    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 14 }}>Counts toward…</div>
    <div style={{ fontSize: 10.5, color: T.mut, marginTop: 2 }}>Auto-detected from name — adjust if wrong</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
      {Object.keys(GROUPS).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: (tg[k] || 0) > 0 ? T.mintSoft : T.cardAlt, border: `1px solid ${(tg[k] || 0) > 0 ? T.mint : T.border}`, borderRadius: 10, padding: "6px 8px" }}>
          <span style={{ fontSize: 11.5, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{GROUPS[k].emoji} {GROUPS[k].label}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button onClick={() => step(k, -0.5)} style={{ ...btn(T), minWidth: 24, height: 24, fontSize: 13 }}>−</button>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{tg[k] || 0}</span>
            <button onClick={() => step(k, 0.5)} style={{ ...btn(T), minWidth: 24, height: 24, fontSize: 13 }}>+</button>
          </span>
        </div>))}
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: T.sub, flexShrink: 0 }}>Produce g</span>
      <input type="number" inputMode="numeric" value={pg} onChange={(e) => setPg(e.target.value)} style={{ ...inp(T), width: 80, padding: "8px 6px", textAlign: "center" }} />
      <input placeholder="plant (e.g. walnut)" value={pl} onChange={(e) => setPl(e.target.value)} style={{ ...inp(T), padding: "8px 8px", fontSize: 13 }} />
      <input placeholder="ferment" value={fv} onChange={(e) => setFv(e.target.value)} style={{ ...inp(T), padding: "8px 8px", fontSize: 13 }} />
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <button onClick={close} style={{ ...pill(T), flex: 1 }}>Cancel</button>
      <button onClick={save} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Save</button>
    </div>
  </div></div>);
}

function Trends({ T, S, logCals, settings, weightsMap, setWeight, delWeight, stepsMap, setSteps, delSteps, tdee, openDay, say }) {
  const [weekEnd, setWeekEnd] = useState(todayStr());
  const [pickOpen, setPickOpen] = useState(false);
  const [selBar, setSelBar] = useState(null);
  const [wIn, setWIn] = useState("");
  const [wksShown, setWksShown] = useState(5);
  const [openWk, setOpenWk] = useState(null);
  const [editDay, setEditDay] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [wkOpen, setWkOpen] = useState(false);
  const [stOpen, setStOpen] = useState(false);
  const [stEnd, setStEnd] = useState(todayStr());
  const [stSel, setStSel] = useState(null);
  const [stEdit, setStEdit] = useState("");

  const weekStart = addDays(weekEnd, -6);
  const isLast7 = weekEnd === todayStr();
  const week = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(weekEnd, -i); out.push({ d, cal: logCals[d] || 0 }); }
    return out;
  }, [logCals, weekEnd]);
  const logged = week.filter((x) => x.cal > 0);
  const weekAvg = logged.length ? Math.round(logged.reduce((a, x) => a + x.cal, 0) / logged.length) : 0;
  const maxCal = Math.max(settings.calTarget, ...week.map((x) => x.cal), 1);
  const shiftWeek = (n) => { setWeekEnd(clampD(addDays(weekEnd, n))); setSelBar(null); };

  const sorted = useMemo(() => Object.keys(weightsMap).sort().map((d) => ({ d, w: weightsMap[d] })), [weightsMap]);
  const trendChart = useMemo(() => ewmaTrend(sorted).slice(-30), [sorted]);
  const weeklyAll = useMemo(() => {
    const map = {};
    sorted.forEach((x) => { const wk = mondayOf(x.d); (map[wk] = map[wk] || []).push(x.w); });
    const keys = Object.keys(map).sort();
    return keys.map((k, i) => {
      const avg = rnd(map[k].reduce((a, b) => a + b, 0) / map[k].length, 1);
      const prev = i > 0 ? rnd(map[keys[i - 1]].reduce((a, b) => a + b, 0) / map[keys[i - 1]].length, 1) : null;
      return { wk: k, avg, n: map[k].length, d: prev == null ? null : rnd(avg - prev, 2) };
    }).reverse();
  }, [sorted]);

  const steps7 = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(stEnd, -i); out.push({ d, n: stepsMap[d] || 0 }); }
    return out;
  }, [stepsMap, stEnd]);
  const stMax = Math.max(...steps7.map((x) => x.n), 1);
  const stAvgAll = useMemo(() => {
    const vals = []; for (let i = 0; i < 7; i++) { const v = stepsMap[addDays(todayStr(), -i)]; if (v > 0) vals.push(v); }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [stepsMap]);
  const stepsFit = useMemo(() => stepsTdeeFit(logCals, weightsMap, stepsMap), [logCals, weightsMap, stepsMap]);

  const setDayWeight = (d, val) => {
    const v = parseFloat(val);
    if (!v || v < 60 || v > 500) return say("Enter a weight between 60 and 500 lb");
    setWeight(d, v); setEditDay(null); say("Weight saved");
  };
  const suggested = tdee.ok ? Math.round(tdee.tdee - settings.rate * 500) : null;
  const toGoal = tdee.ok && settings.goalW ? rnd(tdee.trendNow - settings.goalW, 1) : null;
  const wksToGoal = toGoal != null && settings.rate > 0 ? rnd(toGoal / settings.rate, 1) : null;
  const selInfo = selBar ? week.find((x) => x.d === selBar) : null;
  const goalY = 16 + (Math.min(settings.calTarget, maxCal) / maxCal) * 124;

  return (<>
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => shiftWeek(-7)} style={btn(T)}>‹</button>
        <button onClick={() => setPickOpen(!pickOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{shortDate(weekStart)} – {shortDate(weekEnd)} ▾</div>
          <div style={{ fontSize: 11, color: T.mut }}>avg <b style={{ color: T.text }}>{fmtN(weekAvg)}</b> · goal {fmtN(settings.calTarget)} · <span style={{ color: weekAvg <= settings.calTarget ? T.green : T.red, fontWeight: 700 }}>{weekAvg <= settings.calTarget ? "−" : "+"}{fmtN(Math.abs(settings.calTarget - weekAvg))}/day</span></div>
        </button>
        <button onClick={() => shiftWeek(7)} disabled={isLast7} style={{ ...btn(T), opacity: isLast7 ? 0.35 : 1 }}>›</button>
      </div>
      {pickOpen && <div style={{ background: T.cardAlt, borderRadius: 12, padding: 10, marginTop: 10 }}>
        <div style={{ fontSize: 11, color: T.mut, marginBottom: 6 }}>Pick the window's start day</div>
        <input type="date" value={weekStart} max={addDays(todayStr(), -6)} onChange={(e) => { if (e.target.value) { setWeekEnd(clampD(addDays(e.target.value, 6))); setSelBar(null); } }} style={inp(T)} />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={() => shiftWeek(-1)} style={{ ...pill(T), flex: 1, padding: "7px 4px", fontSize: 12 }}>− 1 day</button>
          <button onClick={() => shiftWeek(1)} disabled={isLast7} style={{ ...pill(T), flex: 1, padding: "7px 4px", fontSize: 12, opacity: isLast7 ? 0.4 : 1 }}>+ 1 day</button>
          {!isLast7 && <button onClick={() => { setWeekEnd(todayStr()); setSelBar(null); }} style={{ ...pill(T), flex: 1, padding: "7px 4px", fontSize: 12, color: T.mint, borderColor: T.mint }}>Last 7 days</button>}
        </div>
      </div>}
      <div style={{ position: "relative", height: 156, marginTop: 12 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: goalY, borderTop: `1.5px dashed ${T.mut}`, opacity: 0.55 }} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, position: "absolute", left: 0, right: 0, bottom: 16 }}>
          {week.map((x) => {
            const base = Math.min(x.cal, settings.calTarget), over = Math.max(0, x.cal - settings.calTarget);
            const sel = selBar === x.d;
            return (<div key={x.d} onClick={() => setSelBar(sel ? null : x.d)} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%", cursor: "pointer" }}>
              {sel && <div style={{ fontSize: 10, fontWeight: 700, color: T.text, background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 5px", marginBottom: 3, whiteSpace: "nowrap" }}>{x.cal ? fmtN(x.cal) : "—"}</div>}
              <div style={{ width: "70%", display: "flex", flexDirection: "column", justifyContent: "flex-end", outline: sel ? `2px solid ${T.mint}` : "none", outlineOffset: 2, borderRadius: 3 }}>
                {over > 0 && <div style={{ height: (over / maxCal) * 124, background: T.red, borderRadius: "3px 3px 0 0" }} />}
                <div style={{ height: (base / maxCal) * 124, background: x.cal ? T.green : T.barBg, borderRadius: over > 0 ? 0 : "3px 3px 0 0", minHeight: x.cal ? 2 : 4 }} />
              </div>
            </div>);
          })}
        </div>
        <div style={{ display: "flex", gap: 6, position: "absolute", left: 0, right: 0, bottom: 0, height: 12 }}>
          {week.map((x) => (<div key={x.d} style={{ flex: 1, textAlign: "center", fontSize: 9, color: selBar === x.d ? T.mint : T.mut, fontWeight: selBar === x.d ? 700 : 400 }}>
            {new Date(x.d + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
          </div>))}
        </div>
      </div>
      {selInfo && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.cardAlt, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
        <span style={{ fontSize: 12, color: T.sub }}>{fmtDate(selInfo.d)} · <b style={{ color: T.text }}>{selInfo.cal ? `${fmtN(selInfo.cal)} kcal` : "nothing logged"}</b></span>
        <button onClick={() => openDay(selInfo.d)} style={{ ...pill(T), padding: "6px 10px", fontSize: 12, color: T.mint, borderColor: T.mint, background: "transparent" }}>Open day ›</button>
      </div>}
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Weight</span>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" inputMode="decimal" placeholder="lbs today" value={wIn} onChange={(e) => setWIn(e.target.value)} style={{ ...inp(T), width: 100, padding: "6px 10px" }} />
          <button onClick={() => { setDayWeight(todayStr(), wIn); setWIn(""); }} style={{ ...pill(T), background: T.mint, color: "#fff", borderColor: T.mint, padding: "6px 12px" }}>Log</button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}><WeightSVG T={T} data={trendChart} goal={settings.goalW} /></div>
      <button onClick={() => setWkOpen(!wkOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 12, padding: "8px 0 0", width: "100%", textAlign: "left" }}>{wkOpen ? "▾" : "▸"} Weigh-in history · {weeklyAll.length} week{weeklyAll.length === 1 ? "" : "s"} · tap a week to edit days</button>
      {wkOpen && <div style={{ marginTop: 4 }}>
        {weeklyAll.length === 0 && <div style={{ fontSize: 13, color: T.mut, padding: 12 }}>Log your first fasted morning weight above — you can also backfill past days once a week appears.</div>}
        {weeklyAll.slice(0, wksShown).map((w) => (<div key={w.wk}>
          <button onClick={() => { setOpenWk(openWk === w.wk ? null : w.wk); setEditDay(null); }} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "8px 0", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", color: T.text, fontSize: 12 }}>
            <span style={{ color: T.sub }}>{openWk === w.wk ? "▾" : "▸"} Wk of Mon {shortDate(w.wk)} <span style={{ color: T.mut }}>({w.n} weigh-in{w.n > 1 ? "s" : ""})</span></span>
            <span><b>{w.avg}</b> lb {w.d != null && <span style={{ color: w.d > 0 ? T.red : T.green, marginLeft: 6 }}>{w.d > 0 ? "+" : ""}{w.d}</span>}</span>
          </button>
          {openWk === w.wk && <div style={{ background: T.cardAlt, borderRadius: 10, padding: "4px 10px", marginBottom: 8 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const d = addDays(w.wk, i);
              if (d > todayStr()) return null;
              const val = weightsMap[d];
              const editing = editDay === d;
              return (<div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 6 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ fontSize: 12, color: T.sub }}>{new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
                {editing ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" inputMode="decimal" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setDayWeight(d, editVal)} style={{ ...inp(T), width: 84, padding: "5px 8px", background: T.card }} />
                  <button onClick={() => setDayWeight(d, editVal)} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>✓</button>
                  {val != null && <button onClick={() => { delWeight(d); setEditDay(null); say("Weigh-in deleted"); }} style={{ ...btn(T), color: T.red }}>🗑</button>}
                  <button onClick={() => setEditDay(null)} style={{ ...btn(T), color: T.mut }}>×</button>
                </div> : <button onClick={() => { setEditDay(d); setEditVal(val != null ? String(val) : ""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: val != null ? T.text : T.mut, fontWeight: val != null ? 600 : 400 }}>
                  {val != null ? `${val} lb ✎` : "— add"}
                </button>}
              </div>);
            })}
          </div>}
        </div>))}
        {weeklyAll.length > wksShown && <button onClick={() => setWksShown(wksShown + 8)} style={{ ...pill(T), width: "100%", marginTop: 8 }}>Show earlier weeks ({weeklyAll.length - wksShown} more)</button>}
      </div>}
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <button onClick={() => setStOpen(!stOpen)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: T.text, padding: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{stOpen ? "▾" : "▸"} 👟 Steps</span>
        <span style={{ fontSize: 12, color: T.sub }}>today <b style={{ color: T.text }}>{fmtN(stepsMap[todayStr()] || 0)}</b> · 7d avg <b style={{ color: T.text }}>{fmtN(stAvgAll)}</b></span>
      </button>
      {stOpen && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <button onClick={() => { setStEnd(clampD(addDays(stEnd, -7))); setStSel(null); }} style={btn(T)}>‹</button>
          <span style={{ fontSize: 12, color: T.sub }}>{shortDate(addDays(stEnd, -6))} – {shortDate(stEnd)}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {stEnd !== todayStr() && <button onClick={() => { setStEnd(todayStr()); setStSel(null); }} style={{ ...pill(T), padding: "5px 10px", fontSize: 11.5 }}>Today</button>}
            <button onClick={() => { setStEnd(clampD(addDays(stEnd, 7))); setStSel(null); }} disabled={stEnd === todayStr()} style={{ ...btn(T), opacity: stEnd === todayStr() ? 0.35 : 1 }}>›</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90, marginTop: 8 }}>
          {steps7.map((x) => (<div key={x.d} onClick={() => { setStSel(stSel === x.d ? null : x.d); setStEdit(x.n ? String(x.n) : ""); }} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%", cursor: "pointer" }}>
            <div style={{ width: "68%", height: Math.max(x.n ? 3 : 2, (x.n / stMax) * 74), background: x.n ? (stSel === x.d ? T.mint : T.sub) : T.barBg, borderRadius: "3px 3px 0 0", opacity: x.n ? 0.9 : 1 }} />
            <div style={{ fontSize: 9, color: stSel === x.d ? T.mint : T.mut, marginTop: 4, fontWeight: stSel === x.d ? 700 : 400 }}>{new Date(x.d + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</div>
          </div>))}
        </div>
        {stSel && <div style={{ display: "flex", gap: 8, alignItems: "center", background: T.cardAlt, borderRadius: 10, padding: "8px 10px", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: T.sub, flexShrink: 0 }}>{shortDate(stSel)}</span>
          <input type="number" inputMode="numeric" value={stEdit} onChange={(e) => setStEdit(e.target.value)} placeholder="steps" style={{ ...inp(T), padding: "6px 10px" }} />
          <button onClick={() => { const v = Math.round(+stEdit); if (v > 0) { setSteps(stSel, v); say("Steps logged"); setStSel(null); } else say("Enter a step count"); }} style={{ ...pill(T), background: T.mint, color: "#fff", borderColor: T.mint, padding: "6px 12px", flexShrink: 0 }}>Save</button>
          {stepsMap[stSel] > 0 && <button onClick={() => { delSteps(stSel); setStSel(null); say("Deleted"); }} style={{ ...btn(T), color: T.red, flexShrink: 0 }}>🗑</button>}
          <button onClick={() => setStSel(null)} style={{ ...btn(T), color: T.mut, flexShrink: 0 }}>✕</button>
        </div>}
        <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>
          {stepsFit.ok ? <>≈ <b style={{ color: T.text }}>+{fmtN(stepsFit.per1k)} kcal</b> per 1,000 steps · from {stepsFit.n} weeks of your data · directional, not gospel</>
            : stepsFit.flat ? "Steps logged, but they've been too consistent to separate their effect — a few higher/lower days will teach the model faster."
            : "Keep logging steps and weight — enough variation unlocks a personal steps→burn estimate."}
        </div>
      </>}
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Your real TDEE</div>
      {tdee.ok ? <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: T.mint }}>~{fmtN(tdee.tdee)}</span>
          <span style={{ fontSize: 13, color: T.sub }}>kcal/day burned</span>
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>avg in <b style={{ color: T.text }}>{fmtN(tdee.avgIn)}</b> · trend <b style={{ color: tdee.rate > 0 ? T.red : T.green }}>{tdee.rate > 0 ? "+" : ""}{tdee.rate} lb/wk</b> · last {tdee.span}d</div>
        <div style={{ background: T.mintSoft, borderRadius: 12, padding: "10px 12px", marginTop: 10, fontSize: 13, color: T.text }}>
          → eat about <b style={{ color: T.mint }}>{fmtN(suggested)} kcal/day</b> for −{settings.rate} lb/wk{wksToGoal > 0 && <span style={{ color: T.sub }}> · ~{wksToGoal} wks to {settings.goalW} lb</span>}
        </div>
      </> : <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>{tdee.why}. Log food daily and weigh in each morning — the estimate appears automatically.</div>}
    </div>
  </>);
}

function Library({ T, S, foods, patchFood, deleteFood, onLog, openEditor, openRecipe, openQuick, say }) {
  const [q, setQ] = useState("");
  const list = foods.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || (f.brand || "").toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.fav - a.fav) || a.name.localeCompare(b.name));
  return (<div style={S.card}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>Food library · {foods.length}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={openQuick} style={{ ...pill(T), padding: "7px 10px", fontSize: 12 }}>+ Quick food</button>
        <button onClick={openRecipe} style={{ ...pill(T), padding: "7px 10px", fontSize: 12, color: T.mint, borderColor: T.mint, background: "transparent" }}>+ Recipe</button>
      </div>
    </div>
    <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp(T), marginTop: 10 }} />
    <div style={{ marginTop: 6 }}>
      {list.slice(0, 200).map((f) => (<SwipeRow key={f.id} T={T} onDelete={() => { deleteFood(f.id); say("Deleted"); }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
          <button onClick={() => patchFood(f.id, { fav: !f.fav })} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: f.fav ? T.amber : T.mut }}>{f.fav ? "★" : "☆"}</button>
          <div onClick={() => openEditor(f)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}{f.kind === "recipe" ? " 🧾" : ""}</div>
            <div style={{ fontSize: 11, color: T.mut }}>{f.serving} · {fmtN(f.cal)} kcal · P{Math.round(f.p)} C{Math.round(f.c)} F{Math.round(f.f)}{f.src === "photo" ? " · 📷" : f.src === "text" ? " · ✍️" : f.src === "manual" ? " · ⌨️" : f.src === "usda" ? " · USDA" : ""}</div>
          </div>
          <button onClick={() => onLog(f)} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>+</button>
          {!HAS_TOUCH && <button onClick={() => { deleteFood(f.id); say("Deleted"); }} style={{ ...btn(T), color: T.mut }}>×</button>}
        </div>
      </SwipeRow>))}
    </div>
  </div>);
}

function QuickFood({ T, addFoodToLib, close, say }) {
  const [v, setV] = useState({ name: "", serving: "1 serving", cal: "", p: "", c: "", f: "", fiber: "" });
  const set = (k, val) => setV({ ...v, [k]: val });
  const save = () => {
    if (!v.name.trim() || v.cal === "") return say("Name and calories are required");
    addFoodToLib(mkFood({ name: v.name.trim(), serving: v.serving.trim() || "1 serving", cal: +v.cal, p: +v.p || 0, c: +v.c || 0, f: +v.f || 0, fiber: +v.fiber || 0, kind: "recipe" }, "manual"));
    say("Saved to library"); close();
  };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 55, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: T.card, borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Quick food / recipe</div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Know the totals already — like your Creami? Enter it straight, no ingredient list.</div>
      <input placeholder="Name (e.g. Ninja Creami — chocolate)" value={v.name} onChange={(e) => set("name", e.target.value)} style={{ ...inp(T), marginTop: 12 }} />
      <input placeholder="Serving (e.g. 1 pint)" value={v.serving} onChange={(e) => set("serving", e.target.value)} style={{ ...inp(T), marginTop: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 8 }}>
        {[["cal", "kcal"], ["p", "P g"], ["c", "C g"], ["f", "F g"], ["fiber", "Fib g"]].map(([k, l]) => (
          <div key={k}>
            <div style={{ fontSize: 10, color: T.mut }}>{l}</div>
            <input type="number" inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} style={{ ...inp(T), padding: "8px 6px" }} />
          </div>))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={close} style={{ ...pill(T), flex: 1 }}>Cancel</button>
        <button onClick={save} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Save to library</button>
      </div>
    </div>
  </div>);
}

function IngredientAdd({ T, food, onAdd, close }) {
  const u = servUnit(food);
  const [v, setV] = useState(String(u ? u.amt : 1));
  const qty = u ? (+v || 0) / u.amt : (+v || 0);
  const commit = () => { if (+v > 0) onAdd(u ? +v / u.amt : +v); };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 65, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "16dvh" }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "calc(100% - 48px)", maxWidth: 320, background: T.bg, borderRadius: 16, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{food.name}</div>
      <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>1 serving = {food.serving}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <input type="number" inputMode="decimal" step="any" min="0" autoFocus value={v}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          style={{ ...inp(T), textAlign: "center", fontWeight: 700, fontSize: 17 }} />
        <span style={{ fontSize: 13, color: T.sub, flexShrink: 0, maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u ? u.unit : `× ${food.serving}`}</span>
      </div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 8, textAlign: "center" }}>= <b style={{ color: T.mint }}>{fmtN(food.cal * qty)}</b> cal · P{rnd(food.p * qty, 1)} C{rnd(food.c * qty, 1)} F{rnd(food.f * qty, 1)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={close} style={{ ...pill(T), flex: 1 }}>Cancel</button>
        <button onClick={commit} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Add</button>
      </div>
    </div>
  </div>);
}

function RecipeBuilder({ T, foods, addFoodToLib, editing, copy, patchFood, setFoodTags, close, say }) {
  const [drafts, setDrafts] = useState({});
  const [adding, setAdding] = useState(null);
  const [name, setName] = useState(editing ? (copy ? editing.name + " (copy)" : editing.name) : "");
  const [servings, setServings] = useState(editing?.recipe?.servings || 1);
  const [items, setItems] = useState(editing?.recipe?.items ? editing.recipe.items.map((x) => ({ ...x })) : []);
  const [q, setQ] = useState("");
  const opts = foods.filter((f) => f.kind !== "recipe" && q && f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  const tot = items.reduce((a, it) => { const f = foods.find((x) => x.id === it.foodId); if (!f) return a; return { cal: a.cal + f.cal * it.qty, p: a.p + f.p * it.qty, c: a.c + f.c * it.qty, f: a.f + f.f * it.qty, fiber: a.fiber + (f.fiber || 0) * it.qty }; }, { cal: 0, p: 0, c: 0, f: 0, fiber: 0 });
  const isEdit = editing && !copy;

  const save = () => {
    if (!name.trim() || items.length === 0) return say("Add a name and ingredients");
    const micros = M0();
    let fiber = 0, pgSum = 0;
    let sugarSum = 0, sugarAny = false, satSum = 0, satAny = false;
    const gAgg = {};
    items.forEach((it) => {
      const f = foods.find((x) => x.id === it.foodId); if (!f) return;
      Object.keys(micros).forEach((k) => (micros[k] += (f.micros?.[k] || 0) * it.qty));
      fiber += (f.fiber || 0) * it.qty;
      if (f.sugar != null) { sugarAny = true; sugarSum += f.sugar * it.qty; }
      if (f.satfat != null) { satAny = true; satSum += f.satfat * it.qty; }
      const ft = ensureTags(f);
      Object.keys(ft.g || {}).forEach((k) => (gAgg[k] = (gAgg[k] || 0) + ft.g[k] * it.qty));
      pgSum += (ft.pg || 0) * it.qty;
    });
    Object.keys(micros).forEach((k) => (micros[k] = rnd(micros[k] / servings, 1)));
    const tags = { g: Object.fromEntries(Object.keys(gAgg).map((k) => [k, rnd(gAgg[k] / servings, 2)]).filter(([, v]) => v > 0)), pg: Math.round(pgSum / servings), pl: null, fv: null };
    const basics = {
      name: name.trim(),
      serving: servings === 1 ? "1 recipe" : `1/${servings} of recipe`,
      cal: rnd(tot.cal / servings), p: rnd(tot.p / servings, 1), c: rnd(tot.c / servings, 1), f: rnd(tot.f / servings, 1),
      fiber: rnd(fiber / servings, 1),
      sugar: sugarAny ? rnd(sugarSum / servings, 1) : null,
      satfat: satAny ? rnd(satSum / servings, 1) : null,
      micros,
      recipe: { items: items.map((x) => ({ foodId: x.foodId, name: x.name, qty: x.qty })), servings },
    };
    if (isEdit) {
      patchFood(editing.id, basics);
      setFoodTags(editing.id, tags);
      say("Recipe updated");
    } else {
      const nf = mkFood({ ...basics, kind: "recipe" }, "recipe");
      nf.recipe = basics.recipe;
      nf.tags = tags;
      addFoodToLib(nf);
      say(copy ? "Recipe duplicated — tweak away" : "Recipe saved to library");
    }
    close();
  };

  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center" }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "100dvh", background: T.card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top) + 12px) 16px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={close} style={{ ...pill(T), padding: "6px 12px", flexShrink: 0 }}>✕</button>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{copy ? "Duplicate recipe" : isEdit ? "Edit recipe" : "New recipe from ingredients"}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "0 16px 16px" }}>
      {copy && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 10 }}>Saving creates a new recipe — the original stays untouched.</div>}
      <input placeholder="Recipe name (e.g. Protein Creami)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp(T), marginTop: 10 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <span style={{ fontSize: 13, color: T.sub }}>Makes</span>
        <button onClick={() => setServings(Math.max(1, servings - 1))} style={btn(T)}>−</button>
        <b>{servings}</b>
        <button onClick={() => setServings(servings + 1)} style={btn(T)}>+</button>
        <span style={{ fontSize: 13, color: T.sub }}>serving{servings > 1 ? "s" : ""}</span>
      </div>
      <input placeholder="Search ingredients from your library…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp(T), marginTop: 12 }} />
      {opts.map((f) => (<button key={f.id} onClick={() => setAdding(f)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 4px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 13, cursor: "pointer" }}>+ {f.name} <span style={{ color: T.mut }}>({f.serving}, {fmtN(f.cal)} kcal)</span></button>))}
      {items.map((it, i) => {
        const f = foods.find((x) => x.id === it.foodId);
        const u = f ? servUnit(f) : null;
        const shown = drafts[i] != null ? drafts[i] : String(u ? rnd(it.qty * u.amt, 2) : rnd(it.qty, 2));
        const commit = (txt) => {
          setDrafts((d) => ({ ...d, [i]: txt }));
          const v = +txt;
          if (v > 0) setItems(items.map((x, j) => (j === i ? { ...x, qty: u ? v / u.amt : v } : x)));
        };
        return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <input type="number" inputMode="decimal" step="any" min="0" value={shown}
                onFocus={(e) => { setDrafts((d) => ({ ...d, [i]: shown })); e.target.select(); }}
                onChange={(e) => commit(e.target.value)}
                onBlur={() => setDrafts((d) => { const n = { ...d }; delete n[i]; return n; })}
                style={{ ...inp(T), width: 66, textAlign: "center", fontWeight: 700, padding: "5px 4px", fontSize: 14 }} />
              <span style={{ fontSize: 11.5, color: T.mut, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u ? u.unit : `× ${f ? f.serving : "serving"}`}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.mint }}>{f ? fmtN(f.cal * it.qty) : "—"}</div>
            <div style={{ fontSize: 9.5, color: T.mut, marginTop: 1 }}>cal</div>
          </div>
          <button onClick={() => { setItems(items.filter((_, j) => j !== i)); setDrafts({}); }} style={{ ...btn(T), color: T.mut, flexShrink: 0 }}>✕</button>
        </div>);
      })}
      {items.length > 0 && <div style={{ marginTop: 12, fontSize: 13, color: T.sub }}>Per serving: <b style={{ color: T.mint }}>{fmtN(tot.cal / servings)} kcal</b> · P{Math.round(tot.p / servings)} C{Math.round(tot.c / servings)} F{Math.round(tot.f / servings)} · fiber {rnd(tot.fiber / servings, 1)}g</div>}
      </div>
      {adding && <IngredientAdd T={T} food={adding} onAdd={(qty) => { setItems([...items, { foodId: adding.id, name: adding.name, qty }]); setDrafts({}); setQ(""); setAdding(null); }} close={() => setAdding(null)} />}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px calc(env(safe-area-inset-bottom) + 12px)", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={save} style={{ ...pill(T), flex: 1, background: T.mint, color: "#fff", borderColor: T.mint, padding: "12px" }}>{copy ? "Save copy" : isEdit ? "Save changes" : "Save recipe"}</button>
      </div>
    </div>
  </div>);
}

function Settings({ T, S, settings, persistSettings, gramTargets, user, say }) {
  const up = (k, v) => persistSettings({ ...settings, [k]: v });
  const pctSum = settings.macroPct.p + settings.macroPct.c + settings.macroPct.f;
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` };
  const numIn = { ...inp(T), width: 92, padding: "7px 10px", textAlign: "right" };
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const pasteInto = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setPw(t.trim()); }
    catch { say("Clipboard blocked — long-press the field and choose Paste"); }
  };
  const setAppPassword = async () => {
    if (pw.length < 6) return say("Password needs at least 6 characters");
    setPwBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, pw);
      await linkWithCredential(user, cred);
      say("Password set — you can sign in with it on the home-screen app");
      setPw("");
    } catch (e) {
      const c = e?.code || "";
      if (c.includes("provider-already-linked") || c.includes("credential-already-in-use")) {
        try { await updatePassword(user, pw); say("Password updated"); setPw(""); }
        catch (e2) { say(e2?.code?.includes("requires-recent-login") ? "Re-sign-in with Google first, then set the password" : e2.message); }
      } else say(e.message);
    }
    setPwBusy(false);
  };
  const testAI = async () => {
    say("Testing AI…");
    try { await askClaude("Reply with the word ok"); say("AI ✓ connected"); }
    catch (e) { say(aiErrMsg(e, "AI test failed")); }
  };
  return (<>
    <div style={S.card}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Targets</div>
      <div style={row}><span style={{ fontSize: 13, color: T.sub }}>Daily calories</span><input type="number" value={settings.calTarget} onChange={(e) => up("calTarget", +e.target.value)} style={numIn} /></div>
      <div style={row}>
        <span style={{ fontSize: 13, color: T.sub }}>Macros set by</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[["pct", "%"], ["g", "grams"]].map(([k, l]) => <button key={k} onClick={() => up("macroMode", k)} style={{ ...pill(T), padding: "6px 12px", background: settings.macroMode === k ? T.mintSoft : T.cardAlt, color: settings.macroMode === k ? T.mint : T.sub }}>{l}</button>)}
        </div>
      </div>
      {settings.macroMode === "pct" ? <>
        {["p", "c", "f"].map((k) => (<div key={k} style={row}>
          <span style={{ fontSize: 13, color: T.sub }}>{{ p: "Protein", c: "Carbs", f: "Fat" }[k]} %</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.mut }}>{gramTargets[k]} g</span>
            <input type="number" value={settings.macroPct[k]} onChange={(e) => up("macroPct", { ...settings.macroPct, [k]: +e.target.value })} style={numIn} />
          </div>
        </div>))}
        {pctSum !== 100 && <div style={{ fontSize: 12, color: T.amber, paddingTop: 8 }}>⚠ Percentages total {pctSum}% — adjust to 100%.</div>}
      </> : ["p", "c", "f"].map((k) => (<div key={k} style={row}>
        <span style={{ fontSize: 13, color: T.sub }}>{{ p: "Protein", c: "Carbs", f: "Fat" }[k]} g</span>
        <input type="number" value={settings.macroG[k]} onChange={(e) => up("macroG", { ...settings.macroG, [k]: +e.target.value })} style={numIn} /></div>))}
      <div style={row}><span style={{ fontSize: 13, color: T.sub }}>Water goal (fl oz)</span><input type="number" value={settings.waterGoal} onChange={(e) => up("waterGoal", +e.target.value)} style={numIn} /></div>
    </div>
    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Weight goal</div>
      <div style={row}><span style={{ fontSize: 13, color: T.sub }}>Goal weight (lb)</span><input type="number" value={settings.goalW} onChange={(e) => up("goalW", +e.target.value)} style={numIn} /></div>
      <div style={row}>
        <span style={{ fontSize: 13, color: T.sub }}>Target rate (lb/wk)</span>
        <select value={settings.rate} onChange={(e) => up("rate", +e.target.value)} style={{ ...inp(T), width: "auto", padding: "7px 10px" }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>−{r}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 11, color: T.mut, paddingTop: 8 }}>Vitamins and minerals use fixed daily recommended amounts (NIH DRIs for adult men). Seeded generic foods use USDA-typical values for the listed serving; Online search pulls verified per-100g data.</div>
    </div>
    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>App password</div>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>For signing in inside the home-screen app, where Google popups don't work. Email: <b style={{ color: T.text }}>{user.email}</b></div>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={inp(T)} />
        <button onClick={pasteInto} style={{ ...pill(T), padding: "8px 10px", flexShrink: 0 }}>📋</button>
        <button onClick={setAppPassword} disabled={pwBusy} style={{ ...pill(T), background: T.mint, color: "#fff", borderColor: T.mint, flexShrink: 0 }}>{pwBusy ? "…" : "Set"}</button>
      </div>
      <button onClick={testAI} style={{ ...pill(T), width: "100%", marginTop: 10 }}>Test AI connection</button>
    </div>
    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Account</div>
      <div style={{ fontSize: 13, color: T.sub, marginBottom: 10 }}>{user.email}</div>
      <button onClick={() => signOut(auth)} style={{ ...pill(T), width: "100%" }}>Sign out</button>
      <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>Everything syncs via Firebase and works offline; changes upload when you're back online.</div>
      <div style={{ fontSize: 10, color: T.mut, textAlign: "center", marginTop: 14 }}>Fuel v4.1</div>
    </div>
  </>);
}

createRoot(document.getElementById("root")).render(<App />);
