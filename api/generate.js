export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const aiPrompt = `
You are helping generate a simple website preview.

Return ONLY valid JSON with this exact structure:
{
  "heroTitle": "string",
  "heroSubtitle": "string",
  "services": [
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" }
  ],
  "features": [
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" }
  ],
  "contactHeading": "string",
  "contactText": "string"
}

Make the content fit this website request:
${prompt}
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

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
