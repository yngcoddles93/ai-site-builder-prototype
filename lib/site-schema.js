(function (global) {
  const SCHEMA_VERSION = 2;

  const DEFAULT_THEME = {
    background: "#0f172a",
    text: "#ffffff",
    primary: "#3b82f6",
    secondary: "#1e293b",
    accent: "#facc15",
    heroBackground: "#1d4ed8",
    navBackground: "#ffffff",
    navText: "#111111",
    spacing: "normal"
  };

  const DEFAULT_LAYOUT = {
    heroAlign: "left",
    sectionAlign: "left",
    heroImagePosition: "right",
    navAlign: "space-between",
    sectionGap: "normal",
    mobileHeroStack: true
  };

  const BUILTIN_HOME_SECTION_TYPES = new Set([
    "hero",
    "services",
    "features",
    "about",
    "contact"
  ]);

  const COMPONENT_SECTION_TYPES = new Set([
    "text",
    "pricing",
    "button",
    "testimonial",
    "faq"
  ]);

  const DEFAULT_HOME_SECTIONS = [
    { id: "hero", type: "hero", visible: true },
    {
      id: "services",
      type: "services",
      visible: true,
      title: "Services"
    },
    {
      id: "features",
      type: "features",
      visible: true,
      title: "Why Choose Us"
    },
    { id: "about", type: "about", visible: true, title: "About" },
    {
      id: "contact",
      type: "contact",
      visible: true,
      title: "Contact"
    }
  ];

  const SECTION_GAP_MAP = {
    compact: "18px",
    normal: "30px",
    large: "48px"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createSectionId(type, index) {
    return `${type}-${index + 1}`;
  }

  function ensureComponentId(component, index) {
    const next = clone(component);
    if (!next.id) {
      next.id = createSectionId(next.type || "component", index);
    }
    return next;
  }

  function normalizeTheme(theme) {
    return { ...DEFAULT_THEME, ...(theme || {}) };
  }

  function normalizeLayout(layout) {
    return { ...DEFAULT_LAYOUT, ...(layout || {}) };
  }

  function normalizeHomeSection(section, index, data) {
    const next = clone(section || {});
    const type = next.type || "text";

    if (!next.id) {
      next.id =
        BUILTIN_HOME_SECTION_TYPES.has(type)
          ? type
          : createSectionId(type, index);
    }

    next.type = type;
    next.visible = next.visible !== false;

    if (BUILTIN_HOME_SECTION_TYPES.has(type)) {
      if (!next.title && type !== "hero") {
        const fallback = DEFAULT_HOME_SECTIONS.find(
          (item) => item.id === type
        );
        next.title = fallback?.title || type;
      }
      return next;
    }

    if (COMPONENT_SECTION_TYPES.has(type)) {
      return ensureComponentId(next, index);
    }

    return ensureComponentId({ ...next, type: type || "text" }, index);
  }

  function buildHomeSectionsFromLegacy(data) {
    if (Array.isArray(data.homeSections) && data.homeSections.length > 0) {
      return data.homeSections.map((section, index) =>
        normalizeHomeSection(section, index, data)
      );
    }

    return DEFAULT_HOME_SECTIONS.map((section, index) =>
      normalizeHomeSection(section, index, data)
    );
  }

  function normalizePages(pages) {
    const list = Array.isArray(pages) ? pages : DEFAULT_PAGES();
    const seenSlugs = new Set();

    return list
      .map((page) => {
        const next = clone(page);
        if (!next.slug || !isValidPageSlug(next.slug)) {
          next.slug = next.title
            ? String(next.title)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
            : "";
        }

        if (!next.slug || !isValidPageSlug(next.slug)) {
          return null;
        }

        if (!next.title) {
          next.title = next.slug === "home" ? "Home" : next.slug;
        }
        if (!next.fileName) {
          next.fileName =
            next.slug === "home" ? "index.html" : `${next.slug}.html`;
        }
        next.components = (next.components || []).map((component, index) =>
          ensureComponentId(component, index)
        );
        return next;
      })
      .filter(Boolean)
      .filter((page) => {
        if (seenSlugs.has(page.slug)) {
          return false;
        }
        seenSlugs.add(page.slug);
        return true;
      });
  }

  function DEFAULT_PAGES() {
    return [
      {
        slug: "home",
        title: "Home",
        fileName: "index.html"
      }
    ];
  }

  function getReservedPageSlugs(data) {
    const normalized = normalizeSiteData(data || {});
    const reserved = new Set(["home", "hero"]);

    normalized.homeSections.forEach((section) => {
      if (section?.id) {
        reserved.add(section.id);
      }
    });

    return reserved;
  }

  function isValidPageSlug(slug) {
    return typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }

  function isReservedPageSlug(slug, data) {
    return getReservedPageSlugs(data).has(slug);
  }

  function validatePageSlug(slug, data) {
    if (!slug) {
      return {
        valid: false,
        reason: "Choose a page name that includes letters or numbers."
      };
    }

    if (!isValidPageSlug(slug)) {
      return {
        valid: false,
        reason: "Page names must use letters, numbers, and hyphens only."
      };
    }

    if (isReservedPageSlug(slug, data)) {
      return {
        valid: false,
        reason:
          "That page name conflicts with a homepage section. Please choose another name."
      };
    }

    return { valid: true };
  }

  function findPageBySlug(data, slug) {
    return normalizeSiteData(data).pages.find((page) => page.slug === slug);
  }

  function createDefaultSiteData() {
    return normalizeSiteData({
      heroTitle: "Business Website",
      heroSubtitle: "A strong modern website built from your prompt.",
      services: [],
      features: [],
      about: "",
      contact: "",
      logoUrl: "",
      heroImageUrl: "",
      pages: DEFAULT_PAGES()
    });
  }

  function normalizeSiteData(raw) {
    if (!raw || typeof raw !== "object") {
      return createDefaultSiteData();
    }

    const data = clone(raw);

    data.schemaVersion = SCHEMA_VERSION;
    data.theme = normalizeTheme(data.theme);
    data.layout = normalizeLayout(data.layout);
    data.heroTitle = data.heroTitle || "Business Website";
    data.heroSubtitle =
      data.heroSubtitle || "A strong modern website built from your prompt.";
    data.services = Array.isArray(data.services) ? data.services : [];
    data.features = Array.isArray(data.features) ? data.features : [];
    data.about = data.about || "";
    data.contact = data.contact || data.contactText || "";
    data.logoUrl = data.logoUrl || "";
    data.heroImageUrl = data.heroImageUrl || "";
    data.pages = normalizePages(data.pages);
    if (!data.pages.length) {
      data.pages = DEFAULT_PAGES();
    }
    data.homeSections = buildHomeSectionsFromLegacy(data);

    return data;
  }

  function getSectionGap(layout) {
    return SECTION_GAP_MAP[layout?.sectionGap] || SECTION_GAP_MAP.normal;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderComponentMarkup(component, mode) {
    if (component.type === "text") {
      const tag = mode === "launched" ? "div" : "p";
      const className =
        mode === "launched" ? "text-block" : "card";
      return `<${tag} class="${className}">${escapeHtml(
        component.value || ""
      )}</${tag}>`;
    }

    if (component.type === "pricing") {
      return `
        <div class="cards">
          ${(component.tiers || [])
            .map(
              (tier) => `
            <div class="card">
              <h${mode === "launched" ? "3" : "4"}>${escapeHtml(
                tier.name || ""
              )}</h${mode === "launched" ? "3" : "4"}>
              <p style="font-size:${mode === "launched" ? "30" : "28"}px;font-weight:bold;">$${escapeHtml(
                tier.price ?? ""
              )}</p>
              <p>${escapeHtml(tier.description || "")}</p>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    if (component.type === "button") {
      return `
        <a href="${escapeHtml(component.link || "#")}"
           style="display:inline-block;background:#3b82f6;color:white;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;margin-top:${mode === "launched" ? "18" : "16"}px;">
          ${escapeHtml(component.text || "Click Here")}
        </a>
      `;
    }

    if (component.type === "testimonial") {
      return `
        <div class="cards">
          ${(component.reviews || [])
            .map(
              (review) => `
            <div class="card">
              <p style="font-size:20px;color:#facc15;margin-bottom:10px;">
                ${"★".repeat(review.rating || 5)}
              </p>
              <p>"${escapeHtml(review.quote || "")}"</p>
              <h${mode === "launched" ? "3" : "4"} style="margin-top:14px;">
                ${escapeHtml(review.name || "Customer")}
              </h${mode === "launched" ? "3" : "4"}>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    if (component.type === "faq") {
      return `
        <div>
          ${(component.items || [])
            .map(
              (item) => `
            <div class="card" style="margin-bottom:14px;">
              <h${mode === "launched" ? "3" : "4"}>${escapeHtml(
                item.question || ""
              )}</h${mode === "launched" ? "3" : "4"}>
              <p>${escapeHtml(item.answer || "")}</p>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    return "";
  }

  function renderHomeSectionMarkup(section, data, mode, gap) {
    const headingTag = mode === "launched" ? "h2" : "h3";
    const type = section.type;
    const sectionStyle =
      type === "hero"
        ? ""
        : ` style="padding-top:${gap};padding-bottom:${gap};"`;

    if (type === "hero") {
      if (mode === "launched") {
        return `
          <section class="hero" data-section-id="${escapeHtml(section.id)}" data-section-type="hero">
            <h1 class="hero-title">${escapeHtml(
              data.heroTitle || "Website Title"
            )}</h1>
            <p class="hero-subtitle">${escapeHtml(
              data.heroSubtitle || ""
            )}</p>
            ${
              data.heroImageUrl
                ? `<img class="hero-image" src="${escapeHtml(
                    data.heroImageUrl
                  )}" alt="Hero image" />`
                : `<img class="hero-image" style="display:none;" alt="Hero image" />`
            }
          </section>
        `;
      }

      return `
        <div class="hero" data-section-id="${escapeHtml(section.id)}" data-section-type="hero">
          <div class="hero-text">
            <h2 class="hero-title">${escapeHtml(
              data.heroTitle || "Business Website"
            )}</h2>
            <p class="hero-subtitle">${escapeHtml(
              data.heroSubtitle ||
                "A strong modern website built from your prompt."
            )}</p>
          </div>
          ${
            data.heroImageUrl
              ? `<img class="hero-image" src="${escapeHtml(
                  data.heroImageUrl
                )}" alt="Hero image" />`
              : `<img class="hero-image" src="" alt="Hero image" style="display:none;" />`
          }
        </div>
      `;
    }

    if (type === "services") {
      const cards = (data.services || [])
        .map(
          (item) => `
        <div class="card">
          <h4>${escapeHtml(item.title || "")}</h4>
          <p>${escapeHtml(item.description || "")}</p>
        </div>
      `
        )
        .join("");

      return `
        <div class="section home-section" id="${escapeHtml(
          section.id
        )}" data-section-id="${escapeHtml(section.id)}" data-section-type="services"${sectionStyle}>
          <${headingTag}>${escapeHtml(
            section.title || "Services"
          )}</${headingTag}>
          <div class="cards services-grid">${cards}</div>
        </div>
      `;
    }

    if (type === "features") {
      const cards = (data.features || [])
        .map(
          (item) => `
        <div class="card">
          <h4>${escapeHtml(item.title || "")}</h4>
          <p>${escapeHtml(item.description || "")}</p>
        </div>
      `
        )
        .join("");

      return `
        <div class="section home-section" id="${escapeHtml(
          section.id
        )}" data-section-id="${escapeHtml(section.id)}" data-section-type="features"${sectionStyle}>
          <${headingTag}>${escapeHtml(
            section.title || "Why Choose Us"
          )}</${headingTag}>
          <div class="cards features-grid">${cards}</div>
        </div>
      `;
    }

    if (type === "about") {
      const aboutText = escapeHtml(
        data.about || "Tell visitors about your business here."
      );
      const body =
        mode === "launched"
          ? `<div class="text-block about-text">${aboutText}</div>`
          : `<p class="about-text">${aboutText}</p>`;

      return `
        <div class="section home-section" id="${escapeHtml(
          section.id
        )}" data-section-id="${escapeHtml(section.id)}" data-section-type="about"${sectionStyle}>
          <${headingTag}>${escapeHtml(section.title || "About")}</${headingTag}>
          ${body}
        </div>
      `;
    }

    if (type === "contact") {
      const contactContent =
        mode === "launched"
          ? `<div class="text-block contact-text">${escapeHtml(
              data.contact ||
                "Add your phone, email, and contact details here."
            )}</div>`
          : `<p class="contact-text">${escapeHtml(
              data.contact ||
                "Add your phone, email, and contact details here."
            )}</p>`;

      return `
        <div class="section home-section" id="${escapeHtml(
          section.id
        )}" data-section-id="${escapeHtml(section.id)}" data-section-type="contact"${sectionStyle}>
          <${headingTag}>${escapeHtml(
            section.title || "Contact"
          )}</${headingTag}>
          ${contactContent}
        </div>
      `;
    }

    if (COMPONENT_SECTION_TYPES.has(type)) {
      return `
        <div class="section home-section" id="${escapeHtml(
          section.id
        )}" data-section-id="${escapeHtml(section.id)}" data-section-type="${escapeHtml(
        type
      )}"${sectionStyle}>
          ${
            section.title
              ? `<${headingTag}>${escapeHtml(section.title)}</${headingTag}>`
              : ""
          }
          ${renderComponentMarkup(section, mode)}
        </div>
      `;
    }

    return "";
  }

  function renderHomeSectionsHtml(data, mode) {
    const normalized = normalizeSiteData(data);
    const gap = getSectionGap(normalized.layout);

    return normalized.homeSections
      .filter((section) => section.visible !== false)
      .map((section) =>
        renderHomeSectionMarkup(section, normalized, mode, gap)
      )
      .join("");
  }

  function renderHomeSections(container, data, options) {
    if (!container) {
      return normalizeSiteData(data);
    }

    const mode = options?.mode === "launched" ? "launched" : "preview";
    const normalized = normalizeSiteData(data);
    container.innerHTML = renderHomeSectionsHtml(normalized, mode);
    return normalized;
  }

  function getHomeSectionNavLinks(data) {
    return normalizeSiteData(data).homeSections.filter((section) => {
      if (section.visible === false || section.type === "hero") {
        return false;
      }
      return true;
    });
  }

  global.SiteSchema = {
    SCHEMA_VERSION,
    DEFAULT_THEME,
    DEFAULT_LAYOUT,
    DEFAULT_HOME_SECTIONS,
    BUILTIN_HOME_SECTION_TYPES,
    COMPONENT_SECTION_TYPES,
    normalizeSiteData,
    createDefaultSiteData,
    renderHomeSections,
    renderHomeSectionsHtml,
    getHomeSectionNavLinks,
    getSectionGap,
    ensureComponentId,
    getReservedPageSlugs,
    isValidPageSlug,
    isReservedPageSlug,
    validatePageSlug,
    findPageBySlug
  };
})(typeof window !== "undefined" ? window : globalThis);
