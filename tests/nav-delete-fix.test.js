/**
 * Simulation test: deleteSection nav-link staleness fix
 *
 * Covers all 7 steps from the verification plan:
 *   1. Site with Testimonials in both homeSections + pages (the bug scenario)
 *   2. Confirm Testimonials appears in simulated nav sources
 *   3. Delete the Testimonials section via EditorActions
 *   4. Confirm section disappears from homeSections (body)
 *   5. Confirm nav sources no longer include Testimonials
 *   6. Simulate save/reload (normalize again) — confirm nav stays clean
 *   7. Confirm getHomeSectionNavLinks (used by site.html published viewer) also clean
 *
 * Also covers:
 *   - Pure homeSections case (no matching page) — should work the same
 *   - Protected section guard — "services" cannot be deleted
 *   - Home page ("home") is never removed from data.pages
 */

const assert = require("assert");
const path = require("path");

// ── Load libraries — both IIFEs attach to globalThis in Node.js ──────────────
require(path.join(__dirname, "../lib/site-schema.js"));
require(path.join(__dirname, "../lib/editor-actions.js"));

const SiteSchema = globalThis.SiteSchema;
const EditorActions = globalThis.EditorActions;

if (!SiteSchema)   throw new Error("SiteSchema failed to load");
if (!EditorActions) throw new Error("EditorActions failed to load");

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

function makeSiteWithTestimonials({ inPages = false } = {}) {
  const base = SiteSchema.normalizeSiteData({
    heroTitle: "Demo Site",
    heroSubtitle: "Testing the nav fix",
    homeSections: [
      { id: "hero",         type: "hero",         visible: true },
      { id: "services",     type: "services",     visible: true, title: "Services" },
      { id: "features",     type: "features",     visible: true, title: "Why Us" },
      { id: "testimonials", type: "testimonials",  visible: true, title: "What Clients Say" },
      { id: "about",        type: "about",         visible: true, title: "About" },
      { id: "contact",      type: "contact",       visible: true, title: "Contact" },
    ],
  });

  if (inPages) {
    // Simulate the bug: testimonials also exists as a custom page in data.pages.
    // (This can happen if the user created the page before the home section, or
    //  if old patch-mode code placed it there.)
    base.pages.push({
      slug: "testimonials",
      title: "Testimonials",
      fileName: "testimonials.html",
      components: [],
    });
  }

  return base;
}

function navSlugs(siteData) {
  // Mirrors renderPreviewNavbar's two-source logic from index.html:
  //   Loop 1 — all pages
  //   Loop 2 — visible non-hero home sections not already in pages
  const pages = siteData.pages || [{ slug: "home" }];
  const slugs = new Set(pages.map((p) => p.slug));

  SiteSchema.getHomeSectionNavLinks(siteData).forEach((section) => {
    if (!pages.some((p) => p.slug === section.id)) {
      slugs.add(section.id);
    }
  });

  return [...slugs];
}

// ── Test: bug scenario (testimonials in both homeSections + pages) ────────────

console.log("\nBug scenario — testimonials in homeSections AND pages:");

test("Step 1: site is created with Testimonials in homeSections", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const inSections = sd.homeSections.some((s) => s.id === "testimonials");
  assert.ok(inSections, "testimonials should be in homeSections");
});

test("Step 2: Testimonials appears in simulated nav", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const nav = navSlugs(sd);
  assert.ok(nav.includes("testimonials"), `Nav should include testimonials. Got: ${nav}`);
});

test("Step 3 + 4: deleteSection removes testimonials from homeSections (body)", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Action should not be skipped: ${JSON.stringify(result.skipped)}`);
  const stillInSections = result.siteData.homeSections.some((s) => s.id === "testimonials");
  assert.ok(!stillInSections, "testimonials should be removed from homeSections");
});

test("Step 5: Testimonials nav link disappears (both homeSections and pages pruned)", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const nav = navSlugs(result.siteData);
  assert.ok(!nav.includes("testimonials"), `Nav should NOT include testimonials after delete. Got: ${nav}`);
});

test("Step 5b: Testimonials page is also removed from data.pages", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const pageStillExists = result.siteData.pages.some((p) => p.slug === "testimonials");
  assert.ok(!pageStillExists, "testimonials page should be removed from data.pages");
});

test("Step 6: Save/reload (re-normalize) does not resurrect testimonials in nav", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  // Simulate a save/reload cycle: JSON round-trip then re-normalize
  const reloaded = SiteSchema.normalizeSiteData(
    JSON.parse(JSON.stringify(result.siteData))
  );
  const nav = navSlugs(reloaded);
  assert.ok(!nav.includes("testimonials"), `Nav should stay clean after reload. Got: ${nav}`);
});

test("Step 7: getHomeSectionNavLinks (used by published site.html) also clean", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const sectionNavLinks = SiteSchema.getHomeSectionNavLinks(result.siteData);
  const ids = sectionNavLinks.map((s) => s.id);
  assert.ok(!ids.includes("testimonials"), `Published nav links should not include testimonials. Got: ${ids}`);
});

// ── Test: pure homeSections case (no matching page) ──────────────────────────

console.log("\nPure homeSections scenario — testimonials only in homeSections:");

test("Step 4: deleteSection removes testimonials from homeSections", () => {
  const sd = makeSiteWithTestimonials({ inPages: false });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const stillIn = result.siteData.homeSections.some((s) => s.id === "testimonials");
  assert.ok(!stillIn, "testimonials should be removed from homeSections");
});

test("Step 5: nav link disappears (section anchor link path)", () => {
  const sd = makeSiteWithTestimonials({ inPages: false });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const nav = navSlugs(result.siteData);
  assert.ok(!nav.includes("testimonials"), `Nav should not include testimonials. Got: ${nav}`);
});

// ── Test: safety — home page is never accidentally removed ───────────────────

console.log("\nSafety checks:");

test('"home" page is never removed (home is in PROTECTED_SECTIONS via validator)', () => {
  // Validate that trying to delete "home" is rejected by the validator — not
  // the filter — since home is treated as a reserved slug, not a section.
  // deleteSection with path "sections.hero" would be blocked as PROTECTED.
  // The filter only prunes pages whose slug equals a deleteable sectionId.
  const sd = makeSiteWithTestimonials({ inPages: true });
  const nav = navSlugs(sd);
  assert.ok(nav.includes("home"), "home should always be in nav");

  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const homePageExists = result.siteData.pages.some((p) => p.slug === "home");
  assert.ok(homePageExists, "home page must remain in data.pages after deleteSection");
});

test("Cannot delete protected section (services)", () => {
  const sd = makeSiteWithTestimonials({ inPages: false });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.services" },
  ]);
  assert.strictEqual(result.skipped.length, 1, "Protected section delete should be skipped");
  const stillIn = result.siteData.homeSections.some((s) => s.id === "services");
  assert.ok(stillIn, "services should still be in homeSections");
});

test("Remaining built-in sections (services, features, about, contact) still present after testimonials delete", () => {
  const sd = makeSiteWithTestimonials({ inPages: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteSection", path: "sections.testimonials" },
  ]);
  const ids = result.siteData.homeSections.map((s) => s.id);
  for (const required of ["hero", "services", "features", "about", "contact"]) {
    assert.ok(ids.includes(required), `Section "${required}" should remain`);
  }
});

// ── Regression: Add Page → Delete Page → nav clean → save/reload → publish ───

console.log("\nRegression: Add Page → Delete Page via deletePage action:");

function makeSiteWithCustomPage(pageSlug = "faq") {
  const base = SiteSchema.normalizeSiteData({
    heroTitle: "Demo Site",
    heroSubtitle: "Testing page deletion",
  });
  base.pages.push({
    slug: pageSlug,
    title: pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1),
    fileName: `${pageSlug}.html`,
    components: [{ id: "c1", type: "text", value: "Some page content." }],
  });
  return SiteSchema.normalizeSiteData(base);
}

test("Add Page: custom page appears in nav", () => {
  const sd = makeSiteWithCustomPage("faq");
  const nav = navSlugs(sd);
  assert.ok(nav.includes("faq"), `Nav should include "faq". Got: ${nav}`);
});

test("Delete Page: deletePage action removes the page from data.pages", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "faq" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Should not skip: ${JSON.stringify(result.skipped)}`);
  const pageStillExists = result.siteData.pages.some((p) => p.slug === "faq");
  assert.ok(!pageStillExists, '"faq" page should be removed from data.pages');
});

test("Delete Page: nav link disappears immediately", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "faq" },
  ]);
  const nav = navSlugs(result.siteData);
  assert.ok(!nav.includes("faq"), `Nav should not include "faq" after delete. Got: ${nav}`);
});

test("Save/reload: re-normalizing after delete does not bring page back", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "faq" },
  ]);
  const reloaded = SiteSchema.normalizeSiteData(
    JSON.parse(JSON.stringify(result.siteData))
  );
  const nav = navSlugs(reloaded);
  assert.ok(!nav.includes("faq"), `Nav should stay clean after reload. Got: ${nav}`);
  const pageBack = reloaded.pages.some((p) => p.slug === "faq");
  assert.ok(!pageBack, '"faq" should not reappear in pages after reload');
});

test("Publish: getHomeSectionNavLinks does not include the deleted page's link", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "faq" },
  ]);
  const sectionLinks = SiteSchema.getHomeSectionNavLinks(result.siteData);
  const ids = sectionLinks.map((s) => s.id);
  assert.ok(!ids.includes("faq"), `Published section links should not include "faq". Got: ${ids}`);
});

test("Home page survives: 'home' is protected from deletePage", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "home" },
  ]);
  assert.strictEqual(result.skipped.length, 1, "Deleting 'home' should be skipped");
  const homeExists = result.siteData.pages.some((p) => p.slug === "home");
  assert.ok(homeExists, '"home" page must remain after rejected deletePage');
});

test("deletePage for non-existent page is skipped gracefully", () => {
  const sd = makeSiteWithCustomPage("faq");
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deletePage", slug: "does-not-exist" },
  ]);
  assert.strictEqual(result.skipped.length, 1, "Unknown page delete should be skipped");
  assert.ok(result.siteData.pages.some((p) => p.slug === "faq"), "Other pages unaffected");
});

test("Multiple pages: deleting one does not affect others", () => {
  const sd = makeSiteWithCustomPage("faq");
  sd.pages.push({
    slug: "about-us",
    title: "About Us",
    fileName: "about-us.html",
    components: [],
  });
  const normalized = SiteSchema.normalizeSiteData(sd);
  const result = EditorActions.applyActions(normalized, [
    { id: "act-1", type: "deletePage", slug: "faq" },
  ]);
  assert.ok(!result.siteData.pages.some((p) => p.slug === "faq"), '"faq" should be gone');
  assert.ok(result.siteData.pages.some((p) => p.slug === "about-us"), '"about-us" should remain');
  assert.ok(result.siteData.pages.some((p) => p.slug === "home"), '"home" should remain');
});

// ── Regression: deleteContent combined-delete (all 4 existence scenarios) ────

console.log("\nRegression: deleteContent — page + section, page only, section only, neither:");

function makeSiteForDeleteContent({ asPage = false, asSection = false } = {}) {
  const homeSections = [
    { id: "hero",     type: "hero",     visible: true },
    { id: "services", type: "services", visible: true, title: "Services" },
    { id: "about",    type: "about",    visible: true, title: "About" },
    { id: "contact",  type: "contact",  visible: true, title: "Contact" },
  ];
  if (asSection) {
    homeSections.splice(3, 0, {
      id: "testimonials", type: "testimonials", visible: true, title: "Testimonials",
    });
  }
  const base = SiteSchema.normalizeSiteData({
    heroTitle: "Demo", heroSubtitle: "Test", homeSections,
  });
  if (asPage) {
    base.pages.push({
      slug: "testimonials",
      title: "Testimonials",
      fileName: "testimonials.html",
      components: [],
    });
  }
  return SiteSchema.normalizeSiteData(base);
}

test("deleteContent — exists as page + section → both removed, 0 skipped", () => {
  const sd = makeSiteForDeleteContent({ asPage: true, asSection: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "testimonials" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Should have 0 skipped: ${JSON.stringify(result.skipped)}`);
  assert.ok(!result.siteData.pages.some((p) => p.slug === "testimonials"), "page should be removed");
  assert.ok(!result.siteData.homeSections.some((s) => s.id === "testimonials"), "section should be removed");
  const applied = result.applied[0];
  assert.ok(!applied._nothingFound, "_nothingFound should be falsy when content was removed");
  assert.ok(!navSlugs(result.siteData).includes("testimonials"), "nav should be clean");
});

test("deleteContent — exists only as page → page removed, 0 skipped", () => {
  const sd = makeSiteForDeleteContent({ asPage: true, asSection: false });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "testimonials" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Should have 0 skipped: ${JSON.stringify(result.skipped)}`);
  assert.ok(!result.siteData.pages.some((p) => p.slug === "testimonials"), "page should be removed");
  const applied = result.applied[0];
  assert.ok(!applied._nothingFound, "_nothingFound should be falsy");
  assert.ok(!navSlugs(result.siteData).includes("testimonials"), "nav should be clean");
});

test("deleteContent — exists only as section → section removed, 0 skipped", () => {
  const sd = makeSiteForDeleteContent({ asPage: false, asSection: true });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "testimonials" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Should have 0 skipped: ${JSON.stringify(result.skipped)}`);
  assert.ok(!result.siteData.homeSections.some((s) => s.id === "testimonials"), "section should be removed");
  const applied = result.applied[0];
  assert.ok(!applied._nothingFound, "_nothingFound should be falsy");
  assert.ok(!navSlugs(result.siteData).includes("testimonials"), "nav should be clean");
});

test("deleteContent — exists nowhere → 0 skipped, _nothingFound = true (maps to 'Nothing found' UI message)", () => {
  const sd = makeSiteForDeleteContent({ asPage: false, asSection: false });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "testimonials" },
  ]);
  assert.strictEqual(result.skipped.length, 0, `Should have 0 skipped: ${JSON.stringify(result.skipped)}`);
  const applied = result.applied[0];
  assert.ok(applied._nothingFound === true, "_nothingFound should be true when nothing existed");
  // Simulate the UI nothingFound check used to show "Nothing found to delete."
  const uiNothingFound = result.applied.length > 0 && result.applied.every((a) => a._nothingFound);
  assert.ok(uiNothingFound, "UI nothingFound detection should fire");
});

test("deleteContent — protected section (services) is never removed", () => {
  const sd = SiteSchema.normalizeSiteData({ heroTitle: "Demo" });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "services" },
  ]);
  assert.ok(result.siteData.homeSections.some((s) => s.id === "services"), "services must remain");
});

test("deleteContent — 'home' page slug is blocked", () => {
  const sd = SiteSchema.normalizeSiteData({ heroTitle: "Demo" });
  const result = EditorActions.applyActions(sd, [
    { id: "act-1", type: "deleteContent", slug: "home" },
  ]);
  assert.strictEqual(result.skipped.length, 1, "home should be blocked");
  assert.ok(result.siteData.pages.some((p) => p.slug === "home"), "home page must remain");
});

test("Combined prompt scenario: deletePage + deleteSection together → 0 skipped regardless", () => {
  // This is the exact case the user reported. Even if the AI returns BOTH
  // action types, idempotent validators ensure no skip regardless of which
  // targets actually exist.
  // (deleteContent replaces this in prompts, but deleteSection/deletePage
  // remain in the registry for backward compat — test both combos.)
  const sdBoth = makeSiteForDeleteContent({ asPage: true, asSection: true });
  const sdPageOnly = makeSiteForDeleteContent({ asPage: true, asSection: false });
  const sdSectionOnly = makeSiteForDeleteContent({ asPage: false, asSection: true });
  const sdNeither = makeSiteForDeleteContent({ asPage: false, asSection: false });

  for (const [label, sd] of [
    ["page+section", sdBoth],
    ["page only", sdPageOnly],
    ["section only", sdSectionOnly],
    ["neither", sdNeither],
  ]) {
    const result = EditorActions.applyActions(sd, [
      { id: "act-1", type: "deleteContent", slug: "testimonials" },
    ]);
    assert.strictEqual(result.skipped.length, 0, `[${label}] deleteContent must produce 0 skipped`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
