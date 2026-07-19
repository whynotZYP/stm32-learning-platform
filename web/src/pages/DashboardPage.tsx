import { Link } from 'react-router-dom';
import { useProgress } from '../app/ProgressContext';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function DashboardPage() {
  const { error, loading, state } = useProgress();

  if (loading) return <section className="page"><h1>正在准备你的学习计划</h1><p>正在读取保存在这台设备上的学习进度。</p></section>;
  if (error) return <section className="page"><h1>无法读取学习进度</h1><p className="status status--danger">{error}</p></section>;

  const week = loadCourseMap().weeks[state.currentWeek - 1];
  return <section className="page"><h1>今天从这里开始</h1><p>{`当前：第 ${week.week} 周 · ${week.title}`}</p><Link className="button-link" to={`/week/${week.week}`}>继续学习</Link></section>;
}
