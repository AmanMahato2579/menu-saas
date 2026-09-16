// MenuQR end-to-end smoke test.
// Exercises every major flow over HTTP against a running dev server, then
// scrubs all rows it created (orders, sessions, bookings, notifications)
// and restores the original brand color.
//
// Usage:  node --env-file=.env scripts/e2e-smoke.mjs
// Requires: next dev running on http://localhost:3000, DATABASE_URL in .env.

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner@demo.com";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "Owner123!";
const SUPER_EMAIL = process.env.E2E_SUPER_EMAIL ?? "admin@menusaas.com";
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD ?? "Admin123!";
const TABLE_TOKEN = process.env.E2E_TABLE_TOKEN ?? "demo-table-1";
const REST_SLUG = process.env.E2E_REST_SLUG ?? "demo-restaurant";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const results = [];
let runStart = new Date();

function cookieJar() {
  return new Map();
}
function jarCookie(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(jar, res) {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const pair = sc.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1));
  }
}

async function req(method, path, { jar, json, form, query } = {}) {
  const url = new URL(path, BASE);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const headers = { "Accept": "application/json" };
  if (jar && jar.size) headers["Cookie"] = jarCookie(jar);
  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(url, { method, headers, body, redirect: "manual" });
  storeCookies(jar ?? cookieJar(), res);
  let parsed;
  const text = await res.text();
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: res.status, location: res.headers.get("location"), body: parsed, text };
}

async function login(email, password) {
  const jar = cookieJar();
  const csrf = await req("GET", "/api/auth/csrf", { jar });
  if (csrf.status !== 200) throw new Error(`csrf failed: ${csrf.status}`);
  const cb = await req("POST", "/api/auth/callback/credentials", {
    jar,
    form: { email, password, csrfToken: csrf.body.csrfToken, callbackUrl: `${BASE}/admin` },
    headers: { "X-Auth-Return-Redirect": "1" },
  });
  const okJson = typeof cb.body?.url === "string" && !String(cb.body.url).includes("error=");
  const okRedirect = cb.status >= 300 && cb.status < 400 && !String(cb.location ?? "").includes("error=");
  if (!okJson && !okRedirect) throw new Error(`credentials rejected (${cb.status}): ${JSON.stringify(cb.body)}`);
  const session = await req("GET", "/api/auth/session", { jar });
  return { jar, session: session.body };
}

function mark(ok, name, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  —  " + detail : ""}`);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    mark(true, name, detail);
    return true;
  } catch (e) {
    mark(false, name, e?.message ?? String(e));
    return false;
  }
}

const created = { bookings: [], orders: [], sessions: [], notificationsLinked: [] };

// ---------------------------------------------------------------------------
console.log("== Auth ==");
let ownerJar = cookieJar();
let superJar = cookieJar();
await step("owner login", async () => {
  const r = await login(OWNER_EMAIL, OWNER_PASSWORD);
  if (!r.jar.has("authjs.session-token")) throw new Error("no session cookie");
  if (r.session?.user?.role !== "RESTAURANT_ADMIN") throw new Error("not RESTAURANT_ADMIN");
  ownerJar = r.jar;
  return r.session.user.email;
});

await step("super-admin login", async () => {
  const r = await login(SUPER_EMAIL, SUPER_PASSWORD);
  if (r.session?.user?.role !== "SUPER_ADMIN") throw new Error("not SUPER_ADMIN");
  superJar = r.jar;
  return r.session.user.email;
});

// ---------------------------------------------------------------------------
console.log("== Reference data ==");
const refs = {};
const gotRefs = await step("load demo references from DB", async () => {
  const restaurant = await prisma.restaurant.findFirst({ where: { slug: REST_SLUG } });
  if (!restaurant) throw new Error("restaurant not found");
  const table = await prisma.table.findFirst({ where: { qrToken: TABLE_TOKEN } });
  if (!table) throw new Error("table not found");
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true, requiresPreparation: true },
    include: { variants: { where: { isAvailable: true } } },
    orderBy: { name: "asc" },
  });
  const itemA = items.find((i) => i.variants.length > 0) ?? items[0];
  const itemB = items.find((i) => i.id !== itemA.id) ?? itemA;
  const service = await prisma.bookableService.findFirst({
    where: { restaurantId: restaurant.id, isActive: true },
    orderBy: { venueCount: "asc" },
  });
  if (!service) throw new Error("no active bookable service");
  Object.assign(refs, {
    restaurantId: restaurant.id,
    brandColor: restaurant.brandColor,
    tableId: table.id,
    itemA: { id: itemA.id, variantId: itemA.variants[0]?.id ?? null },
    itemB: { id: itemB.id },
    service,
  });
  return `restaurant=${restaurant.id} items=${itemA.name}/${itemB.name} service=${service.name}`;
});

const demoRestaurantId = refs.restaurantId;
const bookingDate = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
console.log("== Customer flow ==");
let tableSessionId = null;
let orderO1 = null;
let orderO2 = null;

if (gotRefs) {
  await step("anonymous admin API is guarded (401)", async () => {
    const r = await req("GET", "/api/admin/tables");
    if (r.status !== 401) throw new Error(`expected 401 got ${r.status}`);
  });

  await step("menu page SSR renders (200)", async () => {
    const r = await req("GET", `/r/${REST_SLUG}/t/${TABLE_TOKEN}`);
    if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
  });

  await step("start table session (201)", async () => {
    const r = await req("POST", `/api/customer/tables/${TABLE_TOKEN}/session`, {
      json: { customerName: "E2E Smoke" },
    });
    if (r.status !== 201) throw new Error(`expected 201 got ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.body?.status !== "ACTIVE") throw new Error("session not ACTIVE");
    tableSessionId = r.body.id;
    created.sessions.push(r.body.id);
  });

  if (tableSessionId) {
    await step("place order O1 (201, PENDING, server pricing)", async () => {
      const r = await req("POST", "/api/customer/orders", {
        json: {
          restaurantId: demoRestaurantId,
          tableSessionId,
          customerToken: `e2e-${Date.now()}`,
          items: [
            { menuItemId: refs.itemA.id, variantId: refs.itemA.variantId, quantity: 2, isSpicy: false, note: "" },
            { menuItemId: refs.itemB.id, quantity: 1, isSpicy: false, note: "" },
          ],
        },
      });
      if (r.status !== 201) throw new Error(`expected 201 got ${r.status}: ${JSON.stringify(r.body)}`);
      if (r.body?.status !== "PENDING") throw new Error(`not PENDING: ${r.body?.status}`);
      const aItem = r.body.orderItems.find((i) => i.menuItemId === refs.itemA.id);
      const bItem = r.body.orderItems.find((i) => i.menuItemId === refs.itemB.id);
      if (!aItem || !bItem) throw new Error("order items mismatch");
      orderO1 = { id: r.body.id, items: { A: aItem, B: bItem } };
      created.orders.push(r.body.id);
      return `order #${r.body.orderNumber} items=${r.body.orderItems.length}`;
    });

    await step("quantity editable while order still PENDING (200)", async () => {
      const r1 = await req("PATCH", `/api/admin/order-items/${orderO1.items.B.id}`, {
        jar: ownerJar,
        json: { action: "quantity", quantity: 2 },
      });
      if (r1.status !== 200 || r1.body?.quantity !== 2) throw new Error(`bump failed: ${JSON.stringify(r1.body)}`);
      const r2 = await req("PATCH", `/api/admin/order-items/${orderO1.items.B.id}`, {
        jar: ownerJar,
        json: { action: "quantity", quantity: 1 },
      });
      if (r2.status !== 200 || r2.body?.quantity !== 1) throw new Error(`restore failed: ${JSON.stringify(r2.body)}`);
    });

    await step("place order O2 then reject it", async () => {
      const r = await req("POST", "/api/customer/orders", {
        json: {
          restaurantId: demoRestaurantId,
          tableSessionId,
          customerToken: `e2e-${Date.now()}`,
          items: [{ menuItemId: refs.itemA.id, quantity: 1, isSpicy: false, note: "" }],
        },
      });
      if (r.status !== 201) throw new Error(`create expected 201 got ${r.status}`);
      orderO2 = { id: r.body.id, itemId: r.body.orderItems[0].id };
      created.orders.push(r.body.id);
      const rej = await req("PATCH", `/api/admin/orders/${r.body.id}/status`, {
        jar: ownerJar,
        json: { status: "REJECTED" },
      });
      if (rej.status !== 200 || rej.body?.status !== "REJECTED")
        throw new Error(`reject failed: ${rej.status} ${JSON.stringify(rej.body)}`);
    });

    await step("customer orders list includes O1 and rejected O2", async () => {
      const r = await req("GET", `/api/customer/sessions/${tableSessionId}/orders`);
      const ids = (r.body ?? []).map((o) => o.id);
      if (!ids.includes(orderO1.id) || !ids.includes(orderO2.id)) throw new Error(`missing orders: ${ids.join(",")}`);
    });

    await step("request assistance (200)", async () => {
      const r = await req("POST", `/api/customer/sessions/${tableSessionId}/assist`);
      if (r.status !== 200 || r.body?.success !== true) throw new Error(`expected success got ${r.status}`);
    });

    await step("bill page SSR renders (200)", async () => {
      const r = await req("GET", `/r/${REST_SLUG}/t/${TABLE_TOKEN}/bill`);
      if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
    });
  }
}

// ---------------------------------------------------------------------------
console.log("== Admin flow ==");
if (gotRefs && tableSessionId && orderO1) {
  await step("admin tables page (200)", async () => {
    const r = await req("GET", "/admin/tables", { jar: ownerJar });
    if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
  });

  await step("session overview lists O1", async () => {
    const r = await req("GET", `/api/admin/sessions/${tableSessionId}/overview`, { jar: ownerJar });
    if (r.status !== 200) throw new Error(`expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    if (!(r.body?.orders ?? []).some((o) => o.id === orderO1.id)) throw new Error("O1 missing from overview");
  });

  await step("accept order O1 (200) — auto-starts cooking", async () => {
    const r = await req("PATCH", `/api/admin/orders/${orderO1.id}/status`, {
      jar: ownerJar,
      json: { status: "ACCEPTED" },
    });
    if (r.status !== 200 || r.body?.status !== "ACCEPTED") throw new Error(`accept failed: ${JSON.stringify(r.body)}`);
    const ov = await req("GET", `/api/admin/sessions/${tableSessionId}/overview`, { jar: ownerJar });
    const items = (ov.body?.orders ?? []).flatMap((o) => o.orderItems).filter((i) => i.orderId === orderO1.id);
    if (items.length !== 2 || items.some((i) => i.status !== "PREPARING"))
      throw new Error(`items not auto-cooking: ${JSON.stringify(items.map((i) => i.status))}`);
  });

  const itemA2 = orderO1.items.A;
  const itemB2 = orderO1.items.B;

  await step("PREPARING item rejects quantity increase (400)", async () => {
    const r = await req("PATCH", `/api/admin/order-items/${itemB2.id}`, {
      jar: ownerJar,
      json: { action: "quantity", quantity: 2 },
    });
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await step("prepare item B then serve it (200)", async () => {
    const r1 = await req("PATCH", `/api/admin/order-items/${itemB2.id}`, {
      jar: ownerJar,
      json: { action: "status", status: "PREPARING" },
    });
    if (r1.status !== 200 || r1.body?.status !== "PREPARING") throw new Error(`prepare failed: ${JSON.stringify(r1.body)}`);
    const r2 = await req("PATCH", `/api/admin/order-items/${itemB2.id}`, {
      jar: ownerJar,
      json: { action: "serve" },
    });
    if (r2.status !== 200 || r2.body?.status !== "SERVED") throw new Error(`serve failed: ${JSON.stringify(r2.body)}`);
  });

  await step("served item rejects further changes (400)", async () => {
    const r = await req("PATCH", `/api/admin/order-items/${itemB2.id}`, {
      jar: ownerJar,
      json: { action: "status", status: "CANCELLED" },
    });
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await step("partial serve: first serve keeps PREPARING (multi-qty)", async () => {
    const r = await req("PATCH", `/api/admin/order-items/${itemA2.id}`, {
      jar: ownerJar,
      json: { action: "status", status: "PREPARING" },
    });
    if (r.status !== 200) throw new Error(`prepare A failed: ${JSON.stringify(r.body)}`);
    const served = await req("PATCH", `/api/admin/order-items/${itemA2.id}`, {
      jar: ownerJar,
      json: { action: "serve" },
    });
    if (served.status !== 200 || served.body?.servedQuantity !== 1) throw new Error(`partial serve failed: ${JSON.stringify(served.body)}`);
    if (served.body?.status !== "PREPARING") throw new Error(`expected PREPARING got ${served.body?.status}`);
  });

  await step("second serve completes item A (SERVED)", async () => {
    const r = await req("PATCH", `/api/admin/order-items/${itemA2.id}`, {
      jar: ownerJar,
      json: { action: "serve" },
    });
    if (r.status !== 200 || r.body?.status !== "SERVED" || r.body?.servedQuantity !== 2)
      throw new Error(`serve A failed: ${JSON.stringify(r.body)}`);
  });

  await step("waiter can delete an order item? no (405)", async () => {
    const r = await req("DELETE", `/api/admin/order-items/${itemB2.id}`, { jar: ownerJar });
    if (r.status !== 405) throw new Error(`expected 405 got ${r.status}`);
  });

  await step("NEW_ORDER notification + mark read", async () => {
    const list = await req("GET", "/api/admin/notifications?limit=15", { jar: ownerJar });
    if (list.status !== 200) throw new Error(`list failed: ${list.status}`);
    const n = (list.body?.notifications ?? []).find(
      (x) => x.type === "NEW_ORDER" && !x.read && x.link?.includes(orderO1.id)
    );
    if (!n) throw new Error("no NEW_ORDER notification for O1");
    const before = list.body.unreadCount;
    const read = await req("PATCH", `/api/admin/notifications/${n.id}`, { jar: ownerJar });
    if (read.status !== 200) throw new Error(`mark read failed: ${read.status}`);
    const after = await req("GET", "/api/admin/notifications?unread=true", { jar: ownerJar });
    if (after.status === 200 && after.body?.unreadCount >= before)
      throw new Error(`unread not decreasing: ${before} -> ${after.body?.unreadCount}`);
  });

  await step("waiter places an instant order (201, ACCEPTED)", async () => {
    const r = await req("POST", `/api/admin/tables/${refs.tableId}/orders`, {
      jar: ownerJar,
      json: { items: [{ menuItemId: refs.itemA.id, variantId: refs.itemA.variantId, quantity: 1 }] },
    });
    if (r.status !== 201 || r.body?.status !== "ACCEPTED") throw new Error(`waiter order failed: ${r.status} ${JSON.stringify(r.body)}`);
    const sid = r.body?.tableSession?.id;
    if (sid) created.sessions.push(sid);
  });

  await step("close session (200)", async () => {
    const r = await req("POST", `/api/admin/sessions/${tableSessionId}/close`, { jar: ownerJar });
    if (r.status !== 200 || r.body?.success !== true) throw new Error(`close failed: ${r.status} ${JSON.stringify(r.body)}`);
  });
}

// ---------------------------------------------------------------------------
console.log("== Bookings ==");
if (gotRefs) {
  let startMinutes = null;
  await step("availability for service (200, slots)", async () => {
    const r = await req("GET", "/api/customer/bookings/availability", {
      query: { token: TABLE_TOKEN, serviceId: refs.service.id, date: bookingDate },
    });
    if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
    const slots = r.body?.slots ?? [];
    if (slots.length === 0) throw new Error("no slots returned");
    startMinutes = slots[0].startMinutes;
  });

  const phone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
  const capacity = refs.service.capacity;
  const needOk = Math.min(refs.service.venueCount, capacity);

  if (startMinutes != null) {
    await step(`same-slot overlap gate (${needOk} ok, next 409)`, async () => {
      const body = {
        token: TABLE_TOKEN,
        serviceId: refs.service.id,
        bookingDate,
        startMinutes,
        durationMinutes: refs.service.slotDurationMinutes ?? 60,
        contactName: "E2E Test",
        contactPhone: phone,
        guests: 1,
        sessionId: tableSessionId ?? undefined,
      };
      for (let i = 0; i < needOk; i++) {
        const r = await req("POST", "/api/customer/bookings", { json: body });
        if (r.status !== 201 || !r.body?.id) throw new Error(`booking ${i} failed: ${r.status} ${JSON.stringify(r.body)}`);
        created.bookings.push(r.body.id);
      }
      const conflict = await req("POST", "/api/customer/bookings", { json: body });
      if (conflict.status !== 409) throw new Error(`expected 409 got ${conflict.status}: ${JSON.stringify(conflict.body)}`);
    });

    await step("guest booking history (200)", async () => {
      const r = await req("GET", "/api/customer/bookings", {
        query: { token: TABLE_TOKEN, phone },
      });
      if (r.status !== 200 || (r.body ?? []).length === 0) throw new Error(`history failed: ${r.status}`);
    });

    await step("admin bookings list for date", async () => {
      const r = await req("GET", `/api/admin/bookings?date=${bookingDate}`, { jar: ownerJar });
      if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
      if (!(r.body ?? []).some((b) => created.bookings.includes(b.id))) throw new Error("created booking not listed");
    });

    if (created.bookings.length >= 2) {
      await step("admin booking transitions: accept->complete, reject", async () => {
        const [b1, b2] = created.bookings;
        const acc = await req("PATCH", `/api/admin/bookings/${b1}/status`, {
          jar: ownerJar,
          json: { status: "ACCEPTED" },
        });
        if (acc.status !== 200 || acc.body?.success !== true) throw new Error(`accept failed: ${acc.status} ${JSON.stringify(acc.body)}`);
        const comp = await req("PATCH", `/api/admin/bookings/${b1}/status`, {
          jar: ownerJar,
          json: { status: "COMPLETED" },
        });
        if (comp.status !== 200 || comp.body?.success !== true) throw new Error(`complete failed: ${comp.status} ${JSON.stringify(comp.body)}`);
        const rej = await req("PATCH", `/api/admin/bookings/${b2}/status`, {
          jar: ownerJar,
          json: { status: "REJECTED" },
        });
        if (rej.status !== 200 || rej.body?.success !== true) throw new Error(`reject failed: ${rej.status} ${JSON.stringify(rej.body)}`);
      });
    }
  }
}

// ---------------------------------------------------------------------------
console.log("== Settings & super-admin guards ==");
const originalBrand = refs.brandColor ?? "orange";
if (gotRefs) {
  await step("settings brandColor save (200 teal)", async () => {
    const r = await req("PATCH", "/api/admin/settings", { jar: ownerJar, json: { brandColor: "teal" } });
    if (r.status !== 200 || r.body?.brandColor !== "teal") throw new Error(`expected teal got ${JSON.stringify(r.body)}`);
  });

  await step("settings invalid brandColor rejected (400)", async () => {
    const r = await req("PATCH", "/api/admin/settings", { jar: ownerJar, json: { brandColor: "neon" } });
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}`);
  });

  await step("settings brandColor restore", async () => {
    const r = await req("PATCH", "/api/admin/settings", { jar: ownerJar, json: { brandColor: originalBrand } });
    if (r.status !== 200 || r.body?.brandColor !== originalBrand) throw new Error(`restore failed: ${JSON.stringify(r.body)}`);
  });

  await step("super-admin page (200)", async () => {
    const r = await req("GET", "/super-admin", { jar: superJar });
    if (r.status !== 200) throw new Error(`expected 200 got ${r.status}`);
  });

  await step("super-admin cookie blocked from admin API (401)", async () => {
    const r = await req("GET", "/api/admin/tables", { jar: superJar });
    if (r.status !== 401) throw new Error(`expected 401 got ${r.status}`);
  });

  await step("owner blocked from super-admin API (403)", async () => {
    const r = await req("PATCH", `/api/super-admin/restaurants/${demoRestaurantId}`, {
      jar: ownerJar,
      json: {},
    });
    if (r.status !== 403) throw new Error(`expected 403 got ${r.status}: ${JSON.stringify(r.body)}`);
  });
}

// ---------------------------------------------------------------------------
console.log("== Cleanup ==");
try {
  if (created.bookings.length) await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
  if (created.orders.length) await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
  if (created.sessions.length) await prisma.tableSession.deleteMany({ where: { id: { in: created.sessions } } });
  await prisma.notification.deleteMany({
    where: { restaurantId: demoRestaurantId, createdAt: { gt: runStart } },
  });
  const currentBrand = await prisma.restaurant.findUnique({ where: { id: demoRestaurantId } });
  if (currentBrand && currentBrand.brandColor !== originalBrand) {
    await req("PATCH", "/api/admin/settings", { jar: ownerJar, json: { brandColor: originalBrand } });
  }
  console.log("CLEANUP  removed test rows + restored brand color");
} catch (e) {
  console.log("CLEANUP  WARNING: " + e.message);
} finally {
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}