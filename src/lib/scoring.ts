import type { CareerCluster, SectionWithQuestions } from "./types";

export interface ClusterScore {
  cluster: CareerCluster;
  total: number;
  max: number;
  percent: number;
}

/**
 * Score = sum over questions of (rating × weight for that cluster).
 * Max possible = sum over questions of (5 × weight for that cluster).
 */
export function computeScores(
  sections: SectionWithQuestions[],
  answers: Record<string, number>, // question_id -> rating 1..5
  clusters: CareerCluster[],
): ClusterScore[] {
  const totals: Record<string, number> = {};
  const maxes: Record<string, number> = {};
  clusters.forEach((c) => {
    totals[c.id] = 0;
    maxes[c.id] = 0;
  });

  sections.forEach((sec) => {
    sec.questions.forEach((q) => {
      const rating = answers[q.id] ?? 0;
      clusters.forEach((c) => {
        const w = q.weights[c.id] ?? 0;
        totals[c.id] += rating * w;
        maxes[c.id] += 5 * w;
      });
    });
  });

  return clusters
    .map((c) => {
      const total = totals[c.id];
      const max = maxes[c.id] || 1;
      return { cluster: c, total, max, percent: Math.round((total / max) * 100) };
    })
    .sort((a, b) => b.total - a.total);
}

export function generateInsights(ranked: ClusterScore[]): string[] {
  // Hand-tuned insights for the original career clusters. For any other
  // category (learning style, personality trait, etc.) we fall back to a
  // generic, encouraging line built from the cluster's name and description.
  const tips: Record<string, string> = {
    "Science & Engineering":
      "You're highly analytical — careers in research, medicine, or engineering would suit you well.",
    "Helping & People":
      "You draw energy from supporting others. Teaching, counselling, or healthcare could be a great fit.",
    "Practical & Hands-on":
      "You learn by doing. Trades, culinary arts, agriculture, and aviation are worth exploring.",
    "Creative & Expressive":
      "Your imagination is a strength. Look at design, writing, music, or media production.",
    "Leadership & Communication":
      "You inspire others. Law, business, politics, and journalism reward strong communicators like you.",
    "Technology & Innovation":
      "You think in systems. Software, data, AI, and product roles would let you build the future.",
  };
  return ranked.slice(0, 3).map((c) => {
    if (tips[c.cluster.name]) return tips[c.cluster.name];
    const desc = c.cluster.description?.trim();
    if (desc) return `${c.cluster.name} stands out for you — ${desc}`;
    return `Your strength in ${c.cluster.name} stands out.`;
  });
}
