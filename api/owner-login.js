module.exports = async function ownerLogin(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String((req.body || {}).email || "").trim();
  const password = String((req.body || {}).password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return res.status(503).json({ error: "Owner portal is not configured yet." });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    const session = await response.json();
    if (!session.access_token) {
      return res.status(502).json({ error: "Unable to sign in." });
    }

    return res.status(200).json({ access_token: session.access_token });
  } catch (error) {
    console.error("Owner login failed", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "Unable to reach the owner login service." });
  }
};
