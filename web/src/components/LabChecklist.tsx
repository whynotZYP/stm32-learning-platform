import { useState } from 'react';
import type { LabManifest } from '../domain/content/types';
import type { EvidenceRecord } from '../domain/progress/types';

export function LabChecklist({ lab, tagIds = [], now = new Date().toISOString(), onConfirm }: {
  lab: LabManifest;
  tagIds?: string[];
  now?: string;
  onConfirm: (record: EvidenceRecord) => void;
}) {
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [observationConfirmed, setObservationConfirmed] = useState(false);
  const [emitted, setEmitted] = useState(false);
  const observation = lab.expectedObservations[0];
  const manualCheck = lab.detectionChecks.find((check) => check.mode === 'manual');
  const ready = safetyConfirmed && observationConfirmed && !emitted;

  function confirm() {
    if (!ready) return;
    setEmitted(true);
    onConfirm({
      id: `manual-${lab.id}-${now}`,
      learnerId: 'local',
      lessonId: lab.lessonId,
      tagIds: [...tagIds],
      kind: 'practical',
      status: 'manual-confirmed',
      score: 100,
      source: 'manual',
      createdAt: now,
      details: {
        safetyConfirmed: true,
        observation,
        detectionMode: manualCheck?.mode ?? 'manual',
        expectedEvidence: manualCheck?.expectedEvidence ?? observation,
      },
    });
  }

  return <section aria-labelledby={`${lab.id}-title`} className="lab-checklist">
    <h2 id={`${lab.id}-title`}>{lab.title}</h2>
    <label><input type="checkbox" checked={safetyConfirmed} onChange={(event) => setSafetyConfirmed(event.target.checked)} />接线已断电复核</label>
    <label><input type="checkbox" checked={observationConfirmed} onChange={(event) => setObservationConfirmed(event.target.checked)} />{`观察到：${observation}`}</label>
    <button type="button" disabled={!ready} onClick={confirm}>记录实验观察</button>
  </section>;
}
