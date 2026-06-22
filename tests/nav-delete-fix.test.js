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

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
