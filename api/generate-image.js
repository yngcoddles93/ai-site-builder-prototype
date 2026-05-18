import { put } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, siteData } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Image prompt is required" });
    }

    const businessName = siteData?.heroTitle || "Business Website";

    const imagePrompt = `
Create a professional website hero image.

Business:
${businessName}

Image request:
${prompt}

Requirements:
realistic
high quality
modern website hero image
no text
no logos
no watermark
no random people unless requested
premium lighting
wide cinematic composition
`;

    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1536x1024"
      })
    });

    const imageData = await imageResponse.json();

    if (!imageResponse.ok) {
      return res.status(500).json({
        error: imageData.error?.message || "OpenAI image generation failed"
      });
    }

    const base64Image = imageData.data?.[0]?.b64_json;

    if (!base64Image) {
      return res.status(500).json({ error: "No image returned from OpenAI" });
    }

    const buffer = Buffer.from(base64Image, "base64");

    const blob = await put(`hero-images/hero-${Date.now()}.png`, buffer, {
      access: "public",
      contentType: "image/png"
    });

    return res.status(200).json({
      imageUrl: blob.url
    });
  } catch (error) {
    console.error("Generate image error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
