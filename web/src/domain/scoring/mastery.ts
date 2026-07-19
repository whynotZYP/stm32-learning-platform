import type { EvidenceRecord, MasteryBand } from '../progress/types';

export interface TagMastery {
  tagId: string;
  score: number;
  band: MasteryBand;
  evidenceIds: string[];
}

const bandFor = (score: number): MasteryBand => {
  if (score >= 85) return 'mastered';
  if (score >= 70) return 'review';
  if (score >= 60) return 'remediate';
  return 'relearn';
};

export function calculateTagMastery(tagId: string, evidence: EvidenceRecord[]): TagMastery {
  const selected = evidence
    .filter((item) => item.tagIds.includes(tagId) && item.status !== 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  if (selected.length === 0) return { tagId, score: 0, band: 'relearn', evidenceIds: [] };

  const weights = [0.5, 0.3, 0.2].slice(0, selected.length);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const score = Math.round(
    selected.reduce((total, item, index) => total + item.score * weights[index], 0) / totalWeight,
  );

  return { tagId, score, band: bandFor(score), evidenceIds: selected.map((item) => item.id) };
}
