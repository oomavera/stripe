module.exports = async function ownerRecover(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String((req.body || {}).email || "").trim();

  if (!email) {
    return res.status(400).json({ error: "Enter your owner email first." });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return res.status(503).json({ error: "Owner portal is not configured yet." });
  }

  const redirectTo = "https://stripe-murex-nine.vercel.app/set-password.html";

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, gotrue_meta_security: {}, redirect_to: redirectTo })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Could not send the password email." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Owner recover failed", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "Unable to reach the owner login service." });
  }
};
