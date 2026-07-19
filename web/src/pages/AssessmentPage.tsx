import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import entryDiagnosticData from '../../../assessments/question-banks/entry-diagnostic.json';
import { useProgress } from '../app/ProgressContext';
import { gradeAssessment, type AssessmentAnswer } from '../domain/assessment/gradeAssessment';
import { AssessmentSchema } from '../domain/content/schemas';
import type { EvidenceRecord, EvidenceSource, EvidenceStatus } from '../domain/progress/types';

const assessments = [AssessmentSchema.parse(entryDiagnosticData)];
const statusLabel: Record<EvidenceStatus, string> = {
  'auto-pass': '自动通过', 'manual-confirmed': '人工确认', pending: '待确认', failed: '未通过',
};
const sourceLabel: Record<EvidenceSource, string> = {
  assessment: '测验', device: '开发板', manual: '人工记录', note: '笔记',
};

export function AssessmentPage() {
  const { assessmentId } = useParams();
  const assessment = assessments.find((item) => item.id === assessmentId);
  const { recordEvidenceBatch } = useProgress();
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [savedEvidence, setSavedEvidence] = useState<EvidenceRecord[]>([]);
  const mountedRef = useRef(true);
  const initialAnswers = useMemo(() => assessment
    ? Object.fromEntries(assessment.items.map((item) => [item.id, { score: item.maxScore, response: '' }]))
    : {}, [assessment]);

  useEffect(() => { setAnswers(initialAnswers); setSubmitting(false); setMessage(undefined); setSavedEvidence([]); }, [initialAnswers]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  if (!assessment) return <section className="page"><h1>没有找到这份测验</h1><p>目前只提供入门诊断，请从学习首页重新进入。</p></section>;

  const updateAnswer = (itemId: string, update: Partial<AssessmentAnswer>) => setAnswers((current) => ({
    ...current, [itemId]: { ...current[itemId], ...update },
  }));
  async function submit() {
    if (submitting) return;
    setMessage(undefined); setSavedEvidence([]); setSubmitting(true);
    const evidence = gradeAssessment(assessment!, answers, new Date().toISOString());
    const saved = await recordEvidenceBatch(evidence);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (saved) { setSavedEvidence(evidence); setMessage('诊断记录已保存。'); }
    else setMessage('保存出现问题，诊断未被标记为完成，请检查后重试。');
  }
  return <section className="page"><h1>入门诊断</h1><p>请如实记录你的回答；开放题的分数是按量表确认的分数。</p>
    {assessment.items.map((item) => <fieldset key={item.id}><legend>{item.prompt}</legend>
      <label>{`${item.id} 得分（满分 ${item.maxScore}）`}<input type="number" min="0" max={item.maxScore} value={answers[item.id]?.score ?? item.maxScore} onChange={(event) => updateAnswer(item.id, { score: Number(event.target.value) })} /></label>
      <label>你的回答<textarea value={answers[item.id]?.response ?? ''} onChange={(event) => updateAnswer(item.id, { response: event.target.value })} /></label>
      <p>评分量表：</p><ul>{item.rubric.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
    </fieldset>)}
    <button type="button" disabled={submitting} onClick={() => { void submit(); }}>提交诊断</button>
    {message && <section role="status" aria-live="polite"><p>{message}</p>{savedEvidence.length > 0 && <ul aria-label="本次保存的证据">{savedEvidence.map((record) => <li key={record.id}>{`${record.id}：来源：${sourceLabel[record.source]}；状态：${statusLabel[record.status]}`}</li>)}</ul>}</section>}
  </section>;
}
