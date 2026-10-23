import type { HeroImageAsset } from "@/lib/site-image";

/** Keeps a hero image scoped to the project or draft that produced/loaded it. */
export type ProjectHeroImageState = {
  projectId: string | null;
  image: HeroImageAsset | null;
};

/** Never expose an image to another active project while project state changes. */
export function heroImageForProject(state: ProjectHeroImageState, projectId: string | null): HeroImageAsset | null {
  return state.projectId === projectId ? state.image : null;
}
