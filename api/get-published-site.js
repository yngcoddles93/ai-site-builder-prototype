const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = req.query.id;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing site id" });
    }

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Invalid site id" });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/published_sites?id=eq.${id}&select=id,title,site_data,created_at`,
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
        error: "Failed to load published site",
        details: data
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: "Site not found" });
    }

    const site = data[0];

    return res.status(200).json({
      success: true,
      id: site.id,
      title: site.title,
      siteData: site.site_data,
      createdAt: site.created_at
    });
  } catch (error) {
    console.error("Get published site error:", error);
    return res.status(500).json({
      error: "Server error loading published site",
      details: error.message
    });
  }
}
