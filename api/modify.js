import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    const { prompt, siteData } = req.body;

    if (!prompt || !siteData) {
      return res.status(400).json({
        error: "Both prompt and siteData are required."
      });
    }

    const systemPrompt = `
You are editing an existing business website.

Return ONLY the fields that should change.
Do NOT rewrite the full website.
Do NOT include unchanged fields.
Return valid JSON only.

Allowed fields:
heroTitle
heroSubtitle
services
features
contact

If no change is needed return {}.
`;

    const userPrompt = `
User request:
${prompt}

Current site:
${JSON.stringify(siteData, null, 2)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    let raw = completion.choices[0].message.content || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let updates;

    try {
      updates = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "Invalid JSON returned from AI",
        raw
      });
    }

    const allowedKeys = [
      "heroTitle",
      "heroSubtitle",
      "services",
      "features",
      "contact"
    ];

    const cleanedUpdates = {};

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        cleanedUpdates[key] = updates[key];
      }
    }

    return res.status(200).json(cleanedUpdates);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Modify failed"
    });
  }
}
