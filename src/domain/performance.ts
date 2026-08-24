import { z } from "zod";

export const resourceCategorySchema = z.enum([
  "document",
  "script",
  "stylesheet",
  "image",
  "font",
  "media",
  "other",
]);
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;

export const thresholdSchema = z
  .object({
    warningAbove: z.number().nonnegative(),
    errorAbove: z.number().positive(),
  })
  .refine((value) => value.errorAbove > value.warningAbove, {
    message: "errorAbove must be greater than warningAbove",
  });

export const performancePolicySchema = z.object({
  totalTransferBytes: thresholdSchema,
  imageTransferBytes: thresholdSchema,
  javascriptTransferBytes: thresholdSchema,
  fontTransferBytes: thresholdSchema,
  oversizedImageBytes: thresholdSchema,
  oversizedScriptBytes: thresholdSchema,
  domNodes: thresholdSchema,
  lcpMs: thresholdSchema,
});
export type PerformancePolicy = z.infer<typeof performancePolicySchema>;

export const performanceResourceSchema = z.object({
  url: z.string().min(1),
  category: resourceCategorySchema,
  mimeType: z.string().optional(),
  transferBytes: z.number().int().nonnegative(),
  transferStatus: z.enum(["measured", "not-evaluated"]),
  fromCache: z.boolean(),
  thirdParty: z.boolean(),
});
export type PerformanceResource = z.infer<typeof performanceResourceSchema>;

const largestResourceSchema = z.object({
  url: z.string().min(1),
  transferBytes: z.number().int().nonnegative(),
  mimeType: z.string().optional(),
});

const resourceBreakdownSchema = z.object({
  category: resourceCategorySchema,
  count: z.number().int().nonnegative(),
  transferBytes: z.number().int().nonnegative(),
  largestResource: largestResourceSchema.optional(),
});

const imageResourceSchema = largestResourceSchema.extend({
  renderedWidth: z.number().nonnegative().optional(),
  renderedHeight: z.number().nonnegative().optional(),
  intrinsicWidth: z.number().int().nonnegative().optional(),
  intrinsicHeight: z.number().int().nonnegative().optional(),
});

const fontFaceSchema = z.object({
  family: z.string().min(1),
  style: z.string().min(1),
  weight: z.string().min(1),
});

export const lcpEvidenceSchema = z.object({
  viewport: z.string().min(1),
  status: z.enum(["measured", "not-evaluated"]),
  valueMs: z.number().nonnegative().optional(),
  element: z
    .object({
      tag: z.string().min(1),
      selector: z.string().min(1).optional(),
      url: z.string().min(1).optional(),
      text: z.string().min(1).optional(),
    })
    .optional(),
  reason: z.string().min(1).optional(),
  provenance: z.object({
    provider: z.string().min(1),
    check: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
});
export type LcpEvidence = z.infer<typeof lcpEvidenceSchema>;

export const pagePerformanceEvidenceSchema = z.object({
  status: z.enum(["measured", "not-evaluated"]),
  reason: z.string().min(1).optional(),
  resourceViewport: z.string().min(1),
  transfer: z.object({
    status: z.enum(["measured", "not-evaluated"]),
    reason: z.string().min(1).optional(),
    totalRequests: z.number().int().nonnegative(),
    measuredRequests: z.number().int().nonnegative(),
    transferBytes: z.number().int().nonnegative(),
  }),
  resources: z.array(performanceResourceSchema),
  breakdown: z.array(resourceBreakdownSchema),
  images: z.object({
    count: z.number().int().nonnegative(),
    transferBytes: z.number().int().nonnegative(),
    resources: z.array(imageResourceSchema),
  }),
  fonts: z.object({
    count: z.number().int().nonnegative(),
    transferBytes: z.number().int().nonnegative(),
    faces: z.array(fontFaceSchema),
    resources: z.array(largestResourceSchema),
  }),
  javascript: z.object({
    count: z.number().int().nonnegative(),
    transferBytes: z.number().int().nonnegative(),
    resources: z.array(largestResourceSchema),
  }),
  dom: z.object({
    nodes: z.number().int().nonnegative(),
    maxDepth: z.number().int().nonnegative(),
  }),
  lcp: z.array(lcpEvidenceSchema),
  provenance: z.object({
    provider: z.string().min(1),
    check: z.string().min(1),
    confidence: z.number().min(0).max(1),
    cacheDisabled: z.boolean(),
    serviceWorkerBypassed: z.boolean(),
  }),
});
export type PagePerformanceEvidence = z.infer<
  typeof pagePerformanceEvidenceSchema
>;

export const sitePerformanceEvidenceSchema = z.object({
  pages: z.array(
    z.object({
      path: z.string().min(1),
      evidence: pagePerformanceEvidenceSchema,
    }),
  ),
});
export type SitePerformanceEvidence = z.infer<
  typeof sitePerformanceEvidenceSchema
>;

export const performanceSummarySchema = z.object({
  pagesMeasured: z.number().int().nonnegative(),
  transfer: z
    .object({
      averageBytes: z.number().int().nonnegative(),
      worstBytes: z.number().int().nonnegative(),
      worstPage: z.string().min(1),
    })
    .optional(),
  lcp: z.array(
    z.object({
      viewport: z.string().min(1),
      averageMs: z.number().nonnegative(),
      worstMs: z.number().nonnegative(),
      worstPage: z.string().min(1),
      measuredPages: z.number().int().nonnegative(),
      notEvaluatedPages: z.number().int().nonnegative(),
    }),
  ),
  heavyImages: z.number().int().nonnegative(),
  heavyScripts: z.number().int().nonnegative(),
  commonHeavyResources: z.array(
    z.object({
      url: z.string().min(1),
      category: z.enum(["image", "script"]),
      pages: z.array(z.string().min(1)).min(2),
      maxTransferBytes: z.number().int().nonnegative(),
    }),
  ),
});
export type PerformanceSummary = z.infer<typeof performanceSummarySchema>;
