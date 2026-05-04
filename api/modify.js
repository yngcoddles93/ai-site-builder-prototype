export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, siteData, section } = req.body;

    if (!prompt || !siteData || !section) {
      return res.status(400).json({
        error: "Prompt, siteData, and section are required"
      });
    }

    const sectionFieldMap = {
      hero: ["heroTitle", "heroSubtitle", "logoUrl", "heroImageUrl"],
      services: ["services"],
      features: ["features"],
      about: ["about"],
      contact: ["contact"],
      all: [
        "heroTitle",
        "heroSubtitle",
        "services",
        "features",
        "about",
        "contact",
        "logoUrl",
        "heroImageUrl"
      ]
    };

    let allowedKeys = sectionFieldMap[section];

const isCustomPage = siteData.pages?.some(page => page.slug === section);

if (!allowedKeys && isCustomPage) {
  allowedKeys = ["content"];
}

if (!allowedKeys) {
  return res.status(400).json({
    error: "Invalid section selected"
  });
}

    const aiPrompt = `
You are editing an existing website.

Return ONLY valid JSON.
Return ONLY the fields that should change.
Do NOT rewrite the full website.
Do NOT include unchanged fields.

Selected section to edit:
${section}

Only modify fields in this section:
${allowedKeys.join(", ")}

Do not modify anything outside these fields.

Allowed image fields:
- logoUrl
- heroImageUrl

Image support:

If the user asks to add, change, replace, or remove a hero image, return heroImageUrl.

Do NOT use source.unsplash.com.

Use one of these approved working image URLs based on the user's request:

Car, Porsche, vehicle, luxury car, automotive:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900"
}

Car detailing, washing, cleaning, polishing:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=900"
}

Restaurant, food, dining:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900"
}

Gym, fitness, workout:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900"
}

Landscaping, lawn care, outdoor service:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=900"
}

Real estate, home, property:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900"
}

Construction, contractor, remodeling:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900"
}

Spa, beauty, salon:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900"
}

Medical, clinic, healthcare:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900"
}

Technology, software, AI, startup:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900"
}

If the user asks for a hero image but the business type does not clearly match one above, use this general business image:
{
  "heroImageUrl": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900"
}

If the user asks to remove the hero image, return:
{
  "heroImageUrl": ""
}

If the user asks to remove the logo, return:
{
  "logoUrl": ""
}

If the user does not ask for images, do not include logoUrl or heroImageUrl.
Current website data:
${JSON.stringify(siteData, null, 2)}

User request:
${prompt}

The request may include spelling mistakes, shorthand, or informal wording.
Interpret the user's intent intelligently and correct spelling if necessary before applying edits.
Always return polished, professional marketing-quality language.

Examples:

If section is "hero" and the user says "make the title more premium", return:
{
  "heroTitle": "Luxury Mobile Detailing"
}

If section is "hero" and the user says "change the subtitle", return:
{
  "heroSubtitle": "Premium detailing brought directly to your driveway."
}

If section is "services" and the user says "add ceramic coating", return:
{
  "services": [
    { "title": "Ceramic Coating", "description": "Long-lasting paint protection and gloss." }
  ]
}

If no change is needed, return:
{}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: aiPrompt
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", result);
      return res.status(500).json({
        error: result.error?.message || "OpenAI request failed"
      });
    }

    const outputText =
      result.output?.[0]?.content?.[0]?.text ||
      result.output_text ||
      "";

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      console.error("JSON parse error:", outputText);
      return res.status(500).json({
        error: "AI returned an invalid format. Try again."
      });
    }

    const cleanedUpdates = {};

    for (const key of allowedKeys) {
      if (parsed[key] !== undefined) {
        cleanedUpdates[key] = parsed[key];
      }
    }

    return res.status(200).json(cleanedUpdates);
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
