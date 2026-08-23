import { z } from "zod";
import { findingSchema } from "./schemas.js";

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
});
export type InspectionArtifact = z.infer<typeof inspectionArtifactSchema>;

export type InspectOptions = {
  outputDir: string;
  viewports?: Viewport[];
  timeoutMs?: number;
  maxInternalLinks?: number;
  touchTargetMinimum?: number;
};
