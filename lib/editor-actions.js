(function (global) {
  const SiteSchema = global.SiteSchema;

  const ACTION_TYPES = {
    UPDATE_SECTION: "update_section",
    ADD_COMPONENT: "add_component",
    REMOVE_COMPONENT: "remove_component",
    MOVE_COMPONENT: "move_component",
    UPDATE_THEME: "update_theme",
    UPDATE_LAYOUT: "update_layout",
    REWRITE_COPY: "rewrite_copy",
    REORDER_SECTIONS: "reorder_sections"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function findHomeSectionIndex(siteData, targetId) {
    return siteData.homeSections.findIndex((section) => section.id === targetId);
  }

  function findPage(siteData, pageRef) {
    if (pageRef === "home") {
      return { kind: "home", page: null };
    }

    const page = (siteData.pages || []).find((item) => item.slug === pageRef);
    if (!page) {
      throw new Error(`Unknown page: ${pageRef}`);
    }

    return { kind: "page", page };
  }

  function resolveInsertIndex(items, position) {
    if (!position || position === "end") {
      return items.length;
    }

    if (position === "start") {
      return 0;
    }

    const beforeMatch = /^before:(.+)$/.exec(position);
    if (beforeMatch) {
      const index = items.findIndex((item) => item.id === beforeMatch[1]);
      if (index === -1) {
        throw new Error(`Unknown before target: ${beforeMatch[1]}`);
      }
      return index;
    }

    const afterMatch = /^after:(.+)$/.exec(position);
    if (afterMatch) {
      const index = items.findIndex((item) => item.id === afterMatch[1]);
      if (index === -1) {
        throw new Error(`Unknown after target: ${afterMatch[1]}`);
      }
      return index + 1;
    }

    throw new Error(`Invalid position: ${position}`);
  }

  function applyBuiltinSectionUpdate(siteData, target, payload) {
    if (target === "hero") {
      if (payload.heroTitle !== undefined) {
        siteData.heroTitle = payload.heroTitle;
      }
      if (payload.heroSubtitle !== undefined) {
        siteData.heroSubtitle = payload.heroSubtitle;
      }
      if (payload.logoUrl !== undefined) {
        siteData.logoUrl = payload.logoUrl;
      }
      if (payload.heroImageUrl !== undefined) {
        siteData.heroImageUrl = payload.heroImageUrl;
      }
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
    if (sectionIndex === -1) {
      throw new Error(`Unknown section target: ${target}`);
    }

    siteData.homeSections[sectionIndex] = {
      ...siteData.homeSections[sectionIndex],
      ...payload
    };
  }

  function applyUpdateSection(siteData, action) {
    if (!action.target) {
      throw new Error("update_section requires target");
    }
    if (!isObject(action.payload)) {
      throw new Error("update_section requires payload object");
    }

    applyBuiltinSectionUpdate(siteData, action.target, action.payload);
  }

  function applyUpdateTheme(siteData, action) {
    if (!isObject(action.payload)) {
      throw new Error("update_theme requires payload object");
    }
    siteData.theme = { ...siteData.theme, ...action.payload };
  }

  function applyUpdateLayout(siteData, action) {
    if (!isObject(action.payload)) {
      throw new Error("update_layout requires payload object");
    }
    siteData.layout = { ...siteData.layout, ...action.payload };
  }

  function applyRewriteCopy(siteData, action) {
    if (!action.target) {
      throw new Error("rewrite_copy requires target");
    }
    if (!isObject(action.payload)) {
      throw new Error("rewrite_copy requires payload object");
    }

    if (action.target.startsWith("page:")) {
      const slug = action.target.slice(5);
      const page = (siteData.pages || []).find((item) => item.slug === slug);
      if (!page) {
        throw new Error(`Unknown page target: ${slug}`);
      }
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
      if (!Array.isArray(location.page.components)) {
        location.page.components = [];
      }
      const index = resolveInsertIndex(
        location.page.components,
        action.position
      );
      location.page.components.splice(index, 0, component);
      return;
    }

    const index = resolveInsertIndex(siteData.homeSections, action.position);
    siteData.homeSections.splice(index, 0, {
      ...component,
      visible: component.visible !== false
    });
  }

  function applyRemoveComponent(siteData, action) {
    const pageRef = action.page || "home";
    const targetId = action.targetId || action.target;

    if (!targetId) {
      throw new Error("remove_component requires targetId");
    }

    const location = findPage(siteData, pageRef);

    if (location.kind === "page") {
      location.page.components = (location.page.components || []).filter(
        (component) => component.id !== targetId
      );
      return;
    }

    siteData.homeSections = siteData.homeSections.filter(
      (section) => section.id !== targetId
    );
  }

  function applyMoveComponent(siteData, action) {
    const pageRef = action.page || "home";
    const targetId = action.targetId || action.target;
    const location = findPage(siteData, pageRef);

    if (!targetId) {
      throw new Error("move_component requires targetId");
    }

    const list =
      location.kind === "page"
        ? location.page.components || []
        : siteData.homeSections;

    const currentIndex = list.findIndex((item) => item.id === targetId);
    if (currentIndex === -1) {
      throw new Error(`Unknown move target: ${targetId}`);
    }

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

    const sectionMap = new Map(
      siteData.homeSections.map((section) => [section.id, section])
    );
    const reordered = [];

    order.forEach((id) => {
      if (sectionMap.has(id)) {
        reordered.push(sectionMap.get(id));
        sectionMap.delete(id);
      }
    });

    sectionMap.forEach((section) => reordered.push(section));
    siteData.homeSections = reordered;
  }

  function validateAction(action, siteData) {
    if (!action || typeof action !== "object") {
      return "Action must be an object";
    }

    if (!action.type || !Object.values(ACTION_TYPES).includes(action.type)) {
      return `Unknown action type: ${action.type}`;
    }

    if (
      action.type === ACTION_TYPES.REORDER_SECTIONS &&
      (!action.payload || !Array.isArray(action.payload.order))
    ) {
      return "reorder_sections requires payload.order";
    }

    if (
      (action.type === ACTION_TYPES.ADD_COMPONENT ||
        action.type === ACTION_TYPES.REMOVE_COMPONENT ||
        action.type === ACTION_TYPES.MOVE_COMPONENT) &&
      action.page &&
      action.page !== "home" &&
      !(siteData.pages || []).some((page) => page.slug === action.page)
    ) {
      return `Unknown page: ${action.page}`;
    }

    return null;
  }

  function applyOneAction(siteData, action) {
    switch (action.type) {
      case ACTION_TYPES.UPDATE_SECTION:
        applyUpdateSection(siteData, action);
        break;
      case ACTION_TYPES.UPDATE_THEME:
        applyUpdateTheme(siteData, action);
        break;
      case ACTION_TYPES.UPDATE_LAYOUT:
        applyUpdateLayout(siteData, action);
        break;
      case ACTION_TYPES.REWRITE_COPY:
        applyRewriteCopy(siteData, action);
        break;
      case ACTION_TYPES.ADD_COMPONENT:
        applyAddComponent(siteData, action);
        break;
      case ACTION_TYPES.REMOVE_COMPONENT:
        applyRemoveComponent(siteData, action);
        break;
      case ACTION_TYPES.MOVE_COMPONENT:
        applyMoveComponent(siteData, action);
        break;
      case ACTION_TYPES.REORDER_SECTIONS:
        applyReorderSections(siteData, action);
        break;
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
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
      const validationError = validateAction(action, next);
      if (validationError) {
        skipped.push({ action, reason: validationError });
        return;
      }

      try {
        applyOneAction(next, action);
        applied.push(action);
      } catch (error) {
        skipped.push({ action, reason: error.message });
      }
    });

    return {
      siteData: SiteSchema.normalizeSiteData(next),
      applied,
      skipped
    };
  }

  global.EditorActions = {
    ACTION_TYPES,
    validateAction,
    applyOneAction,
    applyActions,
    applyLegacyPatch
  };
})(typeof window !== "undefined" ? window : globalThis);
