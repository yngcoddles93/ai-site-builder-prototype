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
    const businessDescription = siteData?.heroSubtitle || "";

    const logoPrompt = `
Create a clean, professional logo concept for this business.

Business name:
${businessName}

Business description:
${businessDescription}

User logo request:
${prompt}

Logo requirements:
- modern professional logo
- simple icon or monogram
- clean readable design
- centered logo
- minimal text
- suitable for website header
- high contrast
- plain or transparent background
- do not include extra words besides business name or initials
`;

    const response = await fetch(
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
          size: "1024x1024",
          n: 4
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI image error:", result);
      return res.status(500).json({
        error: result.error?.message || "Logo generation failed"
      });
    }

    const logos = (result.data || []).map((item, index) => ({
      name: `Generated Logo ${index + 1}`,
      url: `data:image/png;base64,${item.b64_json}`
    }));

    return res.status(200).json({ logos });

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      error: "Server error generating logos"
    });
  }
}
