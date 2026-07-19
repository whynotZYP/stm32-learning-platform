import { useState } from 'react';
import { LabManifestSchema, LessonManifestSchema } from '../domain/content/schemas';
import type { LabManifest, LessonManifest } from '../domain/content/types';
import type { EvidenceRecord } from '../domain/progress/types';

export function LabChecklist({ lesson, lab, now = new Date().toISOString(), onConfirm }: {
  lesson: LessonManifest;
  lab: LabManifest;
  now?: string;
  onConfirm: (record: EvidenceRecord) => void;
}) {
  return <LabChecklistForm key={`${lesson.id}:${lab.id}`} lesson={lesson} lab={lab} now={now} onConfirm={onConfirm} />;
}

function LabChecklistForm({ lesson, lab, now, onConfirm }: {
  lesson: LessonManifest;
  lab: LabManifest;
  now: string;
  onConfirm: (record: EvidenceRecord) => void;
}) {
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [observationConfirmed, setObservationConfirmed] = useState(false);
  const [emitted, setEmitted] = useState(false);
  const observation = lab.expectedObservations[0];
  const manualCheck = lab.detectionChecks.find((check) => check.mode === 'manual' && check.applicable && check.evidenceSource === 'manual' && check.physicalHardware);
  const manifestsValid = LessonManifestSchema.safeParse(lesson).success && LabManifestSchema.safeParse(lab).success;
  const matchingLesson = lesson.id === lab.lessonId;
  const safetyAvailable = lab.safety.includes('接线已断电复核');
  const available = manifestsValid && matchingLesson && safetyAvailable && Boolean(manualCheck) && lesson.targetTagIds.length > 0;
  const ready = available && safetyConfirmed && observationConfirmed && !emitted;

  function confirm() {
    if (!ready) return;
    setEmitted(true);
    onConfirm({
      id: `manual-${lab.id}-${now}`,
      learnerId: 'local',
      lessonId: lab.lessonId,
      tagIds: [...lesson.targetTagIds],
      kind: 'practical',
      status: 'manual-confirmed',
      score: 100,
      source: 'manual',
      createdAt: now,
      details: {
        safetyConfirmed: true,
        observation,
        detectionMode: manualCheck!.mode,
        expectedEvidence: manualCheck!.expectedEvidence,
      },
    });
  }

  return <section aria-labelledby={`${lab.id}-title`} className="lab-checklist">
    <h2 id={`${lab.id}-title`}>{lab.title}</h2>
    {!matchingLesson && <p>实验与课程信息不匹配，暂时不能记录。</p>}
    {matchingLesson && !available && <p>此实验暂时不能记录人工观察。</p>}
    <label><input type="checkbox" disabled={!available} checked={safetyConfirmed} onChange={(event) => setSafetyConfirmed(event.target.checked)} />接线已断电复核</label>
    <label><input type="checkbox" disabled={!available} checked={observationConfirmed} onChange={(event) => setObservationConfirmed(event.target.checked)} />{`观察到：${observation}`}</label>
    <button type="button" disabled={!ready} onClick={confirm}>记录实验观察</button>
  </section>;
}
