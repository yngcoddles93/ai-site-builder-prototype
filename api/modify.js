import { randomUUID } from "crypto";

// ── Section field map (patch mode) ────────────────────────────────────────────

const SECTION_FIELD_MAP = {
  hero:     ["heroTitle", "heroSubtitle", "logoUrl", "heroImageUrl", "theme", "layout"],
  services: ["services"],
  features: ["features"],
  about:    ["about"],
  contact:  ["contact"],
  all: [
    "heroTitle", "heroSubtitle", "services", "features", "about", "contact",
    "logoUrl", "heroImageUrl", "theme", "layout"
  ]
};

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPatchPrompt(siteData, section, allowedKeys, prompt) {
  return `
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
Theme/color support:

If the user asks to change colors, style, vibe, branding, appearance, mood, visual design, or says things like:
- black and gold
- luxury
- modern
- feminine
- dark mode
- elegant
- minimal
- bright
- colorful
- premium
- neon
- soft pastel

Return a theme object.

Use this structure:

{
  "theme": {
    "background": "#0f172a",
    "text": "#ffffff",
    "primary": "#3b82f6",
    "secondary": "#1e293b",
    "accent": "#facc15",
    "heroBackground": "#1d4ed8",
    "navBackground": "#ffffff",
    "navText": "#111111"
  }
}
Layout/alignment support:

If the user asks to:
- center content
- left align content
- move hero image
- center navbar
- make layout modern
- make layout balanced
- make sections centered
- move image left/right

Return a layout object.

Use this structure:

{
  "layout": {
    "heroAlign": "left",
    "sectionAlign": "left",
    "heroImagePosition": "right",
    "navAlign": "space-between"
  }
}

Allowed values:

heroAlign:
- "left"
- "center"

sectionAlign:
- "left"
- "center"

heroImagePosition:
- "left"
- "right"

navAlign:
- "space-between"
- "center"
- "space-around"

Only return layout if the request is layout/alignment related.
Use valid hex colors only.
Only return theme if the request is visual/design related.
If editing a custom page, return structured components instead of plain text.

Supported custom page component types:
- text
- pricing
- button
- testimonial
- faq

For normal text sections on custom pages, use:

{
  "content": [
    {
      "type": "text",
      "value": "Paragraph text here"
    }
  ]
}

For pricing sections, use:

{
  "content": [
    {
      "type": "pricing",
      "tiers": [
        {
          "name": "Basic",
          "price": 500,
          "description": "Short description"
        },
        {
          "name": "Premium",
          "price": 900,
          "description": "Short description"
        },
        {
          "name": "Elite",
          "price": 1500,
          "description": "Short description"
        }
      ]
    }
  ]
}

If the user asks for pricing, packages, tiers, plans, rates, or costs, return a pricing component.

For button sections, use:

{
  "content": [
    {
      "type": "button",
      "text": "Book Now",
      "link": "#contact"
    }
  ]
}

If the user asks for a button, CTA, call to action, booking link, contact button, or quote button, return a button component.

For testimonial sections, use:

{
  "content": [
    {
      "type": "testimonial",
      "reviews": [
        {
          "name": "Sarah M.",
          "rating": 5,
          "quote": "Amazing experience and incredible results."
        },
        {
          "name": "James R.",
          "rating": 5,
          "quote": "Professional, fast, and worth every dollar."
        },
        {
          "name": "Emily T.",
          "rating": 5,
          "quote": "The finished product looked absolutely perfect."
        }
      ]
    }
  ]
}

If the user asks for testimonials, reviews, customer quotes, ratings, or social proof, return a testimonial component.

For FAQ sections, use:

{
  "content": [
    {
      "type": "faq",
      "items": [
        {
          "question": "Do you offer mobile service?",
          "answer": "Yes, we come directly to your location."
        },
        {
          "question": "How long does detailing take?",
          "answer": "Most services take between 2 and 5 hours depending on the package."
        },
        {
          "question": "Do you provide ceramic coatings?",
          "answer": "Yes, we offer long-term ceramic coating protection packages."
        }
      ]
    }
  ]
}

If the user asks for FAQs, questions and answers, common questions, or help sections, return a faq component.

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

If section is "services" and the user says "add ceramic coating", return:
{
  "services": [
    {
      "title": "Ceramic Coating",
      "description": "Long-lasting paint protection and gloss."
    }
  ]
}

If no change is needed, return:
{}
`;
}

function buildActionsPrompt(siteData, section, prompt) {
  return `
You are editing a website. Return ONLY this exact JSON shape — no markdown, no prose, no extra keys:
{
  "actions": [ ... ]
}

Do NOT include "id" fields — they are injected automatically.

AVAILABLE ACTION TYPES:

1. updateText — Change a single text field
   Required: type, path, value (string)
   Valid paths: "hero.title" | "hero.subtitle" | "hero.logo" | "hero.image" | "about.text" | "contact.text"
   Example: { "type": "updateText", "path": "hero.title", "value": "Premium Auto Detailing" }

2. replaceSection — Replace the full structured content of a home section
   Required: type, path ("sections.<id>"), payload (object)
   Payload shapes:
     sections.hero     → { "heroTitle": "...", "heroSubtitle": "..." }
     sections.services → { "services": [{ "title": "...", "description": "..." }] }
     sections.features → { "features": [{ "title": "...", "description": "..." }] }
     sections.about    → { "about": "..." }
     sections.contact  → { "contact": "..." }
   Example: { "type": "replaceSection", "path": "sections.services", "payload": { "services": [{ "title": "Full Detail", "description": "Interior and exterior cleaning." }] } }

3. addSection — Add a new section to the home page
   Required: type, section (object with id, type, visible, title), position
   position values: "start" | "end" | "before:<sectionId>" | "after:<sectionId>"
   Example: { "type": "addSection", "section": { "id": "testimonials", "type": "testimonials", "visible": true, "title": "What Clients Say" }, "position": "before:contact" }

4. deleteSection — Remove a custom section (built-in sections hero/services/features/about/contact cannot be deleted)
   Required: type, path ("sections.<id>")
   Example: { "type": "deleteSection", "path": "sections.testimonials" }

5. moveSection — Reorder a section on the home page
   Required: type, path ("sections.<id>"), position
   position values: "start" | "end" | "before:<sectionId>" | "after:<sectionId>"
   Example: { "type": "moveSection", "path": "sections.about", "position": "after:hero" }

6. update_theme — Change visual theme (colors, style)
   Required: type, payload (object)
   Payload keys: backgroundColor, textColor, primaryColor, secondaryColor, accent, heroBackground, navBackground, navText, style, fontStyle, buttonStyle, cardStyle, borderRadius
   Use valid hex colors only.
   Example: { "type": "update_theme", "payload": { "backgroundColor": "#0f172a", "textColor": "#ffffff", "accent": "#d4af37" } }

7. update_layout — Change layout alignment
   Required: type, payload (object)
   Payload keys: heroAlign ("left"|"center"), sectionAlign ("left"|"center"), heroImagePosition ("left"|"right"), navAlign ("space-between"|"center"|"space-around")
   Example: { "type": "update_layout", "payload": { "heroAlign": "center" } }

RULES:
- Use the minimum number of actions to fulfill the request.
- Do not return actions for things the user did not ask to change.
- Editing scope: "${section}" — only return actions relevant to this scope.
- Interpret informal or misspelled requests intelligently.
- Always produce polished, professional marketing-quality copy.
- If no change is needed, return: { "actions": [] }

CURRENT WEBSITE DATA:
${JSON.stringify(siteData, null, 2)}

USER REQUEST:
${prompt}
`;
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function callOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: "gpt-5.4", input: prompt })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "OpenAI request failed");
  }

  return result.output?.[0]?.content?.[0]?.text || result.output_text || "";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, siteData, section, useActions } = req.body;

    if (!prompt || !siteData || !section) {
      return res.status(400).json({ error: "Prompt, siteData, and section are required" });
    }

    let allowedKeys = SECTION_FIELD_MAP[section];
    const isCustomPage = siteData.pages?.some((page) => page.slug === section);

    if (!allowedKeys && isCustomPage) allowedKeys = ["content"];
    if (!allowedKeys) return res.status(400).json({ error: "Invalid section selected" });

    // ── Actions mode ─────────────────────────────────────────────────────────
    // Custom pages stay on the patch path — the Phase 1 action types operate
    // on home sections and text fields only.
    if (useActions && !isCustomPage) {
      const actionsPrompt = buildActionsPrompt(siteData, section, prompt);
      const outputText = await callOpenAI(actionsPrompt);

      let parsed;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        // JSON parse failed — fall through to patch mode below.
        parsed = null;
      }

      if (parsed && Array.isArray(parsed.actions)) {
        // Inject server-generated IDs and source metadata on every action.
        const actions = parsed.actions.map((action) => ({
          ...action,
          id: randomUUID(),
          meta: {
            source: "ai",
            ...(action.meta || {}),
          },
        }));

        return res.status(200).json({ actions, responseFormat: "actions" });
      }

      // Actions parse failed — fall through to patch mode as silent fallback.
    }

    // ── Patch mode (default and fallback) ────────────────────────────────────
    const patchPrompt = buildPatchPrompt(siteData, section, allowedKeys, prompt);
    const outputText = await callOpenAI(patchPrompt);

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      console.error("JSON parse error:", outputText);
      return res.status(500).json({ error: "AI returned an invalid format. Try again." });
    }

    const cleanedUpdates = {};
    for (const key of allowedKeys) {
      if (parsed[key] !== undefined) cleanedUpdates[key] = parsed[key];
    }

    return res.status(200).json({ ...cleanedUpdates, responseFormat: "patch" });

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
