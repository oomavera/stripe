module.exports = async function subscribers(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const authorization = req.headers.authorization || "";

  if (!supabaseUrl || !publishableKey || !serviceKey || !adminEmail) {
    return res.status(503).json({ error: "Admin access is not configured" });
  }

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in required" });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: authorization
      }
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: "Your session has expired" });
    }

    const user = await userResponse.json();
    if (!user.email || user.email.toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: "Owner access only" });
    }

    const dataResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?select=id,email,phone,created_at&order=created_at.desc&limit=1000`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    if (!dataResponse.ok) {
      console.error("Supabase admin read failed", dataResponse.status);
      return res.status(500).json({ error: "Unable to load subscribers" });
    }

    return res.status(200).json({ subscribers: await dataResponse.json() });
  } catch (error) {
    console.error("Admin request failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "Unable to load subscribers" });
  }
};
