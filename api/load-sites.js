import { requireAuth } from "../lib/api-auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let userId;
  try {
    ({ userId } = await requireAuth(req));
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/websites?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase load failed",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      websites: data
    });
  } catch (error) {
    console.error("Load sites error:", error);
    return res.status(500).json({
      error: "Server error loading sites",
      details: error.message
    });
  }
}
