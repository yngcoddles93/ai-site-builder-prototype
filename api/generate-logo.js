const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, siteData } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Logo prompt is required" });
    }

    const businessName = siteData?.heroTitle || "Business Logo";

    const logoPrompt = `
Create a clean professional logo.

Business:
${businessName}

Style request:
${prompt}

Requirements:
minimal
centered
modern
simple icon or monogram
plain background
website-ready
`;

    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: logoPrompt,
        size: "1024x1024",
        n: 1
      })
    });

    const imageResult = await imageResponse.json();

    if (!imageResponse.ok) {
      return res.status(500).json({
        error: imageResult.error?.message || "OpenAI logo generation failed"
      });
    }

    const base64Image = imageResult.data?.[0]?.b64_json;

    if (!base64Image) {
      return res.status(500).json({ error: "No image returned from OpenAI" });
    }

    const imageBuffer = Buffer.from(base64Image, "base64");

    const blob = await put(`logos/logo-${Date.now()}.png`, imageBuffer, {
      access: "public",
      contentType: "image/png"
    });

    return res.status(200).json({
      logos: [
        {
          name: "Generated Logo",
          url: blob.url
        }
      ]
    });
  } catch (error) {
    console.error("Generate logo error:", error);

    return res.status(500).json({
      error: error.message || "Server error generating logo"
    });
  }
};
