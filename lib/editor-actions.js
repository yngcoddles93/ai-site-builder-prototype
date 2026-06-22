(function (global) {
  const SiteSchema = global.SiteSchema;

  // ── Constants ────────────────────────────────────────────────────────────────

  const ACTION_TYPES = {
    // Legacy snake_case types (unchanged behavior)
    UPDATE_SECTION:   "update_section",
    ADD_COMPONENT:    "add_component",
    REMOVE_COMPONENT: "remove_component",
    MOVE_COMPONENT:   "move_component",
    UPDATE_THEME:     "update_theme",
    UPDATE_LAYOUT:    "update_layout",
    REWRITE_COPY:     "rewrite_copy",
    REORDER_SECTIONS: "reorder_sections",
    // Phase 1 typed actions
    UPDATE_TEXT:      "updateText",
    REPLACE_SECTION:  "replaceSection",
    ADD_SECTION:      "addSection",
    DELETE_SECTION:   "deleteSection",
    MOVE_SECTION:     "moveSection",
  };

  // Built-in sections cannot be deleted via deleteSection.
  const PROTECTED_SECTIONS = new Set(["hero", "services", "features", "about", "contact"]);

  // ── Utilities ────────────────────────────────────────────────────────────────

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function generateActionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "act-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  // ── Path Resolver ────────────────────────────────────────────────────────────
  //
  // resolveTextPathAccessor maps a semantic path string like "hero.title" to
  // { get(siteData), set(siteData, value) } callbacks. This layer decouples the
  // action schema from the raw siteData field names, so adding new domains
  // (blog, products, booking) only requires new cases here — action type
  // handlers never reference siteData fields directly.

  const HERO_FIELD_MAP = {
    title:    { get: sd => sd.heroTitle,    set: (sd, v) => { sd.heroTitle = v; } },
    subtitle: { get: sd => sd.heroSubtitle, set: (sd, v) => { sd.heroSubtitle = v; } },
    logo:     { get: sd => sd.logoUrl,      set: (sd, v) => { sd.logoUrl = v; } },
    image:    { get: sd => sd.heroImageUrl, set: (sd, v) => { sd.heroImageUrl = v; } },
  };

  function resolveTextPathAccessor(path) {
    if (!path || typeof path !== "string") return null;
    const parts = path.split(".");
    const [ns, key] = parts;

    if (ns === "hero") {
      return HERO_FIELD_MAP[key] || null;
    }
    if (ns === "about" && key === "text") {
      return { get: sd => sd.about, set: (sd, v) => { sd.about = v; } };
    }
    if (ns === "contact" && key === "text") {
      return { get: sd => sd.contact, set: (sd, v) => { sd.contact = v; } };
    }

    // Future namespaces (blog, products, booking, pages) are added as new cases above.
    return null;
  }

  // Parses "sections.<id>" → "<id>", or returns null for invalid paths.
  function parseSectionPath(path) {
    if (!path || typeof path !== "string") return null;
    const parts = path.split(".");
    if (parts[0] !== "sections" || parts.length !== 2 || !parts[1]) return null;
    return parts[1];
  }

  // ── Existing helpers (unchanged) ─────────────────────────────────────────────

  function findHomeSectionIndex(siteData, targetId) {
    return siteData.homeSections.findIndex((section) => section.id === targetId);
  }

  function findPage(siteData, pageRef) {
    if (pageRef === "home") {
      return { kind: "home", page: null };
    }
    const page = (siteData.pages || []).find((item) => item.slug === pageRef);
    if (!page) throw new Error(`Unknown page: ${pageRef}`);
    return { kind: "page", page };
  }

  function resolveInsertIndex(items, position) {
    if (!position || position === "end") return items.length;
    if (position === "start") return 0;

    const beforeMatch = /^before:(.+)$/.exec(position);
    if (beforeMatch) {
      const index = items.findIndex((item) => item.id === beforeMatch[1]);
      if (index === -1) throw new Error(`Unknown before target: ${beforeMatch[1]}`);
      return index;
    }

    const afterMatch = /^after:(.+)$/.exec(position);
    if (afterMatch) {
      const index = items.findIndex((item) => item.id === afterMatch[1]);
      if (index === -1) throw new Error(`Unknown after target: ${afterMatch[1]}`);
      return index + 1;
    }

    throw new Error(`Invalid position: ${position}`);
  }

  function applyBuiltinSectionUpdate(siteData, target, payload) {
    if (target === "hero") {
      if (payload.heroTitle !== undefined)    siteData.heroTitle = payload.heroTitle;
      if (payload.heroSubtitle !== undefined) siteData.heroSubtitle = payload.heroSubtitle;
      if (payload.logoUrl !== undefined)      siteData.logoUrl = payload.logoUrl;
      if (payload.heroImageUrl !== undefined) siteData.heroImageUrl = payload.heroImageUrl;
      return;
    }
    if (target === "services" && payload.services !== undefined) {
      siteData.services = payload.services;
      return;
    }
    if (target === "features" && payload.features !== undefined) {
      siteData.features = payload.features;
      return;
    }
    if (target === "about" && payload.about !== undefined) {
      siteData.about = payload.about;
      return;
    }
    if (target === "contact" && payload.contact !== undefined) {
      siteData.contact = payload.contact;
      return;
    }
    const sectionIndex = findHomeSectionIndex(siteData, target);
    if (sectionIndex === -1) throw new Error(`Unknown section target: ${target}`);
    siteData.homeSections[sectionIndex] = {
      ...siteData.homeSections[sectionIndex],
      ...payload
    };
  }

  // ── Legacy action handlers (unchanged logic) ──────────────────────────────────

  function applyUpdateSection(siteData, action) {
    if (!action.target) throw new Error("update_section requires target");
    if (!isObject(action.payload)) throw new Error("update_section requires payload object");
    applyBuiltinSectionUpdate(siteData, action.target, action.payload);
  }

  function applyUpdateTheme(siteData, action) {
    if (!isObject(action.payload)) throw new Error("update_theme requires payload object");
    siteData.theme = { ...siteData.theme, ...action.payload };
  }

  function applyUpdateLayout(siteData, action) {
    if (!isObject(action.payload)) throw new Error("update_layout requires payload object");
    siteData.layout = { ...siteData.layout, ...action.payload };
  }

  function applyRewriteCopy(siteData, action) {
    if (!action.target) throw new Error("rewrite_copy requires target");
    if (!isObject(action.payload)) throw new Error("rewrite_copy requires payload object");
    if (action.target.startsWith("page:")) {
      const slug = action.target.slice(5);
      const page = (siteData.pages || []).find((item) => item.slug === slug);
      if (!page) throw new Error(`Unknown page target: ${slug}`);
      if (Array.isArray(action.payload.content)) {
        page.components = action.payload.content.map((component, index) =>
          SiteSchema.ensureComponentId(component, index)
        );
      }
      return;
    }
    applyBuiltinSectionUpdate(siteData, action.target, action.payload);
  }

  function applyAddComponent(siteData, action) {
    const pageRef = action.page || "home";
    const location = findPage(siteData, pageRef);
    const component = SiteSchema.ensureComponentId(action.payload || {}, 0);
    if (location.kind === "page") {
      if (!Array.isArray(location.page.components)) location.page.components = [];
      const index = resolveInsertIndex(location.page.components, action.position);
      location.page.components.splice(index, 0, component);
      return;
    }
    const index = resolveInsertIndex(siteData.homeSections, action.position);
    siteData.homeSections.splice(index, 0, { ...component, visible: component.visible !== false });
  }

  function applyRemoveComponent(siteData, action) {
    const pageRef = action.page || "home";
    const targetId = action.targetId || action.target;
    if (!targetId) throw new Error("remove_component requires targetId");
    const location = findPage(siteData, pageRef);
    if (location.kind === "page") {
      location.page.components = (location.page.components || []).filter(
        (component) => component.id !== targetId
      );
      return;
    }
    siteData.homeSections = siteData.homeSections.filter((section) => section.id !== targetId);
  }

  function applyMoveComponent(siteData, action) {
    const pageRef = action.page || "home";
    const targetId = action.targetId || action.target;
    if (!targetId) throw new Error("move_component requires targetId");
    const location = findPage(siteData, pageRef);
    const list = location.kind === "page"
      ? location.page.components || []
      : siteData.homeSections;
    const currentIndex = list.findIndex((item) => item.id === targetId);
    if (currentIndex === -1) throw new Error(`Unknown move target: ${targetId}`);
    const [item] = list.splice(currentIndex, 1);
    const insertIndex = resolveInsertIndex(list, action.position);
    list.splice(insertIndex, 0, item);
    if (location.kind === "page") {
      location.page.components = list;
    } else {
      siteData.homeSections = list;
    }
  }

  function applyReorderSections(siteData, action) {
    const pageRef = action.page || "home";
    const order = action.payload?.order;
    if (!Array.isArray(order) || order.length === 0) {
      throw new Error("reorder_sections requires payload.order array");
    }
    if (pageRef !== "home") {
      throw new Error("reorder_sections currently supports home page only");
    }
    const sectionMap = new Map(siteData.homeSections.map((s) => [s.id, s]));
    const reordered = [];
    order.forEach((id) => {
      if (sectionMap.has(id)) { reordered.push(sectionMap.get(id)); sectionMap.delete(id); }
    });
    sectionMap.forEach((section) => reordered.push(section));
    siteData.homeSections = reordered;
  }

  // ── Phase 1 action handlers ───────────────────────────────────────────────────

  function applyUpdateText(siteData, action) {
    const accessor = resolveTextPathAccessor(action.path);
    if (!accessor) throw new Error(`Unknown updateText path: "${action.path}"`);
    accessor.set(siteData, action.value);
  }

  function applyReplaceSection(siteData, action) {
    const sectionId = parseSectionPath(action.path);
    if (!sectionId) throw new Error(`Invalid replaceSection path: "${action.path}"`);
    applyBuiltinSectionUpdate(siteData, sectionId, action.payload);
  }

  function applyAddSection(siteData, action) {
    const section = { ...action.section, visible: action.section.visible !== false };
    const index = resolveInsertIndex(siteData.homeSections, action.position);
    siteData.homeSections.splice(index, 0, section);
  }

  function applyDeleteSection(siteData, action) {
    const sectionId = parseSectionPath(action.path);
    if (!sectionId) throw new Error(`Invalid deleteSection path: "${action.path}"`);
    siteData.homeSections = siteData.homeSections.filter((s) => s.id !== sectionId);
  }

  function applyMoveSection(siteData, action) {
    const sectionId = parseSectionPath(action.path);
    if (!sectionId) throw new Error(`Invalid moveSection path: "${action.path}"`);
    const currentIndex = siteData.homeSections.findIndex((s) => s.id === sectionId);
    if (currentIndex === -1) throw new Error(`Section "${sectionId}" not found`);
    const [section] = siteData.homeSections.splice(currentIndex, 1);
    const insertIndex = resolveInsertIndex(siteData.homeSections, action.position);
    siteData.homeSections.splice(insertIndex, 0, section);
  }

  // ── Per-handler validators for legacy types ───────────────────────────────────

  function _validateComponentPageRef(action, siteData) {
    if (action.page && action.page !== "home" &&
        !(siteData.pages || []).some((p) => p.slug === action.page)) {
      return `Unknown page: ${action.page}`;
    }
    return null;
  }

  function _validateReorderSections(action) {
    if (!action.payload || !Array.isArray(action.payload.order)) {
      return "reorder_sections requires payload.order";
    }
    return null;
  }

  // ── Per-handler validators for Phase 1 types ─────────────────────────────────

  const VALID_UPDATE_TEXT_PATHS = [
    "hero.title", "hero.subtitle", "hero.logo", "hero.image",
    "about.text", "contact.text",
  ];

  function validateUpdateText(action) {
    if (!action.path || typeof action.path !== "string") {
      return "updateText requires a path string";
    }
    if (typeof action.value !== "string") {
      return "updateText requires a string value";
    }
    if (!resolveTextPathAccessor(action.path)) {
      return (
        `Unknown updateText path: "${action.path}". ` +
        `Valid paths: ${VALID_UPDATE_TEXT_PATHS.join(", ")}`
      );
    }
    return null;
  }

  function validateReplaceSection(action) {
    if (!action.path || typeof action.path !== "string") {
      return "replaceSection requires a path string";
    }
    if (!parseSectionPath(action.path)) {
      return `replaceSection path must be sections.<id>, got: "${action.path}"`;
    }
    if (!isObject(action.payload)) {
      return "replaceSection requires a payload object";
    }
    return null;
  }

  function validateAddSection(action, siteData) {
    if (!isObject(action.section)) {
      return "addSection requires a section object";
    }
    const { id, type } = action.section;
    if (!id || typeof id !== "string" || /\s/.test(id)) {
      return "addSection section.id must be a non-empty string with no whitespace";
    }
    if (!type || typeof type !== "string") {
      return "addSection section.type must be a non-empty string";
    }
    if ((siteData.homeSections || []).some((s) => s.id === id)) {
      return `Section with id "${id}" already exists`;
    }
    return null;
  }

  function validateDeleteSection(action, siteData) {
    if (!action.path || typeof action.path !== "string") {
      return "deleteSection requires a path string";
    }
    const sectionId = parseSectionPath(action.path);
    if (!sectionId) {
      return `deleteSection path must be sections.<id>, got: "${action.path}"`;
    }
    if (PROTECTED_SECTIONS.has(sectionId)) {
      return (
        `Cannot delete built-in section: "${sectionId}". ` +
        `Protected sections: ${[...PROTECTED_SECTIONS].join(", ")}`
      );
    }
    if (!(siteData.homeSections || []).some((s) => s.id === sectionId)) {
      return `Section "${sectionId}" not found`;
    }
    return null;
  }

  function validateMoveSection(action, siteData) {
    if (!action.path || typeof action.path !== "string") {
      return "moveSection requires a path string";
    }
    const sectionId = parseSectionPath(action.path);
    if (!sectionId) {
      return `moveSection path must be sections.<id>, got: "${action.path}"`;
    }
    if (!(siteData.homeSections || []).some((s) => s.id === sectionId)) {
      return `Section "${sectionId}" not found`;
    }
    if (!action.position || typeof action.position !== "string") {
      return "moveSection requires a position string";
    }
    return null;
  }

  // ── Action Registry ───────────────────────────────────────────────────────────
  //
  // Each entry: { validate(action, siteData) → string|null, apply(siteData, action) → void }
  // To add a new action type: add one entry here. Nothing else changes.

  const ACTION_REGISTRY = {
    // Legacy types
    [ACTION_TYPES.UPDATE_SECTION]:   { validate: () => null,                     apply: applyUpdateSection },
    [ACTION_TYPES.UPDATE_THEME]:     { validate: () => null,                     apply: applyUpdateTheme },
    [ACTION_TYPES.UPDATE_LAYOUT]:    { validate: () => null,                     apply: applyUpdateLayout },
    [ACTION_TYPES.REWRITE_COPY]:     { validate: () => null,                     apply: applyRewriteCopy },
    [ACTION_TYPES.ADD_COMPONENT]:    { validate: _validateComponentPageRef,      apply: applyAddComponent },
    [ACTION_TYPES.REMOVE_COMPONENT]: { validate: _validateComponentPageRef,      apply: applyRemoveComponent },
    [ACTION_TYPES.MOVE_COMPONENT]:   { validate: _validateComponentPageRef,      apply: applyMoveComponent },
    [ACTION_TYPES.REORDER_SECTIONS]: { validate: _validateReorderSections,       apply: applyReorderSections },
    // Phase 1 typed actions
    [ACTION_TYPES.UPDATE_TEXT]:      { validate: validateUpdateText,             apply: applyUpdateText },
    [ACTION_TYPES.REPLACE_SECTION]:  { validate: validateReplaceSection,         apply: applyReplaceSection },
    [ACTION_TYPES.ADD_SECTION]:      { validate: validateAddSection,             apply: applyAddSection },
    [ACTION_TYPES.DELETE_SECTION]:   { validate: validateDeleteSection,          apply: applyDeleteSection },
    [ACTION_TYPES.MOVE_SECTION]:     { validate: validateMoveSection,            apply: applyMoveSection },
  };

  // ── Core orchestration ────────────────────────────────────────────────────────

  function validateAction(action, siteData) {
    if (!action || typeof action !== "object") return "Action must be an object";
    if (!action.id || typeof action.id !== "string") return "Action must include a string id field";
    const handler = ACTION_REGISTRY[action.type];
    if (!handler) return `Unknown action type: "${action.type}"`;
    return handler.validate(action, siteData);
  }

  function applyOneAction(siteData, action) {
    const handler = ACTION_REGISTRY[action.type];
    if (!handler) throw new Error(`Unsupported action type: "${action.type}"`);
    handler.apply(siteData, action);
  }

  function applyLegacyPatch(siteData, patch, context) {
    const next = clone(siteData);
    if (context?.page && context.page !== "home") {
      const page = (next.pages || []).find((item) => item.slug === context.page);
      if (page && Array.isArray(patch.content)) {
        page.components = [...(page.components || []), ...patch.content];
      }
      return SiteSchema.normalizeSiteData(next);
    }
    Object.assign(next, patch);
    return SiteSchema.normalizeSiteData(next);
  }

  function applyActions(siteData, actions) {
    const normalized = SiteSchema.normalizeSiteData(siteData);
    const next = clone(normalized);
    const applied = [];
    const skipped = [];

    if (!Array.isArray(actions)) {
      return {
        siteData: normalized,
        applied,
        skipped: [{ reason: "Actions must be an array" }]
      };
    }

    actions.forEach((action) => {
      // Auto-generate id for callers that pre-date the id requirement.
      const a = (!action.id && action) ? { ...action, id: generateActionId() } : action;

      const validationError = validateAction(a, next);
      if (validationError) {
        skipped.push({ action: a, reason: validationError });
        return;
      }
      try {
        applyOneAction(next, a);
        applied.push(a);
      } catch (error) {
        skipped.push({ action: a, reason: error.message });
      }
    });

    return {
      siteData: SiteSchema.normalizeSiteData(next),
      applied,
      skipped
    };
  }

  // ── Exports ───────────────────────────────────────────────────────────────────

  global.EditorActions = {
    ACTION_TYPES,
    PROTECTED_SECTIONS,
    generateActionId,
    resolveTextPathAccessor,
    parseSectionPath,
    validateAction,
    applyOneAction,
    applyActions,
    applyLegacyPatch,
  };
})(typeof window !== "undefined" ? window : globalThis);
