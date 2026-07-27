const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^[+()\d.]{10,28}$/;
const MIN_PHONE_DIGITS = 10;
const ALLOWED_ORIGINS = new Set([
  "https://oomavera.github.io",
  "https://oomavera.github.io/sundaysessions",
  "https://stripe-murex-nine.vercel.app"
]);

module.exports = async function subscribe(req, res) {
  const origin = req.headers.origin;

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin");

  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, phone, website } = req.body || {};

  // Bots commonly fill hidden fields. Return a neutral response without writing.
  if (typeof website === "string" && website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").trim().replace(/[\s-]+/g, "");
  const phoneDigitCount = (normalizedPhone.match(/\d/g) || []).length;

  if (
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail) ||
    !PHONE_PATTERN.test(normalizedPhone) ||
    phoneDigitCount < MIN_PHONE_DIGITS
  ) {
    return res.status(400).json({ error: "Please enter a valid email and phone number" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Signup is temporarily unavailable" });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/subscribers`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        email: normalizedEmail,
        phone: normalizedPhone
      })
    });

    if (!response.ok) {
      console.error("Supabase insert failed", response.status);
      return res.status(500).json({ error: "Unable to save your details" });
    }

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Subscription request failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "Unable to save your details" });
  }
};
