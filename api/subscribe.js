const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^[+()\d.]{10,28}$/;
const MIN_PHONE_DIGITS = 10;
const ALLOWED_ORIGINS = new Set([
  // Local file previews send the literal `null` origin.
  "null",
  "https://sundaysessions.us",
  "https://www.sundaysessions.us",
  "https://oomavera.github.io",
  "https://stripe-murex-nine.vercel.app"
]);

async function addSubscriberToKit({ apiKey, formId, email }) {
  const response = await fetch(
    `https://api.convertkit.com/v3/forms/${encodeURIComponent(formId)}/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ api_key: apiKey, email })
    }
  );

  if (!response.ok) {
    console.error("Kit form subscription failed", response.status);
    return false;
  }

  return true;
}

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

  const { email, phone, signupConfirmationCode } = req.body || {};

  // Keep the bot check non-semantic so browser/profile autofill does not mistake
  // it for real subscriber data. A blocked request must never look successful.
  if (
    typeof signupConfirmationCode === "string" &&
    signupConfirmationCode.length > 0
  ) {
    console.warn("Signup blocked by honeypot");
    return res
      .status(400)
      .json({ error: "Unable to complete signup. Please try again." });
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
  const kitApiKey = process.env.KIT_API_KEY;
  const kitFormId = process.env.KIT_FORM_ID;

  if (!supabaseUrl || !serviceKey || !kitApiKey || !kitFormId) {
    return res.status(503).json({ error: "Signup is temporarily unavailable" });
  }

  try {
    const kitAdded = await addSubscriberToKit({
      apiKey: kitApiKey,
      formId: kitFormId,
      email: normalizedEmail
    });

    if (!kitAdded) {
      return res.status(502).json({ error: "Unable to send the confirmation email" });
    }

    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?email=eq.${encodeURIComponent(normalizedEmail)}&select=id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    if (!existingResponse.ok) {
      console.error("Supabase duplicate check failed", existingResponse.status);
      return res.status(500).json({ error: "Unable to save your details" });
    }

    const existingSubscribers = await existingResponse.json();
    if (existingSubscribers.length > 0) {
      return res.status(200).json({
        ok: true,
        confirmationRequired: true,
        confirmationEmailExpected: false,
        alreadySaved: true
      });
    }

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

    return res.status(201).json({
      ok: true,
      confirmationRequired: true,
      confirmationEmailExpected: true,
      alreadySaved: false
    });
  } catch (error) {
    console.error("Subscription request failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "Unable to save your details" });
  }
};
