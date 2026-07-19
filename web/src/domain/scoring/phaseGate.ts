export interface PhaseGateInput {
  phaseId: number;
  lessonScores: number[];
  practicalScores: number[];
  prerequisiteScores: Record<string, number>;
}

export interface PhaseGateResult {
  phaseId: number;
  passed: boolean;
  phaseAverage: number;
  practicalAverage: number;
  reasons: string[];
}

const average = (values: number[]) => (
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
);

export function evaluatePhaseGate(input: PhaseGateInput): PhaseGateResult {
  const phaseAverage = average(input.lessonScores);
  const practicalAverage = average(input.practicalScores);
  const reasons: string[] = [];

  if (phaseAverage < 75) reasons.push(`闃舵骞冲潎鍒?${phaseAverage}锛岃姹傝嚦灏?75`);
  if (practicalAverage < 70) reasons.push(`瀹炴搷骞冲潎鍒?${practicalAverage}锛岃姹傝嚦灏?70`);

  for (const [tag, score] of Object.entries(input.prerequisiteScores).sort(([a], [b]) => a.localeCompare(b))) {
    if (score < 70) reasons.push(`鍓嶇疆鏍囩 ${tag} 涓?${score}锛岃姹傝嚦灏?70`);
  }

  return { phaseId: input.phaseId, passed: reasons.length === 0, phaseAverage, practicalAverage, reasons };
}
