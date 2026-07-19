import { useProgress } from '../app/ProgressContext';
import { calculateTagMastery, type TagMastery } from '../domain/scoring/mastery';

const labelFor = (band: TagMastery['band']) => ({
  mastered: '已掌握',
  review: '建议复习',
  remediate: '需要补强',
  relearn: '需要重新学习',
}[band]);

export function KnowledgeReportPage() {
  const { error, loading, state } = useProgress();
  if (loading) return <section className="page"><h1>正在准备知识报告</h1><p>正在读取保存在这台设备上的学习证据。</p></section>;
  if (error) return <section className="page"><h1>无法读取知识报告</h1><p className="status status--danger">{error}</p></section>;

  const tags = [...new Set(state.evidence.flatMap((item) => item.tagIds))];
  const results = tags.map((tag) => calculateTagMastery(tag, state.evidence));
  return <section className="page"><h1>知识掌握报告</h1>{results.length === 0 ? <p>完成测验或实验后，这里会显示证据和知识缺口。</p> : <ul>{results.map((item) => <li key={item.tagId}>{`${item.tagId}：${item.score} 分，`}<span className={`status status--${item.band}`}>{labelFor(item.band)}</span></li>)}</ul>}</section>;
}
