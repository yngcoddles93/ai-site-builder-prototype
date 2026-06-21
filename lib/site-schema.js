(function (global) {
  const SCHEMA_VERSION = 2;

  const DEFAULT_THEME = {
    style: "modern",
    colorPalette: "default",
    primaryColor: "#3b82f6",
    secondaryColor: "#1e293b",
    backgroundColor: "#0f172a",
    textColor: "#ffffff",
    fontStyle: "sans",
    buttonStyle: "solid",
    cardStyle: "elevated",
    heroLayout: "image-right",
    spacing: "normal",
    borderRadius: "medium",
    background: "#0f172a",
    text: "#ffffff",
    primary: "#3b82f6",
    secondary: "#1e293b",
    accent: "#facc15",
    heroBackground: "#1d4ed8",
    navBackground: "#ffffff",
    navText: "#111111"
  };

  const HERO_LAYOUT_FROM_IMAGE_POSITION = {
    left: "image-left",
    right: "image-right"
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
    const input = theme && typeof theme === "object" ? theme : {};
    const merged = { ...DEFAULT_THEME, ...input };

    const backgroundColor =
      input.backgroundColor ||
      input.background ||
      DEFAULT_THEME.backgroundColor;
    const textColor =
      input.textColor || input.text || DEFAULT_THEME.textColor;
    const primaryColor =
      input.primaryColor || input.primary || DEFAULT_THEME.primaryColor;
    const secondaryColor =
      input.secondaryColor ||
      input.secondary ||
      DEFAULT_THEME.secondaryColor;

    return {
      style: merged.style || DEFAULT_THEME.style,
      colorPalette: merged.colorPalette || DEFAULT_THEME.colorPalette,
      primaryColor,
      secondaryColor,
      backgroundColor,
      textColor,
      fontStyle: merged.fontStyle || DEFAULT_THEME.fontStyle,
      buttonStyle: merged.buttonStyle || DEFAULT_THEME.buttonStyle,
      cardStyle: merged.cardStyle || DEFAULT_THEME.cardStyle,
      heroLayout: merged.heroLayout || DEFAULT_THEME.heroLayout,
      spacing: merged.spacing || DEFAULT_THEME.spacing,
      borderRadius: merged.borderRadius || DEFAULT_THEME.borderRadius,
      background: backgroundColor,
      text: textColor,
      primary: primaryColor,
      secondary: secondaryColor,
      accent: merged.accent || DEFAULT_THEME.accent,
      heroBackground: merged.heroBackground || DEFAULT_THEME.heroBackground,
      navBackground: merged.navBackground || DEFAULT_THEME.navBackground,
      navText: merged.navText || DEFAULT_THEME.navText
    };
  }

  function syncThemeHeroLayoutFromLayout(theme, layout, rawTheme) {
    if (rawTheme?.heroLayout) {
      return theme;
    }

    const imagePosition = layout?.heroImagePosition;
    const derivedLayout = HERO_LAYOUT_FROM_IMAGE_POSITION[imagePosition];

    if (!derivedLayout) {
      return theme;
    }

    return {
      ...theme,
      heroLayout: derivedLayout
    };
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
    const rawTheme = raw.theme;

    data.schemaVersion = SCHEMA_VERSION;
    data.layout = normalizeLayout(data.layout);
    data.theme = syncThemeHeroLayoutFromLayout(
      normalizeTheme(data.theme),
      data.layout,
      rawTheme
    );
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

  const BORDER_RADIUS_MAP = {
    none: "0px",
    small: "8px",
    medium: "14px",
    large: "22px",
    pill: "999px"
  };

  const THEME_SPACING_MAP = {
    compact: {
      section: "40px",
      hero: "56px",
      card: "18px",
      gap: "14px"
    },
    normal: {
      section: "56px",
      hero: "72px",
      card: "22px",
      gap: "18px"
    },
    large: {
      section: "80px",
      hero: "96px",
      card: "28px",
      gap: "24px"
    }
  };

  const FONT_STYLE_MAP = {
    sans: 'Arial, Helvetica, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    modern: '"Segoe UI", Roboto, Arial, sans-serif',
    elegant: 'Georgia, "Palatino Linotype", "Book Antiqua", serif'
  };

  function parseHexColor(color) {
    if (typeof color !== "string") {
      return null;
    }

    const hex = color.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) {
      return null;
    }

    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;

    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function colorWithAlpha(color, alpha) {
    const rgb = parseHexColor(color);
    if (!rgb) {
      return color;
    }

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function isDarkColor(color) {
    const rgb = parseHexColor(color);
    if (!rgb) {
      return true;
    }

    const luminance =
      (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.45;
  }

  function isGoldLikeColor(color) {
    const rgb = parseHexColor(color);
    if (!rgb) {
      return false;
    }

    return rgb.r > 160 && rgb.g > 110 && rgb.b < 140 && rgb.r >= rgb.g * 0.75;
  }

  function pickGoldColor(normalized) {
    if (isGoldLikeColor(normalized.accent)) {
      return normalized.accent;
    }

    if (isGoldLikeColor(normalized.primaryColor)) {
      return normalized.primaryColor;
    }

    if (isDarkColor(normalized.backgroundColor)) {
      return normalized.accent || "#d4af37";
    }

    return normalized.accent || normalized.primaryColor || "#d4af37";
  }

  function resolveVisualProfile(normalized) {
    const dark = isDarkColor(normalized.backgroundColor);
    const gold = pickGoldColor(normalized);
    const premium =
      dark ||
      normalized.style === "luxury" ||
      /luxury|gold|black/i.test(String(normalized.colorPalette || ""));

    return { dark, gold, premium };
  }

  function getThemeSpacing(theme, profile) {
    if (profile?.premium) {
      return THEME_SPACING_MAP.large;
    }

    return THEME_SPACING_MAP[theme?.spacing] || THEME_SPACING_MAP.normal;
  }

  function getBorderRadiusValue(theme) {
    return BORDER_RADIUS_MAP[theme?.borderRadius] || BORDER_RADIUS_MAP.medium;
  }

  function getHeroFlexDirection(theme, layout) {
    const heroLayout = theme?.heroLayout;
    if (heroLayout === "image-left") {
      return "row-reverse";
    }
    if (heroLayout === "image-right") {
      return "row";
    }

    return layout?.heroImagePosition === "left" ? "row-reverse" : "row";
  }

  function getCardStyleTokens(theme, profile) {
    const normalized = normalizeTheme(theme);
    const visual = profile || resolveVisualProfile(normalized);
    const background = normalized.secondaryColor;
    const text = normalized.textColor;
    const gold = visual.gold;
    const radius = getBorderRadiusValue(normalized);
    const cardStyle = normalized.cardStyle || "elevated";

    if (visual.premium) {
      return {
        background,
        color: text,
        borderRadius: radius,
        border: `1px solid ${colorWithAlpha(gold, 0.42)}`,
        boxShadow: `0 24px 52px rgba(0, 0, 0, 0.42), 0 0 0 1px ${colorWithAlpha(
          gold,
          0.14
        )}, 0 0 28px ${colorWithAlpha(gold, 0.12)}`,
        hoverShadow: `0 28px 58px rgba(0, 0, 0, 0.48), 0 0 36px ${colorWithAlpha(
          gold,
          0.2
        )}`
      };
    }

    const darkSurface = visual.dark;
    let border = "1px solid transparent";
    let boxShadow = "none";

    if (cardStyle === "outline") {
      return {
        background: "transparent",
        color: text,
        borderRadius: radius,
        border: `1px solid ${normalized.accent}`,
        boxShadow: "none",
        hoverShadow: "none"
      };
    }

    if (cardStyle === "flat") {
      border = darkSurface
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.08)";
    } else if (cardStyle === "soft") {
      boxShadow = darkSurface
        ? "0 12px 32px rgba(0,0,0,0.32)"
        : "0 10px 28px rgba(0,0,0,0.10)";
      border = darkSurface
        ? "1px solid rgba(255,255,255,0.05)"
        : "1px solid rgba(0,0,0,0.05)";
    } else {
      boxShadow = darkSurface
        ? "0 22px 48px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.08)"
        : "0 16px 40px rgba(0,0,0,0.12)";
      border = darkSurface
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)";
    }

    return {
      background,
      color: text,
      borderRadius: radius,
      border,
      boxShadow,
      hoverShadow: boxShadow
    };
  }

  function getButtonStyleTokens(theme, profile) {
    const normalized = normalizeTheme(theme);
    const visual = profile || resolveVisualProfile(normalized);
    const primary = normalized.primaryColor;
    const gold = visual.gold;
    const buttonStyle = normalized.buttonStyle || "solid";
    const radius =
      normalized.buttonStyle === "pill" || normalized.borderRadius === "pill"
        ? BORDER_RADIUS_MAP.pill
        : getBorderRadiusValue(normalized);

    if (visual.premium) {
      return {
        background: `linear-gradient(135deg, ${gold}, ${colorWithAlpha(
          gold,
          0.82
        )})`,
        color: "#111111",
        border: `1px solid ${colorWithAlpha(gold, 0.85)}`,
        boxShadow: `0 16px 34px ${colorWithAlpha(gold, 0.38)}`,
        hoverShadow: `0 20px 40px ${colorWithAlpha(gold, 0.48)}`,
        borderRadius: radius
      };
    }

    if (buttonStyle === "outline") {
      return {
        background: "transparent",
        color: primary,
        border: `2px solid ${primary}`,
        boxShadow: "none",
        hoverShadow: "none",
        borderRadius: radius
      };
    }

    if (buttonStyle === "soft") {
      return {
        background: colorWithAlpha(primary, 0.16),
        color: primary,
        border: `1px solid ${colorWithAlpha(primary, 0.28)}`,
        boxShadow: "none",
        hoverShadow: "none",
        borderRadius: radius
      };
    }

    return {
      background: primary,
      color: "#ffffff",
      border: "none",
      boxShadow: `0 14px 30px ${colorWithAlpha(primary, 0.35)}`,
      hoverShadow: `0 16px 34px ${colorWithAlpha(primary, 0.42)}`,
      borderRadius: radius
    };
  }

  function renderHeroCtaMarkup() {
    return `<a href="#contact" class="theme-cta hero-cta">Get Started</a>`;
  }

  function buildThemeCssVariables(theme, layout) {
    const normalized = normalizeTheme(theme);
    const safeLayout = normalizeLayout(layout || {});
    const profile = resolveVisualProfile(normalized);
    const spacing = getThemeSpacing(normalized, profile);
    const card = getCardStyleTokens(normalized, profile);
    const button = getButtonStyleTokens(normalized, profile);
    const radius = getBorderRadiusValue(normalized);
    const gold = profile.gold;
    const dark = profile.dark;

    const pageGradient = profile.premium
      ? `radial-gradient(circle at top, ${colorWithAlpha(
          gold,
          0.12
        )}, transparent 42%), linear-gradient(180deg, ${colorWithAlpha(
          normalized.backgroundColor,
          1
        )} 0%, ${colorWithAlpha(normalized.secondaryColor, 0.55)} 100%)`
      : normalized.backgroundColor;

    const heroGradient = profile.premium
      ? `linear-gradient(135deg, ${colorWithAlpha(
          normalized.heroBackground,
          1
        )} 0%, ${normalized.backgroundColor} 52%, ${colorWithAlpha(
          gold,
          0.16
        )} 100%)`
      : `linear-gradient(135deg, ${normalized.heroBackground}, ${normalized.backgroundColor})`;

    return {
      "--site-bg": normalized.backgroundColor,
      "--site-text": normalized.textColor,
      "--site-text-muted": colorWithAlpha(normalized.textColor, 0.78),
      "--site-primary": normalized.primaryColor,
      "--site-secondary": normalized.secondaryColor,
      "--site-accent": normalized.accent,
      "--site-gold": gold,
      "--site-gold-soft": colorWithAlpha(gold, profile.premium ? 0.18 : 0.1),
      "--site-gold-border": colorWithAlpha(gold, profile.premium ? 0.45 : 0.2),
      "--site-gold-glow": profile.premium
        ? `0 0 18px ${colorWithAlpha(gold, 0.35)}`
        : "none",
      "--site-hero-bg": normalized.heroBackground,
      "--site-nav-bg": profile.premium
        ? colorWithAlpha(normalized.navBackground, 0.92)
        : normalized.navBackground,
      "--site-nav-text": normalized.navText,
      "--site-section-padding": spacing.section,
      "--site-hero-padding": spacing.hero,
      "--site-card-padding": spacing.card,
      "--site-grid-gap": spacing.gap,
      "--site-radius": radius,
      "--site-font-family":
        FONT_STYLE_MAP[normalized.fontStyle] ||
        (profile.premium ? FONT_STYLE_MAP.elegant : FONT_STYLE_MAP.sans),
      "--site-page-gradient": pageGradient,
      "--site-hero-gradient": heroGradient,
      "--site-card-bg": card.background,
      "--site-card-color": card.color,
      "--site-card-shadow": card.boxShadow,
      "--site-card-shadow-hover": card.hoverShadow || card.boxShadow,
      "--site-card-border": card.border,
      "--site-button-bg": button.background,
      "--site-button-color": button.color,
      "--site-button-border": button.border,
      "--site-button-shadow": button.boxShadow,
      "--site-button-shadow-hover": button.hoverShadow || button.boxShadow,
      "--site-button-radius": button.borderRadius,
      "--site-hero-direction": getHeroFlexDirection(normalized, safeLayout),
      "--site-nav-align": safeLayout.navAlign || "space-between",
      "--site-hero-align": safeLayout.heroAlign || "left",
      "--site-section-align": safeLayout.sectionAlign || "left",
      "--site-nav-shadow": profile.premium
        ? `0 14px 40px rgba(0, 0, 0, 0.42), inset 0 -1px 0 ${colorWithAlpha(
            gold,
            0.35
          )}`
        : dark
          ? "0 10px 30px rgba(0,0,0,0.35)"
          : "0 4px 20px rgba(0,0,0,0.08)",
      "--site-nav-border": profile.premium
        ? `1px solid ${colorWithAlpha(gold, 0.35)}`
        : dark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(0,0,0,0.06)",
      "--site-nav-hover-bg": profile.premium
        ? colorWithAlpha(gold, 0.14)
        : "rgba(127, 127, 127, 0.12)",
      "--site-nav-hover-glow": profile.premium
        ? `0 0 0 1px ${colorWithAlpha(gold, 0.28)}`
        : "none",
      "--site-section-border": profile.premium
        ? `1px solid ${colorWithAlpha(gold, 0.16)}`
        : dark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(0,0,0,0.06)",
      "--site-heading-accent": profile.premium
        ? colorWithAlpha(gold, 0.72)
        : colorWithAlpha(normalized.primaryColor, 0.35),
      "--site-hero-subtitle": colorWithAlpha(normalized.textColor, 0.82),
      "--site-hero-image-shadow": profile.premium
        ? `0 28px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px ${colorWithAlpha(
            gold,
            0.28
          )}`
        : "0 20px 50px rgba(0, 0, 0, 0.28)",
      "--site-footer-bg": profile.premium
        ? normalized.backgroundColor
        : normalized.secondaryColor
    };
  }

  function applyThemeStyles(root, theme, layout) {
    if (!root) {
      return normalizeTheme(theme);
    }

    const normalized = normalizeTheme(theme);
    const profile = resolveVisualProfile(normalized);
    const vars = buildThemeCssVariables(theme, layout);

    root.classList.add("site-theme-surface");
    root.dataset.themeVisual = profile.premium ? "dark-premium" : profile.dark
      ? "dark"
      : "light";

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return normalized;
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
        <a href="${escapeHtml(component.link || "#")}" class="theme-cta">
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
              <p class="theme-accent" style="font-size:20px;margin-bottom:10px;">
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
    const sectionStyle = "";

    if (type === "hero") {
      if (mode === "launched") {
        return `
          <section class="hero" data-section-id="${escapeHtml(section.id)}" data-section-type="hero">
            <div class="hero-text">
              <h1 class="hero-title">${escapeHtml(
                data.heroTitle || "Website Title"
              )}</h1>
              <p class="hero-subtitle">${escapeHtml(
                data.heroSubtitle || ""
              )}</p>
              ${renderHeroCtaMarkup()}
            </div>
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
            ${renderHeroCtaMarkup()}
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
          <${headingTag} class="section-heading">${escapeHtml(
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
          <${headingTag} class="section-heading">${escapeHtml(
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
          <${headingTag} class="section-heading">${escapeHtml(section.title || "About")}</${headingTag}>
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
          <${headingTag} class="section-heading">${escapeHtml(
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
              ? `<${headingTag} class="section-heading">${escapeHtml(section.title)}</${headingTag}>`
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
    normalizeTheme,
    createDefaultSiteData,
    renderHomeSections,
    renderHomeSectionsHtml,
    getHomeSectionNavLinks,
    getSectionGap,
    buildThemeCssVariables,
    applyThemeStyles,
    ensureComponentId,
    getReservedPageSlugs,
    isValidPageSlug,
    isReservedPageSlug,
    validatePageSlug,
    findPageBySlug,
    escapeHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
