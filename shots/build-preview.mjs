import { readFileSync, writeFileSync } from "node:fs";

const img = (name) => `data:image/png;base64,${readFileSync(new URL(`./web-${name}`, import.meta.url)).toString("base64")}`;

const desktopShots = [
  {
    file: "01-login.png",
    title: "Sign in",
    caption: "Calm entry point: the deep-teal brand mark on the warm off-white ground. Sign-up, password reset, and onboarding follow the same quiet layout.",
  },
  {
    file: "02-trips.png",
    title: "Trips overview",
    caption: "Each trip card carries its color dot, status, dates, headcount, and running total in tabular numerals.",
  },
  {
    file: "03-dashboard.png",
    title: "Trip dashboard — the Goa scenario",
    caption: "The seeded reference trip: ₹13,000 across 5 expenses. Ajit is owed ₹4,200 (after Amit's ₹1,000 part-payment); balances always reconcile to zero. Positive/negative is never color alone — the badge and sign carry it too.",
  },
  {
    file: "04-expenses.png",
    title: "Expense history",
    caption: "Search, category and payer filters, who-shared avatars, and cursor pagination for long trips.",
  },
  {
    file: "05-expense-detail.png",
    title: "Expense detail — Drinks, shared by only two",
    caption: "₹1,200 paid by Amit, split between Ajit and Amit only. Rahul and Sneha carry none of it. The allocation footer proves the split adds up exactly.",
  },
  {
    file: "06-add-expense.png",
    title: "Add expense — live split preview",
    caption: "₹1,500 lunch, Amit unticked → the preview recomputes instantly to ₹500 each for the other three. Equal, exact, percentage, and share splits; multi-payer via one tap. The server recomputes everything on save.",
  },
  {
    file: "07-settle.png",
    title: "Settle up",
    caption: "Greedy minimal transfers from live outstanding balances. Amit's ₹1,000 part-payment is recorded below and already netted out of his suggestion. Any payment can be reversed with a reason — an audited correction, never a delete.",
  },
  {
    file: "08-report.png",
    title: "Final report",
    caption: "Per-person summary, category breakdown, remaining transfers, completed settlements, and the full expense table. Exports to CSV and prints cleanly.",
  },
  {
    file: "09-participants.png",
    title: "People",
    caption: "Guests by name (no account needed), secure one-time invite links, claimable identities, and safe removal that preserves financial history. Every action button carries its icon.",
  },
  {
    file: "13-toast.png",
    title: "CRUD feedback — toasts + translucent backdrop",
    caption: "A live capture right after adding \u201cPriya\u201d: the success toast slides in bottom-right, and the transparent travel motifs \u2014 dashed route, receipt with ₹ coin, compass \u2014 sit faintly behind the content without touching legibility.",
  },
];

const mobileShots = [
  { file: "10-mobile-dashboard.png", title: "Dashboard", caption: "One-handed layout; primary actions in thumb reach." },
  { file: "11-mobile-add-expense.png", title: "Add expense", caption: "Big amount field, native controls, same live preview." },
  { file: "12-mobile-settle.png", title: "Settle up", caption: "Balances and suggested transfers stack cleanly." },
];

const card = (s, cls = "") => `
  <figure class="shot ${cls}">
    <div class="frame"><img src="${img(s.file)}" alt="${s.title} screen" loading="lazy" /></div>
    <figcaption>
      <h3>${s.title}</h3>
      <p>${s.caption}</p>
    </figcaption>
  </figure>`;

const html = `<title>TripSplit — UI preview</title>
<style>
  :root {
    --page: #f7f8f6; --surface: #ffffff; --ink: #202923; --ink-soft: #66716b;
    --line: #e2e7e2; --primary: #176b5b; --accent: #e8ddc8; --accent-deep: #6d5f41;
    --shadow: 0 1px 2px rgb(32 41 35 / .06), 0 8px 24px rgb(32 41 35 / .05);
  }
  @media (prefers-color-scheme: dark) {
    :root { --page:#161b18; --surface:#1e2420; --ink:#e8ece9; --ink-soft:#9aa69f; --line:#2e3631; --primary:#4fa38f; --accent:#3a342a; --accent-deep:#cfc2a4; --shadow: 0 1px 2px rgb(0 0 0 / .4); }
  }
  :root[data-theme="dark"] { --page:#161b18; --surface:#1e2420; --ink:#e8ece9; --ink-soft:#9aa69f; --line:#2e3631; --primary:#4fa38f; --accent:#3a342a; --accent-deep:#cfc2a4; --shadow: 0 1px 2px rgb(0 0 0 / .4); }
  :root[data-theme="light"] { --page:#f7f8f6; --surface:#ffffff; --ink:#202923; --ink-soft:#66716b; --line:#e2e7e2; --primary:#176b5b; --accent:#e8ddc8; --accent-deep:#6d5f41; --shadow: 0 1px 2px rgb(32 41 35 / .06), 0 8px 24px rgb(32 41 35 / .05); }

  body { background: var(--page); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.55; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 48px 20px 80px; }
  header.intro { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  .brandline { display: flex; align-items: center; gap: 10px; }
  .brandline svg { flex: none; }
  .brandline span { font-weight: 650; letter-spacing: -0.01em; font-size: 18px; }
  h1 { font-size: clamp(26px, 4vw, 34px); letter-spacing: -0.02em; line-height: 1.15; margin: 0; text-wrap: balance; }
  .lede { color: var(--ink-soft); max-width: 62ch; margin: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .chip { font-size: 12.5px; font-weight: 550; padding: 4px 11px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft); }
  .chip.teal { background: var(--primary); border-color: var(--primary); color: #fff; }

  .palette { display: flex; gap: 0; margin: 28px 0 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .palette div { flex: 1; height: 44px; position: relative; }
  .palette span { position: absolute; left: 8px; bottom: 5px; font-size: 10.5px; font-weight: 600; letter-spacing: .04em; }

  section { margin-top: 52px; }
  section > h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-soft); font-weight: 650; margin: 0 0 18px; }
  .shots { display: flex; flex-direction: column; gap: 44px; }
  .shot .frame { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
  .shot img { display: block; width: 100%; height: auto; }
  figure { margin: 0; }
  figcaption { padding: 14px 4px 0; }
  figcaption h3 { margin: 0 0 4px; font-size: 16.5px; letter-spacing: -0.01em; }
  figcaption p { margin: 0; color: var(--ink-soft); font-size: 14px; max-width: 70ch; }

  .mobile-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 24px; }
  .mobile-row .frame { border-radius: 18px; }

  .note { margin-top: 56px; padding: 18px 20px; background: var(--accent); color: var(--accent-deep); border-radius: 12px; font-size: 14px; }
  .note strong { font-weight: 650; }
  .note code { font-family: ui-monospace, monospace; font-size: 13px; background: rgb(127 127 127 / .16); padding: 1px 6px; border-radius: 5px; }
</style>
<div class="wrap">
  <header class="intro">
    <div class="brandline">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#176B5B"/><path d="M9 20.5 16 9l7 11.5" stroke="#E8DDC8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="22.5" r="1.8" fill="#E8DDC8"/></svg>
      <span>TripSplit</span>
    </div>
    <h1>The light travel theme \u2014 now with icons, motion, and toasts</h1>
    <p class="lede">Live screenshots from the running app with the seeded “Goa Weekend Trip”. New in this round: transparent travel-themed backdrops (dashed route, receipt, compass), entrance and press animations, lucide icons on every action button, and toast notifications for all create/edit/delete operations.</p>
    <div class="chips">
      <span class="chip teal">Deep teal #176B5B</span>
      <span class="chip">Warm off-white ground</span>
      <span class="chip">Muted sand accent</span>
      <span class="chip">Tabular numerals for money</span>
      <span class="chip">Icons · toasts · motion</span>
    </div>
    <div class="palette" aria-hidden="true">
      <div style="background:#176B5B"><span style="color:#E8DDC8">176B5B</span></div>
      <div style="background:#F7F8F6"><span style="color:#66716B">F7F8F6</span></div>
      <div style="background:#E8DDC8"><span style="color:#6d5f41">E8DDC8</span></div>
      <div style="background:#237A52"><span style="color:#eaf2ec">237A52</span></div>
      <div style="background:#B5473C"><span style="color:#f7e5e2">B5473C</span></div>
      <div style="background:#202923"><span style="color:#c9d1cb">202923</span></div>
    </div>
  </header>

  <section>
    <h2>Desktop</h2>
    <div class="shots">${desktopShots.map((s) => card(s)).join("")}</div>
  </section>

  <section>
    <h2>Mobile (390px, installable PWA)</h2>
    <div class="mobile-row">${mobileShots.map((s) => card(s)).join("")}</div>
  </section>

  <div class="note">
    <strong>Run it yourself:</strong> <code>npm run dev</code> → http://localhost:3000 → sign in as <code>ajit@example.com</code> / <code>password123</code> (admin) or <code>rahul@example.com</code>. The screenshots above were taken from the production build (<code>npm run build &amp;&amp; npm start</code>).
  </div>
</div>`;

writeFileSync(new URL("./tripsplit-preview.html", import.meta.url), html);
console.log("written", html.length);
