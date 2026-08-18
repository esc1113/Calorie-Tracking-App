import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, writeBatch } from "firebase/firestore";
import { SEED_FOODS } from "./seed.js";

const CFG = (typeof window !== "undefined" && window.FUEL_CONFIG) || {};
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
  light: { bg: "#F7FAF9", card: "#FFFFFF", cardAlt: "#F1F5F4", border: "#E3EAE8", text: "#17211F", sub: "#5C6B68", mut: "#8CA09B", mint: "#0D9488", mintSoft: "#D6F0EC", green: "#1D9E75", red: "#E24B4A", amber: "#D97706", barBg: "#E6EDEB", navBg: "#FFFFFFEE" },
  dark: { bg: "#0F1514", card: "#182120", cardAlt: "#1F2A29", border: "#243230", text: "#E7EFED", sub: "#93A5A1", mut: "#61736F", mint: "#2DD4BF", mintSoft: "#123A36", green: "#4ADE80", red: "#F08080", amber: "#F0A93C", barBg: "#243230", navBg: "#141B1AEE" },
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
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const rnd = (n, d = 0) => { const p = Math.pow(10, d); return Math.round(((+n || 0) + Number.EPSILON) * p) / p; };
const fmtN = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString());
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|\s|,)\w/g, (m) => m.toUpperCase());

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

function extractJSON(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  const a = text.indexOf("["), b = text.lastIndexOf("]");
  let raw = null;
  if (a !== -1 && (s === -1 || a < s)) raw = text.slice(a, b + 1); else if (s !== -1) raw = text.slice(s, e + 1);
  if (!raw) throw new Error("No JSON in response");
  return JSON.parse(raw);
}

const FOOD_SCHEMA = `{"name": string, "brand": string|null, "serving": string like "1 scoop (31g)" or "1 cup (226g)", "cal": number, "p": grams protein, "c": grams carbs, "f": grams fat, "fiber": g|null, "sugar": g|null, "satfat": g|null, "micros": {"sodium": mg, "potassium": mg, "calcium": mg, "iron": mg, "magnesium": mg, "zinc": mg, "vitA": mcg, "vitC": mg, "vitD": mcg, "vitE": mg, "vitK": mcg, "b6": mg, "b12": mcg, "folate": mcg}}`;

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
    return (j.products || []).map((p) => {
      const n = p.nutriments || {};
      return {
        name: titleCase(p.product_name || "Unknown"), brand: (p.brands || "").split(",")[0] || null, serving: "100 g",
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
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const M0 = () => ({ sodium: 0, potassium: 0, calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitA: 0, vitC: 0, vitD: 0, vitE: 0, vitK: 0, b6: 0, b12: 0, folate: 0 });
function mkFood(o, src) {
  return { id: uid(), name: o.name || "Food", brand: o.brand || null, serving: o.serving || "1 serving", cal: rnd(o.cal || 0), p: rnd(o.p || 0, 1), c: rnd(o.c || 0, 1), f: rnd(o.f || 0, 1), fiber: rnd(o.fiber || 0, 1), sugar: o.sugar == null ? null : rnd(o.sugar, 1), satfat: o.satfat == null ? null : rnd(o.satfat, 1), micros: { ...M0(), ...(o.micros || {}) }, fav: false, uses: 0, lastUsed: null, kind: o.kind || "food", src: o.src || src };
}

function emptyDay() { return { meals: { misc: [], breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0 }; }

function entryFromFood(food, qty) {
  const m = {}; Object.keys(M0()).forEach((k) => (m[k] = rnd((food.micros?.[k] || 0) * qty, 1)));
  return { id: uid(), foodId: food.id, name: food.name, serving: food.serving, qty, cal: rnd(food.cal * qty), p: rnd(food.p * qty, 1), c: rnd(food.c * qty, 1), f: rnd(food.f * qty, 1), fiber: rnd((food.fiber || 0) * qty, 1), micros: m, time: Date.now() };
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

function calcTDEE(logCals, weightsMap, windowDays = 21) {
  const all = Object.keys(weightsMap).sort().map((d) => ({ d, w: weightsMap[d] }));
  const start = addDays(todayStr(), -windowDays);
  const trend = ewmaTrend(all).filter((x) => x.d >= start);
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

const DEFAULT_SETTINGS = { theme: "light", calTarget: 2650, macroMode: "pct", macroPct: { p: 30, c: 45, f: 25 }, macroG: { p: 199, c: 298, f: 74 }, waterGoal: 64, calView: "remaining", goalW: 140, rate: 1.0 };

export default function App() {
  const [user, setUser] = useState(undefined);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("today");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [foods, setFoods] = useState([]);
  const [weightsMap, setWeightsMap] = useState({});
  const [logCals, setLogCals] = useState({});
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

  const T = THEMES[settings.theme];
  const say = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const mainRef = () => doc(db, "fuel_users", user.uid);

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
      batch.set(doc(db, "fuel_users", user.uid), { seeded: true, settings: DEFAULT_SETTINGS, weights: {}, logcals: {} }, { merge: true });
      await batch.commit();
      setFoods(seeded); setSettings(DEFAULT_SETTINGS); setWeightsMap({}); setLogCals({});
    } else {
      const d = main.data();
      setSettings({ ...DEFAULT_SETTINGS, ...(d.settings || {}) });
      setWeightsMap(d.weights || {}); setLogCals(d.logcals || {});
      const fs = await getDocs(collection(db, "fuel_users", user.uid, "foods"));
      setFoods(fs.docs.map((x) => x.data()));
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
    setLogCals((p) => ({ ...p, [date]: c }));
    if (user) {
      setDoc(doc(db, "fuel_users", user.uid, "days", date), nd).catch(console.error);
      updateDoc(mainRef(), { [`logcals.${date}`]: c }).catch(console.error);
    }
  };
  const addFoodToLib = (f) => { setFoods((fs) => (fs.find((x) => x.id === f.id) ? fs : [...fs, f])); if (user) setDoc(doc(db, "fuel_users", user.uid, "foods", f.id), f).catch(console.error); };
  const patchFood = (id, patch) => { setFoods((fs) => fs.map((x) => (x.id === id ? { ...x, ...patch } : x))); if (user) setDoc(doc(db, "fuel_users", user.uid, "foods", id), patch, { merge: true }).catch(console.error); };
  const deleteFood = (id) => { setFoods((fs) => fs.filter((x) => x.id !== id)); if (user) deleteDoc(doc(db, "fuel_users", user.uid, "foods", id)).catch(console.error); };
  const setWeight = (d, v) => { setWeightsMap((m) => ({ ...m, [d]: v })); if (user) updateDoc(mainRef(), { [`weights.${d}`]: v }).catch(console.error); };
  const delWeight = (d) => { setWeightsMap((m) => { const n = { ...m }; delete n[d]; return n; }); if (user) updateDoc(mainRef(), { [`weights.${d}`]: deleteField() }).catch(console.error); };

  const totals = useMemo(() => dayTotals(day), [day]);
  const gramTargets = useMemo(() => {
    if (settings.macroMode === "g") return settings.macroG;
    const c = settings.calTarget, m = settings.macroPct;
    return { p: Math.round((c * m.p) / 100 / 4), c: Math.round((c * m.c) / 100 / 4), f: Math.round((c * m.f) / 100 / 9) };
  }, [settings]);

  const logFood = (food, qty, meal) => {
    saveDay({ ...day, meals: { ...day.meals, [meal]: [...day.meals[meal], entryFromFood(food, qty)] } });
    patchFood(food.id, { uses: (food.uses || 0) + 1, lastUsed: Date.now() });
    say(`Added to ${MEALS.find((m) => m.key === meal).label}`);
  };
  const removeEntry = (meal, id) => saveDay({ ...day, meals: { ...day.meals, [meal]: day.meals[meal].filter((e) => e.id !== id) } });
  const setWater = (oz) => saveDay({ ...day, water: Math.max(0, oz) });
  const openDay = (d) => { setDate(d); setTab("today"); setDpOpen(false); };

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
    } catch (e) { say(e.message === "no-worker" ? "Add your Worker URL in index.html to enable AI" : "AI suggestion failed — try again"); }
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
              <div style={{ fontSize: 12, color: T.mut }}>{date === todayStr() ? "Today" : "Tap to jump ▾"}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtDate(date)} {date === todayStr() ? "▾" : ""}</div>
            </button>
            <button onClick={() => setDate(addDays(date, 1))} disabled={date >= todayStr()} style={{ ...btn(T), opacity: date >= todayStr() ? 0.35 : 1 }}>›</button>
          </div>
          <button onClick={() => persistSettings({ ...settings, theme: settings.theme === "light" ? "dark" : "light" })} style={btn(T)}>{settings.theme === "light" ? "🌙" : "☀️"}</button>
        </div>

        {dpOpen && <div style={{ ...S.card, marginBottom: 10 }}>
          <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(clampD(e.target.value))} style={inp(T)} />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {[["« month", () => setDate(clampD(addMonths(date, -1)))], ["‹ week", () => setDate(addDays(date, -7))], ["Today", () => setDate(todayStr())], ["week ›", () => setDate(clampD(addDays(date, 7)))], ["month »", () => setDate(clampD(addMonths(date, 1)))]].map(([l, fn]) => (
              <button key={l} onClick={fn} style={{ ...pill(T), flex: 1, padding: "7px 4px", fontSize: 12 }}>{l}</button>))}
          </div>
        </div>}

        {tab === "today" && <>
          <div style={{ ...S.card, cursor: "pointer" }} onClick={() => persistSettings({ ...settings, calView: settings.calView === "remaining" ? "consumed" : "remaining" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 34, fontWeight: 700, color: totals.cal > settings.calTarget ? T.red : T.mint }}>
                  {settings.calView === "remaining" ? fmtN(settings.calTarget - totals.cal) : fmtN(totals.cal)}
                </span>
                <span style={{ fontSize: 13, color: T.sub, marginLeft: 8 }}>
                  {settings.calView === "remaining" ? (settings.calTarget - totals.cal >= 0 ? "kcal remaining" : "kcal over") : `of ${fmtN(settings.calTarget)} kcal`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: T.mut }}>tap to flip</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 8, background: T.barBg, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${Math.min(100, (totals.cal / settings.calTarget) * 100)}%`, background: T.mint }} />
                {totals.cal > settings.calTarget && <div style={{ width: `${Math.min(30, ((totals.cal - settings.calTarget) / settings.calTarget) * 100)}%`, background: T.red }} />}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {[["Protein", totals.p, gramTargets.p, T.green], ["Carbs", totals.c, gramTargets.c, "#378ADD"], ["Fat", totals.f, gramTargets.f, T.amber]].map(([l, v, g, col]) => (
                <div key={l} style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.sub }}><span>{l}</span><span style={{ color: T.text, fontWeight: 500 }}>{Math.round(v)}/{g}g</span></div>
                  <div style={{ marginTop: 4 }}><Bar pct={(v / g) * 100} color={col} bg={T.barBg} h={5} /></div>
                </div>
              ))}
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
            return (<div key={key} style={{ ...S.card, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{icon} {label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {sub > 0 && <span style={{ fontSize: 12, color: T.sub }}>{fmtN(sub)} kcal</span>}
                  <button onClick={() => setSheet({ meal: key, tab: "search" })} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>+</button>
                </div>
              </div>
              {items.map((e) => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: T.mut }}>{e.qty} × {e.serving} · P{Math.round(e.p)} C{Math.round(e.c)} F{Math.round(e.f)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.mint }}>{fmtN(e.cal)}</span>
                  <button onClick={() => removeEntry(key, e.id)} style={{ ...btn(T), color: T.mut }}>×</button>
                </div>
              </div>))}
            </div>);
          })}
        </>}

        {tab === "trends" && <Trends T={T} S={S} logCals={logCals} settings={settings} weightsMap={weightsMap} setWeight={setWeight} delWeight={delWeight} tdee={tdee} openDay={openDay} say={say} />}
        {tab === "library" && <Library T={T} S={S} foods={foods} patchFood={patchFood} deleteFood={deleteFood} onLog={(f) => setSheet({ meal: autoMeal(), tab: "search", pre: f })} openRecipe={() => setRecipeOpen(true)} openQuick={() => setQuickOpen(true)} say={say} />}
        {tab === "settings" && <Settings T={T} S={S} settings={settings} persistSettings={persistSettings} gramTargets={gramTargets} user={user} say={say} />}
      </div>

      <button onClick={() => setSheet({ meal: autoMeal(), tab: "search" })}
        style={{ position: "fixed", right: "max(16px, calc(50% - 224px))", bottom: "calc(env(safe-area-inset-bottom) + 84px)", width: 56, height: 56, borderRadius: 28, background: T.mint, color: settings.theme === "light" ? "#fff" : "#04342C", fontSize: 28, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(13,148,136,.35)" }}>+</button>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.navBg, backdropFilter: "blur(10px)", borderTop: `1px solid ${T.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {[["today", "Today", "🏠"], ["trends", "Trends", "📈"], ["library", "Library", "📚"], ["settings", "Settings", "⚙️"]].map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 0 12px", background: "none", border: "none", cursor: "pointer", color: tab === k ? T.mint : T.mut, fontWeight: tab === k ? 700 : 500, fontSize: 11 }}>
              <div style={{ fontSize: 18 }}>{ic}</div>{l}
            </button>))}
        </div>
      </div>

      {sheet && <AddSheet T={T} sheet={sheet} setSheet={setSheet} foods={foods} addFoodToLib={addFoodToLib} logFood={logFood} openQuick={() => { setSheet(null); setQuickOpen(true); }} say={say} />}
      {recipeOpen && <RecipeBuilder T={T} foods={foods} addFoodToLib={addFoodToLib} close={() => setRecipeOpen(false)} say={say} />}
      {quickOpen && <QuickFood T={T} addFoodToLib={addFoodToLib} close={() => setQuickOpen(false)} say={say} />}
      {toast && <div style={{ position: "fixed", bottom: 150, left: "50%", transform: "translateX(-50%)", background: T.text, color: T.bg, fontSize: 13, padding: "8px 16px", borderRadius: 20, zIndex: 60, whiteSpace: "nowrap" }}>{toast}</div>}
    </div>
  );
}

function Center({ T, msg }) {
  return <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui", color: T.sub }}>{msg}</div>;
}

function SignIn() {
  const T = THEMES.light;
  const [err, setErr] = useState(null);
  const go = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (e) { try { await signInWithRedirect(auth, provider); } catch (e2) { setErr(e2.message); } }
  };
  return (<div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui", padding: 24, textAlign: "center" }}>
    <div style={{ width: 72, height: 72, borderRadius: 20, background: T.mint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>F</div>
    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 16, color: T.text }}>Fuel</div>
    <div style={{ fontSize: 14, color: T.sub, marginTop: 6, maxWidth: 280 }}>Photo-powered food logging, micros, and your real TDEE — synced to your Google account.</div>
    <button onClick={go} style={{ marginTop: 24, padding: "13px 22px", borderRadius: 14, border: "none", background: T.mint, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Continue with Google</button>
    {err && <div style={{ marginTop: 14, fontSize: 12, color: T.red, maxWidth: 300 }}>{err}</div>}
  </div>);
}

function AddSheet({ T, sheet, setSheet, foods, addFoodToLib, logFood, openQuick, say }) {
  const [q, setQ] = useState("");
  const [oq, setOq] = useState("");
  const [oResults, setOResults] = useState(null);
  const [oBusy, setOBusy] = useState(false);
  const [qty, setQty] = useState(1);
  const [meal, setMeal] = useState(sheet.meal);
  const [mode, setMode] = useState(sheet.tab);
  const [photoKind, setPhotoKind] = useState("label");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(sheet.pre || null);
  const [desc, setDesc] = useState("");
  const [queue, setQueue] = useState(null);
  const [qIdx, setQIdx] = useState(0);
  const savedRef = useRef(0);
  const fileRef = useRef();

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
      } catch (e) { say(e.message === "no-worker" ? "Add your Worker URL to enable photo AI" : "One photo failed — skipped"); setBusy(false); advance(); return; }
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
    } catch (e) { say(e.message === "no-worker" ? "Add your Worker URL in index.html to enable photo AI" : "Couldn't read that photo — try again"); }
    setBusy(false);
  };
  const handleText = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try { setPreview(mkFood(await parseTextFood(desc.trim()), "text")); }
    catch (e) { say(e.message === "no-worker" ? "Add your Worker URL in index.html to enable AI" : "Couldn't parse that — try rephrasing"); }
    setBusy(false);
  };

  const atwater = preview ? Math.round(preview.p * 4 + preview.c * 4 + preview.f * 9) : 0;
  const atwaterOff = preview && preview.cal > 60 && Math.abs(atwater - preview.cal) / preview.cal > 0.15;
  const inLib = preview && foods.find((x) => x.id === preview.id);
  const confirmSingle = () => { addFoodToLib(preview); logFood(inLib ? inLib : preview, qty, meal); setSheet(null); };

  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setSheet(null)}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", background: T.card, borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{queue ? `Import labels · ${qIdx + 1} of ${queue.length}` : "Add food"}</span>
        {!queue && <select value={meal} onChange={(e) => setMeal(e.target.value)} style={{ ...inp(T), width: "auto", padding: "6px 10px" }}>
          {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>}
      </div>

      {queue && busy && <div style={{ padding: 32, textAlign: "center", color: T.sub, fontSize: 14 }}>Reading label {qIdx + 1}…</div>}

      {!preview && !queue && <>
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
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple={photoKind === "label"} style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileRef.current.click()} disabled={busy} style={{ ...pill(T), width: "100%", marginTop: 10, padding: 24, borderStyle: "dashed", background: "transparent" }}>
            {busy ? "Reading photo with AI…" : photoKind === "label" ? "📷 Take or upload label photos (pick several to batch-import)" : "📷 Take or upload a food photo"}
          </button>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>{photoKind === "label" ? "Works on printed labels and app screenshots. Select multiple and confirm each — everything lands in your library so you never scan it twice." : "AI portion estimate — good, not gospel. You can edit before saving."}</div>
        </div>}

        {mode === "describe" && <div style={{ marginTop: 14 }}>
          <textarea rows={3} placeholder={'e.g. "200g grilled chicken breast and 1 cup white rice"'} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inp(T), resize: "none" }} />
          <button onClick={handleText} disabled={busy} style={{ ...pill(T), width: "100%", marginTop: 8, background: T.mint, color: "#fff", borderColor: T.mint }}>{busy ? "Estimating…" : "Estimate nutrition"}</button>
        </div>}

        {mode === "recent" && <div style={{ marginTop: 8 }}>
          {recent.map((f) => <FoodPick key={f.id} T={T} f={f} onPick={() => setPreview(f)} />)}
          {recent.length === 0 && <div style={{ fontSize: 13, color: T.mut, padding: 16, textAlign: "center" }}>Foods you log will show up here.</div>}
        </div>}
      </>}

      {preview && <div style={{ marginTop: 14 }}>
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

        {queue ? <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => advance()} style={{ ...pill(T), flex: 1 }}>Skip</button>
          <button onClick={() => { addFoodToLib(preview); savedRef.current++; advance(); }} style={{ ...pill(T), flex: 1, color: T.mint, borderColor: T.mint, background: "transparent" }}>Save</button>
          <button onClick={() => { addFoodToLib(preview); logFood(preview, 1, meal); savedRef.current++; advance(); }} style={{ ...pill(T), flex: 1, background: T.mint, color: "#fff", borderColor: T.mint }}>Save + log</button>
        </div> : <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: T.sub }}>Servings</span>
            <button onClick={() => setQty(Math.max(0.25, rnd(qty - 0.25, 2)))} style={btn(T)}>−</button>
            <span style={{ fontWeight: 700, minWidth: 36, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty(rnd(qty + 0.25, 2))} style={btn(T)}>+</button>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: T.mint }}>{fmtN(preview.cal * qty)} kcal</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setPreview(null)} style={{ ...pill(T), flex: 1 }}>Back</button>
            <button onClick={confirmSingle} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Log{inLib ? "" : " + save to library"}</button>
          </div>
        </>}
      </div>}
      <div style={{ height: 8 }} />
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

function Trends({ T, S, logCals, settings, weightsMap, setWeight, delWeight, tdee, openDay, say }) {
  const [weekEnd, setWeekEnd] = useState(todayStr());
  const [pickOpen, setPickOpen] = useState(false);
  const [selBar, setSelBar] = useState(null);
  const [wIn, setWIn] = useState("");
  const [wksShown, setWksShown] = useState(5);
  const [openWk, setOpenWk] = useState(null);
  const [editDay, setEditDay] = useState(null);
  const [editVal, setEditVal] = useState("");

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

  const setDayWeight = (d, val) => {
    const v = parseFloat(val);
    if (!v || v < 60 || v > 500) return say("Enter a weight between 60 and 500 lb");
    setWeight(d, v); setEditDay(null); say("Weight saved");
  };
  const suggested = tdee.ok ? Math.round(tdee.tdee - settings.rate * 500) : null;
  const toGoal = tdee.ok && settings.goalW ? rnd(tdee.trendNow - settings.goalW, 1) : null;
  const wksToGoal = toGoal != null && settings.rate > 0 ? rnd(toGoal / settings.rate, 1) : null;
  const selInfo = selBar ? week.find((x) => x.d === selBar) : null;

  return (<>
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => shiftWeek(-7)} style={btn(T)}>‹</button>
        <button onClick={() => setPickOpen(!pickOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{shortDate(weekStart)} – {shortDate(weekEnd)} ▾</div>
          <div style={{ fontSize: 11, color: T.mut }}>{isLast7 ? "last 7 days" : "custom window"}</div>
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginTop: 12 }}>
        {week.map((x) => {
          const base = Math.min(x.cal, settings.calTarget), over = Math.max(0, x.cal - settings.calTarget);
          const sel = selBar === x.d;
          return (<div key={x.d} onClick={() => setSelBar(sel ? null : x.d)} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%", cursor: "pointer" }}>
            {sel && <div style={{ fontSize: 10, fontWeight: 700, color: T.text, background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 5px", marginBottom: 3, whiteSpace: "nowrap" }}>{x.cal ? fmtN(x.cal) : "—"}</div>}
            <div style={{ width: "70%", display: "flex", flexDirection: "column", justifyContent: "flex-end", outline: sel ? `2px solid ${T.mint}` : "none", outlineOffset: 2, borderRadius: 3 }}>
              {over > 0 && <div style={{ height: (over / maxCal) * 100, background: T.red, borderRadius: "3px 3px 0 0" }} />}
              <div style={{ height: (base / maxCal) * 100, background: x.cal ? T.green : T.barBg, borderRadius: over > 0 ? 0 : "3px 3px 0 0", minHeight: x.cal ? 2 : 4 }} />
            </div>
            <div style={{ fontSize: 9, color: sel ? T.mint : T.mut, marginTop: 4, fontWeight: sel ? 700 : 400, textAlign: "center" }}>
              {new Date(x.d + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}<br />{x.d.slice(8)}
            </div>
          </div>);
        })}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <div style={{ width: "70%", height: (Math.min(weekAvg, maxCal) / maxCal) * 100, background: T.mut, borderRadius: "3px 3px 0 0", opacity: 0.6 }} />
          <div style={{ fontSize: 9, color: T.mut, marginTop: 4, textAlign: "center" }}>Avg<br />&nbsp;</div>
        </div>
      </div>
      {selInfo && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.cardAlt, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
        <span style={{ fontSize: 12, color: T.sub }}>{fmtDate(selInfo.d)} · <b style={{ color: T.text }}>{selInfo.cal ? `${fmtN(selInfo.cal)} kcal` : "nothing logged"}</b></span>
        <button onClick={() => openDay(selInfo.d)} style={{ ...pill(T), padding: "6px 10px", fontSize: 12, color: T.mint, borderColor: T.mint, background: "transparent" }}>Open day ›</button>
      </div>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: T.sub }}>
        <span>Avg over {logged.length} logged day{logged.length === 1 ? "" : "s"}</span><span style={{ fontWeight: 700, color: T.text }}>{fmtN(weekAvg)} kcal</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub, marginTop: 4 }}>
        <span>Goal</span><span style={{ fontWeight: 700, color: T.mint }}>{fmtN(settings.calTarget)} kcal</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub, marginTop: 4 }}>
        <span>{weekAvg <= settings.calTarget ? "Under goal by" : "Over goal by"}</span>
        <span style={{ fontWeight: 700, color: weekAvg <= settings.calTarget ? T.green : T.red }}>{fmtN(Math.abs(settings.calTarget - weekAvg))} /day</span>
      </div>
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
      <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>Weekly averages (Mon–Sun) · tap a week to see and fix daily weigh-ins</div>
      <div style={{ marginTop: 4 }}>
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
      </div>
    </div>

    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Your real TDEE</div>
      {tdee.ok ? <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: T.mint }}>~{fmtN(tdee.tdee)}</span>
          <span style={{ fontSize: 13, color: T.sub }}>kcal/day burned</span>
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
          Last {tdee.span} days: you averaged <b style={{ color: T.text }}>{fmtN(tdee.avgIn)}</b> kcal over {tdee.nDays} logged days while your trend weight moved <b style={{ color: tdee.rate > 0 ? T.red : T.green }}>{tdee.rate > 0 ? "+" : ""}{tdee.rate} lb/wk</b>. Energy balance: {fmtN(tdee.avgIn)} − ({tdee.rate} × 500) ≈ {fmtN(tdee.tdee)}.
        </div>
        <div style={{ background: T.mintSoft, borderRadius: 12, padding: 12, marginTop: 10 }}>
          <div style={{ fontSize: 12, color: T.mint, fontWeight: 700 }}>To lose {settings.rate} lb/week</div>
          <div style={{ fontSize: 14, marginTop: 2, color: T.text }}>Eat about <b style={{ color: T.mint }}>{fmtN(suggested)} kcal/day</b>{wksToGoal > 0 && <span style={{ color: T.sub }}> · ~{wksToGoal} wks to {settings.goalW} lb ({toGoal} lb to go)</span>}</div>
        </div>
      </> : <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>{tdee.why}. Log food daily and weigh in each morning — the estimate appears automatically.</div>}
    </div>
  </>);
}

function Library({ T, S, foods, patchFood, deleteFood, onLog, openRecipe, openQuick, say }) {
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
      {list.slice(0, 200).map((f) => (<div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => patchFood(f.id, { fav: !f.fav })} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: f.fav ? T.amber : T.mut }}>{f.fav ? "★" : "☆"}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}{f.kind === "recipe" ? " 🧾" : ""}</div>
          <div style={{ fontSize: 11, color: T.mut }}>{f.serving} · {fmtN(f.cal)} kcal · P{Math.round(f.p)} C{Math.round(f.c)} F{Math.round(f.f)}{f.src === "photo" ? " · 📷" : f.src === "text" ? " · ✍️" : f.src === "manual" ? " · ⌨️" : f.src === "usda" ? " · USDA" : ""}</div>
        </div>
        <button onClick={() => onLog(f)} style={{ ...btn(T), color: T.mint, borderColor: T.mint }}>+</button>
        <button onClick={() => { deleteFood(f.id); say("Deleted"); }} style={{ ...btn(T), color: T.mut }}>×</button>
      </div>))}
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

function RecipeBuilder({ T, foods, addFoodToLib, close, say }) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState(1);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const opts = foods.filter((f) => f.kind !== "recipe" && q && f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  const tot = items.reduce((a, it) => { const f = foods.find((x) => x.id === it.foodId); if (!f) return a; return { cal: a.cal + f.cal * it.qty, p: a.p + f.p * it.qty, c: a.c + f.c * it.qty, f: a.f + f.f * it.qty }; }, { cal: 0, p: 0, c: 0, f: 0 });
  const save = () => {
    if (!name.trim() || items.length === 0) return say("Add a name and ingredients");
    const micros = M0();
    items.forEach((it) => { const f = foods.find((x) => x.id === it.foodId); if (f) Object.keys(micros).forEach((k) => (micros[k] += (f.micros?.[k] || 0) * it.qty)); });
    Object.keys(micros).forEach((k) => (micros[k] = rnd(micros[k] / servings, 1)));
    addFoodToLib(mkFood({ name: name.trim(), serving: servings === 1 ? "1 recipe" : `1/${servings} of recipe`, cal: tot.cal / servings, p: tot.p / servings, c: tot.c / servings, f: tot.f / servings, micros, kind: "recipe" }, "recipe"));
    say("Recipe saved to library"); close();
  };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", background: T.card, borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>New recipe from ingredients</div>
      <input placeholder="Recipe name (e.g. Protein Creami)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp(T), marginTop: 10 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <span style={{ fontSize: 13, color: T.sub }}>Makes</span>
        <button onClick={() => setServings(Math.max(1, servings - 1))} style={btn(T)}>−</button>
        <b>{servings}</b>
        <button onClick={() => setServings(servings + 1)} style={btn(T)}>+</button>
        <span style={{ fontSize: 13, color: T.sub }}>serving{servings > 1 ? "s" : ""}</span>
      </div>
      <input placeholder="Search ingredients from your library…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp(T), marginTop: 12 }} />
      {opts.map((f) => (<button key={f.id} onClick={() => { setItems([...items, { foodId: f.id, name: f.name, qty: 1 }]); setQ(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 4px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 13, cursor: "pointer" }}>+ {f.name} <span style={{ color: T.mut }}>({f.serving}, {fmtN(f.cal)} kcal)</span></button>))}
      {items.map((it, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ flex: 1, fontSize: 13 }}>{it.name}</span>
        <button onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.max(0.25, rnd(x.qty - 0.25, 2)) } : x)))} style={btn(T)}>−</button>
        <span style={{ fontSize: 13, minWidth: 34, textAlign: "center" }}>{it.qty}×</span>
        <button onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, qty: rnd(x.qty + 0.25, 2) } : x)))} style={btn(T)}>+</button>
        <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ ...btn(T), color: T.mut }}>×</button>
      </div>))}
      {items.length > 0 && <div style={{ marginTop: 12, fontSize: 13, color: T.sub }}>Per serving: <b style={{ color: T.mint }}>{fmtN(tot.cal / servings)} kcal</b> · P{Math.round(tot.p / servings)} C{Math.round(tot.c / servings)} F{Math.round(tot.f / servings)}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={close} style={{ ...pill(T), flex: 1 }}>Cancel</button>
        <button onClick={save} style={{ ...pill(T), flex: 2, background: T.mint, color: "#fff", borderColor: T.mint }}>Save recipe</button>
      </div>
    </div>
  </div>);
}

function Settings({ T, S, settings, persistSettings, gramTargets, user, say }) {
  const up = (k, v) => persistSettings({ ...settings, [k]: v });
  const pctSum = settings.macroPct.p + settings.macroPct.c + settings.macroPct.f;
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` };
  const numIn = { ...inp(T), width: 92, padding: "7px 10px", textAlign: "right" };
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
        <input type="number" value={settings.macroG[k]} onChange={(e) => up("macroG", { ...settings.macroG, [k]: +e.target.value })} style={numIn} />
      </div>))}
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
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Account</div>
      <div style={{ fontSize: 13, color: T.sub, marginBottom: 10 }}>{user.email}</div>
      <button onClick={() => signOut(auth)} style={{ ...pill(T), width: "100%" }}>Sign out</button>
      <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>Everything syncs to your Google account via Firebase and works offline; changes upload when you're back online.</div>
    </div>
  </>);
}

createRoot(document.getElementById("root")).render(<App />);
