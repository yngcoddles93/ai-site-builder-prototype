export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, siteData } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Logo prompt is required"
      });
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

    // Generate image from OpenAI
    const imageResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: logoPrompt,
          size: "1024x1024"
        })
      }
    );

    const imageResult = await imageResponse.json();

    if (!imageResponse.ok) {
      console.error(imageResult);
      return res.status(500).json({
        error: "Logo generation failed"
      });
    }

    const base64Image = imageResult.data[0].b64_json;

    const imageBuffer = Buffer.from(base64Image, "base64");

    // Upload to Vercel Blob
    const uploadResponse = await fetch(
      "https://blob.vercel-storage.com/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          "Content-Type": "image/png"
        },
        body: imageBuffer
      }
    );

    const blob = await uploadResponse.json();

    return res.status(200).json({
      logos: [
        {
          name: "Generated Logo",
          url: blob.url
        }
      ]
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error generating logo"
    });
  }
}
