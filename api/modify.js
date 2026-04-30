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

    const allowedKeys = sectionFieldMap[section];

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
If the user asks to add, change, replace, or remove a hero image, use heroImageUrl.
If the user asks to add, change, replace, or remove a logo image, use logoUrl.

For simple image requests, create an Unsplash Source URL using keywords from the user's request.

Use this format:
https://source.unsplash.com/900x600/?keyword,keyword

Examples:

If the user says "add a picture of a Porsche 911 to the right side of the hero", return:
{
  "heroImageUrl": "https://source.unsplash.com/900x600/?porsche,911"
}

If the user says "make the hero image a luxury car detail", return:
{
  "heroImageUrl": "https://source.unsplash.com/900x600/?luxury,car,detailing"
}

If the user says "remove the hero image", return:
{
  "heroImageUrl": ""
}

If the user says "remove the logo", return:
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
