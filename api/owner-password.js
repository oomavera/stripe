module.exports = async function ownerPassword(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const accessToken = String((req.body || {}).access_token || "");
  const password = String((req.body || {}).password || "");

  if (!accessToken || password.length < 10) {
    return res.status(400).json({ error: "This invitation has expired." });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return res.status(503).json({ error: "Portal configuration is unavailable." });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return res.status(400).json({ error: result.msg || result.message || "This invitation has expired." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Owner password update failed", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "Could not save your password." });
  }
};
