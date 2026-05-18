import { docsPages } from "./site";

export const docsPrimarySlugs = [
  "getting-started", "installation", "migration-notes",
  "known-differences", "parsing", "invalid-dates", "timezone-parsezone", "lite-usage",
];

export type DocsSidebarPage = {
  slug: string;
  title: string;
};

export type DocsSidebarGroup = {
  label: string;
  pages: DocsSidebarPage[];
};

export function getDocsSidebarGroups(includeOverview = false): DocsSidebarGroup[] {
  const groups: DocsSidebarGroup[] = [];

  if (includeOverview) {
    groups.push({ label: "Overview", pages: [{ slug: "", title: "Docs Home" }] });
  }

  groups.push(
    { label: "Start Here", pages: docsPages.filter((page) => docsPrimarySlugs.includes(page.slug)) },
    { label: "Reference Paths", pages: docsPages.filter((page) => !docsPrimarySlugs.includes(page.slug)) },
  );

  return groups;
}
