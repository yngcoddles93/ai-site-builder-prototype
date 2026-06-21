import { optionalAuth } from "../lib/api-auth.js";

const MAX_SITE_DATA_BYTES = 500_000;

const DEFAULT_HOME_SECTIONS = [
  { id: "hero", type: "hero", visible: true },
  { id: "services", type: "services", visible: true, title: "Services" },
  { id: "features", type: "features", visible: true, title: "Why Choose Us" },
  { id: "about", type: "about", visible: true, title: "About" },
  { id: "contact", type: "contact", visible: true, title: "Contact" }
];

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

function normalizePublishedSiteData(raw) {
  const data = cleanSiteDataForStorage(raw || {});

  data.schemaVersion = 2;
  data.heroTitle = data.heroTitle || "Business Website";
  data.heroSubtitle =
    data.heroSubtitle || "A strong modern website built from your prompt.";
  data.services = Array.isArray(data.services) ? data.services : [];
  data.features = Array.isArray(data.features) ? data.features : [];
  data.about = data.about || "";
  data.contact = data.contact || data.contactText || "";
  data.logoUrl = data.logoUrl || "";
  data.heroImageUrl = data.heroImageUrl || "";

  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    data.pages = [
      {
        slug: "home",
        title: "Home",
        fileName: "index.html"
      }
    ];
  }

  if (!Array.isArray(data.homeSections) || data.homeSections.length === 0) {
    data.homeSections = DEFAULT_HOME_SECTIONS.map((section) => ({ ...section }));
  }

  return data;
}

async function parseJsonResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return { rawText, data: null };
  }

  try {
    return { rawText, data: JSON.parse(rawText) };
  } catch {
    return { rawText, data: null };
  }
}

function getSupabaseConfigError() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment.";
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseConfigError = getSupabaseConfigError();
  if (supabaseConfigError) {
    return res.status(500).json({ error: supabaseConfigError });
  }

  const { userId } = await optionalAuth(req);

  try {
    const { title, siteData } = req.body || {};

    if (!siteData || typeof siteData !== "object") {
      return res.status(400).json({ error: "Missing siteData" });
    }

    const cleanedSiteData = normalizePublishedSiteData(siteData);
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
          site_data: cleanedSiteData,
          ...(userId ? { user_id: userId } : {})
        })
      }
    );

    const { rawText, data } = await parseJsonResponse(response);

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.hint ||
          data?.error ||
          rawText ||
          "Failed to publish site. Confirm the published_sites table migration has been run.",
        details: data || rawText
      });
    }

    if (!Array.isArray(data) || !data[0]) {
      return res.status(500).json({
        error: "Publish succeeded but no site record was returned"
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
      error: error.message || "Server error publishing site"
    });
  }
}
