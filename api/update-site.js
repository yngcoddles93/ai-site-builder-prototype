import { requireAuth } from "../lib/api-auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let userId;
  try {
    ({ userId } = await requireAuth(req));
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  try {
    const { id, title, siteData } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing project id" });
    }

    if (!siteData) {
      return res.status(400).json({ error: "Missing siteData" });
    }

    // Filter by both id and user_id — Supabase will return 0 rows if the
    // authenticated user does not own this project, which produces a 404 below.
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/websites?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          title: title || siteData.heroTitle || "Untitled Website",
          site_data: siteData,
          updated_at: new Date().toISOString()
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase update failed",
        details: data
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        error: "Project not found or you do not have permission to update it."
      });
    }

    return res.status(200).json({
      success: true,
      website: data[0]
    });
  } catch (error) {
    console.error("Update site error:", error);
    return res.status(500).json({
      error: "Server error updating site",
      details: error.message
    });
  }
}
