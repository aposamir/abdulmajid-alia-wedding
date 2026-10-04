// RSVP fan-out: receives one confirmation and sends it to all hosts at once
// via WhatsApp Cloud API. No dependencies (Node 18+).
//
// Env: WA_TOKEN, WA_PHONE_ID (required); ALLOWED_ORIGIN, PORT, WA_TEMPLATE (optional)
const http = require("http");

const RECIPIENTS = [
  "963949954998",
  "4917683247825",
  "971544000556",
  "4917670604017",
  "963951970692",
];
const { WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE } = process.env;
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://aposamir.github.io";

function payload(to, text, name, guests) {
  if (WA_TEMPLATE) {
    // Template with 2 body params: {{1}} name, {{2}} guests (works outside the 24h window)
    return { messaging_product: "whatsapp", to, type: "template",
      template: { name: WA_TEMPLATE, language: { code: "ar" },
        components: [{ type: "body", parameters: [
          { type: "text", text: name }, { type: "text", text: String(guests) }] }] } };
  }
  return { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
}

async function sendAll(name, guests) {
  const text = `🌹 تأكيد حضور\nالاسم: ${name}\nعدد الحضور: ${guests}\nحفل زفاف عبد المجيد وعليا — 12/11/2026`;
  return Promise.all(RECIPIENTS.map(async (to) => {
    try {
      const r = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload(to, text, name, guests)),
      });
      return { to, ok: r.ok };
    } catch { return { to, ok: false }; }
  }));
}

http.createServer(async (req, res) => {
  const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "Content-Type" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method !== "POST" || req.url !== "/rsvp") { res.writeHead(404, cors); return res.end(); }
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 2000) req.destroy(); });
  req.on("end", async () => {
    try {
      const { name, guests } = JSON.parse(body);
      const n = String(name || "").trim().slice(0, 60);
      const g = Math.min(20, Math.max(1, parseInt(guests, 10) || 1));
      if (!n) throw new Error("name");
      const results = await sendAll(n, g);
      const ok = results.some((r) => r.ok);
      res.writeHead(ok ? 200 : 502, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok, results }));
    } catch {
      res.writeHead(400, cors); res.end();
    }
  });
}).listen(process.env.PORT || 3000);
