import { z } from "zod";
import type { Candidate } from "./schemas.js";
import { findingSchema } from "./schemas.js";

const score = z.number().min(0).max(100);

export const sellabilityVerdictSchema = z.enum([
  "NOT_SELLABLE",
  "NEEDS_POLISH",
  "SELLABLE",
  "PREMIUM_CANDIDATE",
]);

export const visualEvaluationSchema = z
  .object({
    version: z.literal(1),
    candidateId: z.string().min(1),
    createdAt: z.string().datetime(),
    status: z.enum(["evaluated", "not-evaluated"]),
    evaluator: z.object({
      kind: z.enum(["llm", "human"]),
      provider: z.string().min(1),
      name: z.string().min(1),
    }),
    referenceSet: z.string().min(1),
    screenshots: z
      .array(
        z.object({
          page: z.string().min(1),
          viewport: z.string().min(1),
          path: z.string().min(1),
        }),
      )
      .default([]),
    scores: z
      .object({
        hierarchy: score,
        typography: score,
        spacing: score,
        composition: score,
        color: score,
        components: score,
        responsive: score,
        motion: score,
        polish: score,
        differentiation: score,
        similarityRisk: score,
      })
      .optional(),
    findings: z.array(findingSchema).default([]),
    strengths: z.array(z.string().min(1)).default([]),
    sellability: z
      .object({
        verdict: sellabilityVerdictSchema,
        rationale: z.string().min(1),
        blockers: z.array(z.string().min(1)).default([]),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "evaluated") {
      if (value.screenshots.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["screenshots"],
          message:
            "An evaluated visual review requires at least one screenshot.",
        });
      }
      if (!value.scores) {
        context.addIssue({
          code: "custom",
          path: ["scores"],
          message: "An evaluated visual review requires criterion scores.",
        });
      }
      if (!value.sellability) {
        context.addIssue({
          code: "custom",
          path: ["sellability"],
          message: "An evaluated visual review requires a sellability verdict.",
        });
      }
    }
  });

export type VisualEvaluation = z.infer<typeof visualEvaluationSchema>;

/**
 * Projects an explicitly subjective review onto the existing Candidate model.
 * Collection/provider concerns stay outside the audit domain; no visual score is
 * presented as browser evidence.
 */
export function applyVisualEvaluation(
  candidate: Candidate,
  evaluation: VisualEvaluation,
): Candidate {
  if (evaluation.candidateId !== candidate.id) {
    throw new Error(
      `Visual evaluation targets ${evaluation.candidateId}, not ${candidate.id}.`,
    );
  }
  if (evaluation.status === "not-evaluated" || !evaluation.scores) {
    return candidate;
  }

  const source = evaluation.evaluator.kind === "llm" ? "llm" : "manual";
  const notes = `Subjective ${evaluation.evaluator.name} review by ${evaluation.evaluator.provider}; reference set ${evaluation.referenceSet}.`;
  const mean = (...values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    ...candidate,
    evaluations: {
      ...candidate.evaluations,
      visual: {
        hierarchy: { score: evaluation.scores.hierarchy, source, notes },
        typography: { score: evaluation.scores.typography, source, notes },
        spacing: { score: evaluation.scores.spacing, source, notes },
        polish: {
          score: mean(
            evaluation.scores.composition,
            evaluation.scores.color,
            evaluation.scores.components,
            evaluation.scores.responsive,
            evaluation.scores.motion,
            evaluation.scores.polish,
          ),
          source,
          notes,
        },
      },
      originality: {
        differentiation: {
          score: evaluation.scores.differentiation,
          source,
          notes,
        },
        similarityRisk: {
          score: evaluation.scores.similarityRisk,
          source,
          notes,
        },
      },
    },
    findings: [...candidate.findings, ...evaluation.findings],
  };
}
