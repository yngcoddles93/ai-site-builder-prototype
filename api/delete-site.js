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
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing project id" });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({
        error:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment."
      });
    }

    // Filter by both id and user_id — prevents a user from deleting another user's project.
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/websites?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          Prefer: "return=representation"
        }
      }
    );

    const rawText = await response.text();
    let data = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase delete failed",
        details: data
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        error: "Project not found or already deleted."
      });
    }

    return res.status(200).json({
      success: true,
      deletedId: id
    });
  } catch (error) {
    console.error("Delete site error:", error);
    return res.status(500).json({
      error: "Server error deleting site",
      details: error.message
    });
  }
}
