import { Link } from 'react-router-dom';
import { useProgress } from '../app/ProgressContext';
import { loadCourseMap } from '../domain/content/loadCourseMap';
import { buildDiagnosticPath } from '../domain/diagnostic/buildDiagnosticPath';
import { buildResumePlan } from '../domain/diagnostic/buildResumePlan';
import { calculateTagMastery } from '../domain/scoring/mastery';

const diagnosticTagIds = ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory', 'gpio.output-mode'];

export function DashboardPage() {
  const { error, loading, state, setCurrentWeek } = useProgress();

  if (loading) return <section className="page"><h1>正在准备你的学习计划</h1><p>正在读取保存在这台设备上的学习进度。</p></section>;
  if (error) return <section className="page"><h1>无法读取学习进度</h1><p className="status status--danger">{error}</p></section>;

  const mastery = [...new Set([...diagnosticTagIds, ...state.evidence.flatMap((item) => item.tagIds)])]
    .map((tagId) => calculateTagMastery(tagId, state.evidence));
  const diagnostic = buildDiagnosticPath(mastery);
  const resume = buildResumePlan(state, mastery, new Date().toISOString());
  const week = loadCourseMap().weeks[state.currentWeek - 1];
  return <section className="page"><h1>今天从这里开始</h1><p>{`当前：第 ${week.week} 周 · ${week.title}`}</p><Link className="button-link" to={`/week/${week.week}`}>继续学习</Link>
    <section aria-label="起点建议"><h2>起点建议</h2><p>{diagnostic.reasons[0]}</p>{diagnostic.validationTaskIds.map((id) => <p key={id}>{id}</p>)}<button type="button" onClick={() => { void setCurrentWeek(diagnostic.recommendedWeek); }}>{`采用第 ${diagnostic.recommendedWeek} 周建议`}</button></section>
    {resume.needsRecall && <section aria-label="恢复建议"><h2>恢复建议</h2><p>{`离开超过 7 天，先用 ${resume.durationMinutes} 分钟复习：${resume.recallTagIds.join('、') || '已掌握标签'}。`}</p></section>}
  </section>;
}
