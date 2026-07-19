import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import entryDiagnosticData from '../../../assessments/question-banks/entry-diagnostic.json';
import { useProgress } from '../app/ProgressContext';
import { gradeAssessment, type AssessmentAnswer } from '../domain/assessment/gradeAssessment';
import { AssessmentSchema } from '../domain/content/schemas';

const assessments = [AssessmentSchema.parse(entryDiagnosticData)];

export function AssessmentPage() {
  const { assessmentId } = useParams();
  const assessment = assessments.find((item) => item.id === assessmentId);
  const { state, error, recordEvidence } = useProgress();
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string>();

  const initialAnswers = useMemo(() => assessment
    ? Object.fromEntries(assessment.items.map((item) => [item.id, { score: item.maxScore, response: '' }]))
    : {}, [assessment]);

  useEffect(() => { setAnswers(initialAnswers); setPendingIds(null); setMessage(undefined); }, [initialAnswers]);
  useEffect(() => {
    if (!pendingIds) return;
    if (error) { setMessage('保存出现问题，诊断未被标记为完成，请检查后重试。'); setPendingIds(null); return; }
    if (pendingIds.every((id) => state.evidence.some((item) => item.id === id))) {
      setMessage('诊断记录已保存。');
      setPendingIds(null);
    }
  }, [error, pendingIds, state.evidence]);

  if (!assessment) return <section className="page"><h1>没有找到这份测验</h1><p>目前只提供入门诊断，请从学习首页重新进入。</p></section>;

  const updateAnswer = (itemId: string, update: Partial<AssessmentAnswer>) => setAnswers((current) => ({
    ...current,
    [itemId]: { ...current[itemId], ...update },
  }));

  async function submit() {
    if (!assessment || pendingIds) return;
    setMessage(undefined);
    const evidence = gradeAssessment(assessment, answers, new Date().toISOString());
    await Promise.all(evidence.map((record) => recordEvidence(record)));
    setPendingIds(evidence.map((record) => record.id));
  }

  return <section className="page"><h1>入门诊断</h1><p>请如实记录你的回答；开放题的分数是按量表确认的分数。</p>
    {assessment.items.map((item) => <fieldset key={item.id}>
      <legend>{item.prompt}</legend>
      <label>{`${item.id} 得分（满分 ${item.maxScore}）`}<input type="number" min="0" max={item.maxScore} value={answers[item.id]?.score ?? item.maxScore} onChange={(event) => updateAnswer(item.id, { score: Number(event.target.value) })} /></label>
      <label>你的回答<textarea value={answers[item.id]?.response ?? ''} onChange={(event) => updateAnswer(item.id, { response: event.target.value })} /></label>
      <p>评分量表：</p><ul>{item.rubric.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
    </fieldset>)}
    <button type="button" disabled={Boolean(pendingIds)} onClick={() => { void submit(); }}>提交诊断</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
