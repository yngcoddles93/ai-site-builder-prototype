const MAX_SITE_DATA_BYTES = 500_000;

function cleanSiteDataForStorage(data) {
  const safeCopy = JSON.parse(JSON.stringify(data));

  if (
    safeCopy.heroImageUrl &&
    safeCopy.heroImageUrl.startsWith("data:image")
  ) {
    safeCopy.heroImageUrl = "";
  }

  if (safeCopy.logoUrl && safeCopy.logoUrl.startsWith("data:image")) {
    safeCopy.logoUrl = "";
  }

  return safeCopy;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, siteData } = req.body;

    if (!siteData || typeof siteData !== "object") {
      return res.status(400).json({ error: "Missing siteData" });
    }

    const cleanedSiteData = cleanSiteDataForStorage(siteData);
    const payloadSize = JSON.stringify(cleanedSiteData).length;

    if (payloadSize > MAX_SITE_DATA_BYTES) {
      return res.status(400).json({
        error: "Site data is too large to publish"
      });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/published_sites`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          title:
            title ||
            cleanedSiteData.heroTitle ||
            "Untitled Website",
          site_data: cleanedSiteData
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to publish site",
        details: data
      });
    }

    const published = data[0];

    return res.status(200).json({
      success: true,
      id: published.id,
      url: `/site.html?id=${published.id}`
    });
  } catch (error) {
    console.error("Publish site error:", error);
    return res.status(500).json({
      error: "Server error publishing site",
      details: error.message
    });
  }
}
