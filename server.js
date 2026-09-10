/**
 * Self-hosted UPI Payment Verification Gateway
 * Node.js + Express, JSON-file storage, vanilla frontend in /public
 *
 * Run:  node server.js      (PORT env optional, default 3000)
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "database.json");

/* ---------------------------------- DB ---------------------------------- */

const DEFAULT_DB = {
  settings: {
    target_package: "",
    secret_token: "",
    template: "You have received Rs.{amount} from {name}. UPI Ref no {txid}",
    upi_vpa: "",
  },
  installed_apps: [],
  orders: [],
};

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DB,
      ...parsed,
      settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
      installed_apps: parsed.installed_apps || [],
      orders: parsed.orders || [],
    };
  } catch {
    writeDB(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/* ------------------------------ Template ------------------------------- */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Turns a human template like:
 *   "Received Rs.{amount} from {name}. Ref {txid}"
 * into a regex with named capture groups.
 */
function templateToRegex(template) {
  const tokens = { amount: "[\\d,]+(?:\\.\\d{1,2})?", name: ".+?", txid: "[A-Za-z0-9]+" };
  const seen = new Set();
  let source = "";
  const re = /\{(amount|name|txid)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(template)) !== null) {
    source += escapeRegex(template.slice(last, m.index)).replace(/\\?\s+/g, "\\s+");
    const key = m[1];
    if (seen.has(key)) {
      source += `\\k<${key}>`;
    } else {
      seen.add(key);
      source += `(?<${key}>${tokens[key]})`;
    }
    last = m.index + m[0].length;
  }
  source += escapeRegex(template.slice(last)).replace(/\\?\s+/g, "\\s+");
  return new RegExp(source, "i");
}

function extractFields(template, text) {
  const regex = templateToRegex(template);
  const match = regex.exec(String(text || ""));
  if (!match || !match.groups) return { matched: false, regex: regex.source, fields: null };
  const fields = {};
  for (const [k, v] of Object.entries(match.groups)) fields[k] = v == null ? null : v.trim();
  if (fields.amount) fields.amount = fields.amount.replace(/,/g, "");
  return { matched: true, regex: regex.source, fields };
}

/* ------------------------------ Middleware ------------------------------ */

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function requireSecret(req, res, next) {
  const db = readDB();
  const expected = db.settings.secret_token;
  const provided = req.header("x-gateway-secret");
  if (!expected) return res.status(503).json({ error: "Secret token not configured" });
  if (!provided || provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  req.db = db;
  next();
}

/* --------------------------- Admin: settings ---------------------------- */

app.get("/api/admin/settings", (req, res) => {
  res.json(readDB().settings);
});

app.post("/api/admin/settings", (req, res) => {
  const db = readDB();
  const { target_package, secret_token, template, upi_vpa } = req.body || {};
  if (typeof target_package === "string") db.settings.target_package = target_package.trim();
  if (typeof secret_token === "string") db.settings.secret_token = secret_token.trim();
  if (typeof template === "string") db.settings.template = template;
  if (typeof upi_vpa === "string") db.settings.upi_vpa = upi_vpa.trim();
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

/* --------------------------- Admin: app sync ---------------------------- */

app.post("/api/admin/sync-apps", requireSecret, (req, res) => {
  const apps = (req.body && req.body.apps) || null;
  if (!Array.isArray(apps)) return res.status(400).json({ error: "apps must be an array" });
  const clean = apps
    .filter((a) => a && typeof a.package === "string" && a.package.trim())
    .map((a) => ({ name: String(a.name || a.package).trim(), package: a.package.trim() }));
  const db = req.db;
  db.installed_apps = clean;
  writeDB(db);
  res.json({ success: true, count: clean.length });
});

app.get("/api/admin/installed-apps", (req, res) => {
  res.json({ apps: readDB().installed_apps });
});

/* ------------------------ Admin: template sandbox ----------------------- */

app.post("/api/admin/test-template", (req, res) => {
  const { template, sample_text } = req.body || {};
  if (typeof template !== "string" || !template.trim())
    return res.status(400).json({ error: "template is required" });
  try {
    res.json(extractFields(template, sample_text));
  } catch (err) {
    res.status(400).json({ error: "Invalid template: " + err.message });
  }
});

/* ------------------------------- Checkout ------------------------------- */

app.post("/api/checkout", (req, res) => {
  const { name, email, amount } = req.body || {};
  const amt = Number(amount);
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required" });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email)))
    return res.status(400).json({ error: "Valid email is required" });
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

  const db = readDB();
  if (!db.settings.upi_vpa) return res.status(503).json({ error: "Gateway UPI VPA not configured" });

  const order_id = "ORD" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
  const fixedAmount = amt.toFixed(2);

  const order = {
    order_id,
    name: String(name).trim(),
    email: String(email).trim(),
    amount: Number(fixedAmount),
    status: "PENDING",
    created_at: new Date().toISOString(),
    paid_at: null,
    txid: null,
  };
  db.orders.push(order);
  writeDB(db);

  const upi_url =
    `upi://pay?pa=${encodeURIComponent(db.settings.upi_vpa)}` +
    `&pn=${encodeURIComponent("Payment Gateway")}` +
    `&am=${encodeURIComponent(fixedAmount)}` +
    `&cu=INR&tn=${encodeURIComponent(order_id)}`;

  const qr_url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upi_url)}`;

  res.json({ success: true, order_id, amount: order.amount, upi_url, qr_url });
});

/* -------------------------------- Relay --------------------------------- */

app.post("/api/relay", requireSecret, (req, res) => {
  const db = req.db;
  const { packageName, title, text, postTime } = req.body || {};

  if (!db.settings.target_package || packageName !== db.settings.target_package)
    return res.status(400).json({ error: "Package mismatch", ignored: true });

  const body = [title, text].filter(Boolean).join(" ");
  let parsed;
  try {
    parsed = extractFields(db.settings.template, body);
  } catch (err) {
    return res.status(400).json({ error: "Invalid template: " + err.message });
  }
  if (!parsed.matched) return res.status(422).json({ error: "Notification did not match template" });

  const amount = Number(parsed.fields.amount);
  if (!Number.isFinite(amount)) return res.status(422).json({ error: "Amount not parsed" });

  const candidates = db.orders
    .filter((o) => o.status === "PENDING" && Number(o.amount) === amount)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!candidates.length) return res.status(404).json({ error: "No matching pending order", amount });

  const order = candidates[0];
  order.status = "PAID";
  order.txid = parsed.fields.txid || null;
  order.payer_name = parsed.fields.name || null;
  order.paid_at = new Date(postTime || Date.now()).toISOString();
  writeDB(db);

  res.json({ success: true, order_id: order.order_id, status: "PAID", txid: order.txid });
});

/* -------------------------------- Status -------------------------------- */

app.get("/api/status/:order_id", (req, res) => {
  const order = readDB().orders.find((o) => o.order_id === req.params.order_id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({
    order_id: order.order_id,
    status: order.status,
    amount: order.amount,
    txid: order.txid,
    paid_at: order.paid_at,
  });
});

if (process.env.UPI_GATEWAY_EMBEDDED !== "1") {
  app.listen(PORT, () => console.log(`UPI gateway running on http://localhost:${PORT}`));
}

export { app, templateToRegex, extractFields };
export default app;
