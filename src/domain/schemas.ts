import { z } from "zod";

export const severitySchema = z.enum(["info", "warning", "error", "critical"]);
export type Severity = z.infer<typeof severitySchema>;

export const verdictSchema = z.enum([
  "REJECTED",
  "NEEDS_WORK",
  "READY",
  "PREMIUM",
]);
export type Verdict = z.infer<typeof verdictSchema>;

export const axisIdSchema = z.enum([
  "visual",
  "technical",
  "responsive",
  "customization",
  "originality",
  "packaging",
]);
export type AxisId = z.infer<typeof axisIdSchema>;

export const scoreSourceSchema = z.enum([
  "manual",
  "automated",
  "llm",
  "imported",
]);

const scoreSchema = z.number().min(0).max(100);

export const criterionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
  minimum: scoreSchema.optional(),
  description: z.string().min(1),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const axisSchema = z.object({
  id: axisIdSchema,
  name: z.string().min(1),
  weight: z.number().positive(),
  minimum: scoreSchema.optional(),
  criteria: z.array(criterionSchema).min(1),
});
export type QualityAxis = z.infer<typeof axisSchema>;

export const gateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["automated", "manual", "not_evaluated"]),
  severity: severitySchema,
  condition: z.object({
    kind: z.enum(["candidateFlag", "axisMinimum", "criterionMinimum"]),
    path: z.string().min(1).optional(),
    axis: axisIdSchema.optional(),
    criterion: z.string().min(1).optional(),
    minimum: scoreSchema.optional(),
    expected: z.boolean().optional(),
  }),
});
export type QualityGate = z.infer<typeof gateSchema>;

export const standardSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  scope: z.string().min(1),
  metadata: z.object({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    notes: z.string().optional(),
  }),
  thresholds: z.object({
    rejectedBelow: scoreSchema,
    needsWorkBelow: scoreSchema,
    readyBelow: scoreSchema,
    premiumAtLeast: scoreSchema,
  }),
  axes: z.array(axisSchema).min(1),
  gates: z.array(gateSchema),
});
export type QualityStandard = z.infer<typeof standardSchema>;

export const findingSchema = z.object({
  id: z.string().min(1),
  criterion: z.string().min(1).optional(),
  severity: severitySchema,
  message: z.string().min(1),
  evidence: z.string().min(1).optional(),
  suggestedFix: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
});
export type AuditFinding = z.infer<typeof findingSchema>;

const criterionEvaluationSchema = z.object({
  score: scoreSchema,
  source: scoreSourceSchema,
  notes: z.string().optional(),
});

export const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("framer-template"),
  metadata: z.object({
    author: z.string().optional(),
    version: z.string().optional(),
    auditedAt: z.string().optional(),
    notes: z.string().optional(),
  }),
  pages: z.array(z.string().min(1)).min(1),
  breakpoints: z.array(z.string().min(1)).min(1),
  components: z.array(z.string().min(1)).default([]),
  cms: z.object({
    used: z.boolean(),
    collections: z.array(z.string().min(1)).default([]),
  }),
  assets: z.object({
    total: z.number().int().nonnegative(),
    missingRequired: z.number().int().nonnegative(),
  }),
  flags: z.record(z.string(), z.boolean()).default({}),
  evaluations: z.record(
    axisIdSchema,
    z.record(z.string(), criterionEvaluationSchema),
  ),
  findings: z.array(findingSchema).default([]),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const benchmarkReferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  type: z.enum(["technical", "visual", "commercial", "advanced", "mixed"]),
  url: z.string().url().optional(),
  tags: z.array(z.string().min(1)).default([]),
  licenseOrUsage: z.string().min(1),
  analyzedAt: z.string().min(1),
  notes: z.string().min(1),
  derivedCriteria: z.array(z.string().min(1)).default([]),
});
export type BenchmarkReference = z.infer<typeof benchmarkReferenceSchema>;
