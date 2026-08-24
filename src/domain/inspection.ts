import { z } from "zod";
import {
  pagePerformanceEvidenceSchema,
  sitePerformanceEvidenceSchema,
} from "./performance.js";
import { type AuditFinding, findingSchema } from "./schemas.js";

export const viewportSchema = z.object({
  id: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Viewport = z.infer<typeof viewportSchema>;

export const defaultViewports: Viewport[] = [
  { id: "desktop", width: 1440, height: 1100 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 390, height: 844 },
];

export const inspectionArtifactSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  target: z.object({
    inputUrl: z.string().url(),
    finalUrl: z.string().url().optional(),
  }),
  provider: z.object({
    name: z.string().min(1),
    version: z.string().min(1).optional(),
  }),
  page: z.object({
    title: z.string(),
    status: z.number().int().optional(),
    navigationMs: z.number().nonnegative(),
    redirects: z.array(z.string().url()).default([]),
  }),
  viewports: z.array(
    viewportSchema.extend({
      screenshotPath: z.string().min(1),
      scrollWidth: z.number().int().nonnegative(),
      clientWidth: z.number().int().nonnegative(),
      bodyWidth: z.number().nonnegative(),
    }),
  ),
  checks: z.object({
    linksChecked: z.number().int().nonnegative(),
    brokenInternalLinks: z.number().int().nonnegative(),
    brokenAnchors: z.number().int().nonnegative(),
    brokenImages: z.number().int().nonnegative(),
    consoleErrors: z.number().int().nonnegative(),
    pageErrors: z.number().int().nonnegative(),
    networkFailures: z.number().int().nonnegative(),
    badHttpResponses: z.number().int().nonnegative(),
    accessibilityViolations: z.number().int().nonnegative(),
    seriousAccessibilityViolations: z.number().int().nonnegative(),
    smallTouchTargets: z.number().int().nonnegative(),
    horizontalOverflowViewports: z.number().int().nonnegative(),
  }),
  console: z.array(
    z.object({
      type: z.string().min(1),
      text: z.string(),
      location: z.string().optional(),
    }),
  ),
  network: z.object({
    failedRequests: z.array(
      z.object({
        url: z.string().min(1),
        method: z.string().min(1),
        resourceType: z.string().min(1),
        errorText: z.string().optional(),
      }),
    ),
    badResponses: z.array(
      z.object({
        url: z.string().min(1),
        status: z.number().int(),
        resourceType: z.string().min(1),
      }),
    ),
  }),
  findings: z.array(findingSchema),
  performance: pagePerformanceEvidenceSchema.optional(),
});
export type InspectionArtifact = z.infer<typeof inspectionArtifactSchema>;

export type InspectOptions = {
  outputDir: string;
  viewports?: Viewport[];
  timeoutMs?: number;
  maxInternalLinks?: number;
  touchTargetMinimum?: number;
};

export const siteBudgetSchema = z.object({
  maxPages: z.number().int().positive(),
  maxDepth: z.number().int().min(0).max(1),
  maxLinksPerPage: z.number().int().positive(),
  timeoutMsPerPage: z.number().int().positive(),
});
export type SiteBudget = z.infer<typeof siteBudgetSchema>;

export const defaultSiteBudget: SiteBudget = {
  maxPages: 5,
  maxDepth: 1,
  maxLinksPerPage: 20,
  timeoutMsPerPage: 15_000,
};

/**
 * Routes that carry the most commercial weight in a sellable template.
 * Discovery never assumes they exist; it only prioritizes them when found.
 */
export const priorityRoutes = [
  "/pricing",
  "/about",
  "/contact",
  "/blog",
  "/services",
  "/work",
  "/portfolio",
];

/**
 * Pick which same-origin paths to inspect from the links discovered on the
 * root page. Pure and deterministic: dedupe, drop the root itself, rank
 * priority routes first (then shortest paths), cap at maxPages - 1 because
 * the root page is always inspected.
 */
export function selectRoutes(
  discoveredPaths: string[],
  budget: Pick<SiteBudget, "maxPages"> & Partial<Pick<SiteBudget, "maxDepth">>,
): string[] {
  if (budget.maxDepth === 0) return [];
  const unique = [
    ...new Map(
      discoveredPaths
        .filter((path) => path !== "/" && path.length > 1)
        .map((path) => [normalizedRoute(path), path]),
    ).values(),
  ];
  const rank = (path: string) => {
    const priority = priorityRoutes.indexOf(normalizedRoute(path));
    return priority === -1 ? priorityRoutes.length : priority;
  };
  return unique
    .sort(
      (a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b),
    )
    .slice(0, Math.max(0, budget.maxPages - 1));
}

function normalizedRoute(path: string): string {
  const normalized = path
    .replace(/\/index\.html$/i, "")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "");
  return normalized || "/";
}

export const sitePageSchema = z.object({
  slug: z.string().min(1),
  path: z.string().min(1),
  url: z.string().url(),
  status: z.enum(["inspected", "failed"]),
  artifactPath: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});
export type SitePage = z.infer<typeof sitePageSchema>;

export const siteInspectionArtifactSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  target: z.object({
    inputUrl: z.string().url(),
    finalUrl: z.string().url().optional(),
  }),
  title: z.string().default(""),
  provider: z.object({
    name: z.string().min(1),
    version: z.string().min(1).optional(),
  }),
  budget: siteBudgetSchema,
  discovery: z.object({
    considered: z.number().int().nonnegative(),
    selected: z.array(z.string().min(1)),
  }),
  summary: z
    .object({
      discovered: z.number().int().nonnegative(),
      inspected: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    })
    .optional(),
  pages: z.array(sitePageSchema).min(1),
  checks: inspectionArtifactSchema.shape.checks,
  findings: z.array(findingSchema),
  performance: sitePerformanceEvidenceSchema.optional(),
});
export type SiteInspectionArtifact = z.infer<
  typeof siteInspectionArtifactSchema
>;

export type SiteInspectOptions = InspectOptions & {
  budget?: Partial<SiteBudget>;
};

export function dedupeFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.page ?? ""}:${finding.id}:${finding.evidence ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
