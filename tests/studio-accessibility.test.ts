import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FashionEditor } from "@/components/fashion-editor";
import { PreviewLayoutControls } from "@/components/website-preview";
import { RealEstateEditor } from "@/components/real-estate-editor";
import { RestaurantEditor } from "@/components/restaurant-editor";
import type { FashionContent, RealEstateContent, RestaurantContent } from "@/lib/site-templates";

function expectUniqueEditorIdsAndAssociations(markup: string) {
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const idSet = new Set(ids);
  expect(ids.length).toBeGreaterThan(0);
  expect(idSet.size).toBe(ids.length);

  const labelTargets = [...markup.matchAll(/\bfor="([^"]+)"/g)].map((match) => match[1]);
  expect(labelTargets.length).toBeGreaterThan(0);
  expect(labelTargets.every((target) => idSet.has(target))).toBe(true);

  const describedByTargets = [...markup.matchAll(/\baria-describedby="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/\s+/));
  expect(describedByTargets.length).toBeGreaterThan(0);
  expect(describedByTargets.every((target) => idSet.has(target))).toBe(true);
}

describe("Studio rendered accessibility", () => {
  it("keeps labels and validation messages associated across two Restaurant editors", () => {
    const invalidContent = {
      menuHighlights: [
        { name: "", description: "Slow-grilled and seasoned with local spices." },
        { name: "Jollof rice", description: "A warmly spiced rice dish." },
      ],
    } as unknown as RestaurantContent;
    const onChange = () => {};
    const markup = renderToStaticMarkup(createElement(Fragment, null,
      createElement(RestaurantEditor, { pageId: "home", content: invalidContent, onChange }),
      createElement(RestaurantEditor, { pageId: "services", content: invalidContent, onChange }),
    ));

    expectUniqueEditorIdsAndAssociations(markup);
    expect(markup).toContain('id="home-restaurant-menu-name-0-error"');
    expect(markup).toContain('id="services-restaurant-menu-name-0-error"');
  });

  it("keeps labels and validation messages associated across two Fashion editors", () => {
    const invalidContent = {
      collectionHighlights: [
        { name: "", description: "Considered pieces for everyday dressing." },
        { name: "Evening edit", description: "A refined direction for after-dark looks." },
      ],
    } as unknown as FashionContent;
    const onChange = () => {};
    const markup = renderToStaticMarkup(createElement(Fragment, null,
      createElement(FashionEditor, { pageId: "home", content: invalidContent, onChange }),
      createElement(FashionEditor, { pageId: "products", content: invalidContent, onChange }),
    ));

    expectUniqueEditorIdsAndAssociations(markup);
    expect(markup).toContain('id="home-fashion-collection-name-0-error"');
    expect(markup).toContain('id="products-fashion-collection-name-0-error"');
  });

  it("keeps labels and validation messages associated across two Real Estate editors", () => {
    const invalidContent = {
      featuredProperties: [
        { name: "", description: "A considered home in a quiet neighborhood." },
        { name: "Garden residence", description: "Designed around natural light and outdoor space." },
      ],
    } as unknown as RealEstateContent;
    const onChange = () => {};
    const markup = renderToStaticMarkup(createElement(Fragment, null,
      createElement(RealEstateEditor, { pageId: "home", content: invalidContent, onChange }),
      createElement(RealEstateEditor, { pageId: "services", content: invalidContent, onChange }),
    ));

    expectUniqueEditorIdsAndAssociations(markup);
    expect(markup).toContain('id="home-real-estate-property-name-0-error"');
    expect(markup).toContain('id="services-real-estate-property-name-0-error"');
  });

  it("names the preview layout controls and exposes the selected layout", () => {
    const editorial = renderToStaticMarkup(createElement(PreviewLayoutControls, {
      layout: "editorial",
      onLayoutChange: () => {},
    }));
    expect(editorial).toContain('role="group" aria-label="Preview layout"');
    expect(editorial).toContain('aria-label="Editorial layout" aria-pressed="true"');
    expect(editorial).toContain('aria-label="Split layout" aria-pressed="false"');
    expect(editorial).toContain("▤");
    expect(editorial).toContain("▥");

    const split = renderToStaticMarkup(createElement(PreviewLayoutControls, {
      layout: "split",
      onLayoutChange: () => {},
    }));
    expect(split).toContain('aria-label="Editorial layout" aria-pressed="false"');
    expect(split).toContain('aria-label="Split layout" aria-pressed="true"');
  });

  it("scopes reduced-motion rules to Studio motion and preserves readable status text", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const reducedMotion = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*$/)?.[0];

    expect(reducedMotion).toBeDefined();
    expect(reducedMotion).toContain("html { scroll-behavior: auto; }");
    expect(reducedMotion).toContain(".spinner, .loading-orbit, .loading-track i { animation: none; }");
    expect(reducedMotion).toContain(".style-option, .generate-button { transition: none; }");
    expect(reducedMotion).not.toMatch(/(^|[,\s])\*\s*\{/);
    expect(readFileSync(resolve(process.cwd(), "components/website-preview.tsx"), "utf8"))
      .toContain("Putting the finishing touches on your page…");
  });
});
