import { Link } from 'react-router-dom';
import { useProgress } from '../app/ProgressContext';
import { loadCourseMap } from '../domain/content/loadCourseMap';
import { buildRemediationQueue } from '../domain/remediation/buildRemediationQueue';
import { calculateTagMastery, type TagMastery } from '../domain/scoring/mastery';
import { evaluatePhaseGate } from '../domain/scoring/phaseGate';

const phaseOnePrerequisites = ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory', 'gpio.output-mode'];
const bandLabel: Record<TagMastery['band'], string> = {
  mastered: '已掌握', review: '建议复习', remediate: '需要补强', relearn: '需要重新学习',
};

export function KnowledgeReportPage() {
  const { error, loading, state } = useProgress();
  if (loading) return <section className="page"><h1>正在准备知识报告</h1><p>正在读取保存在这台设备上的学习证据。</p></section>;
  if (error) return <section className="page"><h1>无法读取知识报告</h1><p className="status status--danger">{error}</p></section>;

  const courseMap = loadCourseMap();
  const phaseOneLessonIds = courseMap.weeks.filter((week) => week.phase === 1).flatMap((week) => week.lessonIds);
  const phaseEvidence = state.evidence.filter((record) => phaseOneLessonIds.includes(record.lessonId));
  const tagIds = [...new Set([...phaseOnePrerequisites, ...state.evidence.flatMap((record) => record.tagIds)])];
  const mastery = tagIds.map((tagId) => calculateTagMastery(tagId, state.evidence));
  const prerequisiteScores = Object.fromEntries(phaseOnePrerequisites.map((tagId) => [tagId, mastery.find((item) => item.tagId === tagId)?.score ?? 0]));
  const gate = evaluatePhaseGate({
    phaseId: 1,
    lessonScores: phaseEvidence.map((record) => record.score),
    practicalScores: phaseEvidence.filter((record) => record.kind === 'practical').map((record) => record.score),
    prerequisiteScores,
  });
  const remediation = buildRemediationQueue(mastery);
  return <section className="page"><h1>知识掌握报告</h1>
    <section aria-label="第一阶段闯关"><h2>第一阶段闯关</h2>
      <p className={gate.passed ? 'status status--success' : 'status status--danger'}>{gate.passed ? '已通过第一阶段闯关。' : '第一阶段尚未通过，按以下规则补强。'}</p>
      <ul aria-label="闯关规则"><li>阶段平均分 ≥ 75</li><li>实操平均分 ≥ 70</li><li>每个前置标签 ≥ 70</li></ul>
      {!gate.passed && <><h3>未通过原因</h3><ul aria-label="未通过原因">{gate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <h3>优先补强</h3>{remediation.length > 0 ? <ol aria-label="补强队列">{remediation.map((item) => <li key={item.id}>{`${item.tagId}：${item.reason}`}</li>)}</ol> : <p>先完成第一阶段的可评估练习，再生成补强队列。</p>}</>}
      <Link to="/week/5">预览第 5 周（闯关失败也可查看后续内容）</Link>
    </section>
    <h2>标签掌握情况</h2><ul>{mastery.map((item) => <li key={item.tagId}>{`${item.tagId}：${item.score} 分，`}<span className={`status status--${item.band}`}>{bandLabel[item.band]}</span></li>)}</ul>
  </section>;
}
