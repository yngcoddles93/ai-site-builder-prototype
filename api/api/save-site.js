export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, siteData, userId } = req.body;

    if (!siteData) {
      return res.status(400).json({ error: "Missing siteData" });
    }

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/websites`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        user_id: userId || "demo-user",
        title: title || siteData.heroTitle || "Untitled Website",
        site_data: siteData
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase save failed",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      website: data[0]
    });
  } catch (error) {
    console.error("Save site error:", error);
    return res.status(500).json({
      error: "Server error saving site",
      details: error.message
    });
  }
}
