// RSVP fan-out: receives one confirmation and sends it to all hosts at once
// via Twilio WhatsApp. No dependencies (Node 18+).
//
// Env: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM (e.g. +14155238886) required;
// TWILIO_CONTENT_SID, ALLOWED_ORIGIN, PORT optional
const http = require("http");

const RECIPIENTS = [
  "963949954998",
  "4917683247825",
  "971544000556",
  "4917670604017",
  "963951970692",
];
const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_CONTENT_SID } = process.env;
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://aposamir.github.io";
const AUTH = "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

async function sendAll(name, guests) {
  const text = `🌹 تأكيد حضور\nالاسم: ${name}\nعدد الحضور: ${guests}\nحفل زفاف عبد المجيد وعليا — 12/11/2026`;
  return Promise.all(RECIPIENTS.map(async (to) => {
    const form = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:+${to}` });
    if (TWILIO_CONTENT_SID) { // approved template with variables {{1}} name, {{2}} guests
      form.set("ContentSid", TWILIO_CONTENT_SID);
      form.set("ContentVariables", JSON.stringify({ 1: name, 2: String(guests) }));
    } else form.set("Body", text);
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST", headers: { Authorization: AUTH }, body: form,
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
