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

const assertValidScores = (scores: number[], error: string) => {
  if (scores.some((score) => !Number.isFinite(score) || score < 0 || score > 100)) {
    throw new Error(error);
  }
};

export function evaluatePhaseGate(input: PhaseGateInput): PhaseGateResult {
  const prerequisiteEntries = Object.entries(input.prerequisiteScores)
    .sort(([firstTag], [secondTag]) => firstTag.localeCompare(secondTag));

  assertValidScores(input.lessonScores, '课程分数必须是 0 到 100 之间的有限数值');
  assertValidScores(input.practicalScores, '实操分数必须是 0 到 100 之间的有限数值');
  for (const [tag, score] of prerequisiteEntries) {
    assertValidScores([score], `前置标签 ${tag} 的分数必须是 0 到 100 之间的有限数值`);
  }

  const phaseAverage = average(input.lessonScores);
  const practicalAverage = average(input.practicalScores);
  const reasons: string[] = [];

  if (phaseAverage < 75) reasons.push(`阶段平均分 ${phaseAverage}，要求至少 75`);
  if (practicalAverage < 70) reasons.push(`实操平均分 ${practicalAverage}，要求至少 70`);
  for (const [tag, score] of prerequisiteEntries) {
    if (score < 70) reasons.push(`前置标签 ${tag} 为 ${score}，要求至少 70`);
  }

  return { phaseId: input.phaseId, passed: reasons.length === 0, phaseAverage, practicalAverage, reasons };
}
