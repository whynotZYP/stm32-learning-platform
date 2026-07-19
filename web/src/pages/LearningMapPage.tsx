import { Link } from 'react-router-dom';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function LearningMapPage() {
  return <section className="page"><h1>24 周学习地图</h1><ol className="week-grid">{loadCourseMap().weeks.map((week) => <li className="week-card" key={week.week}><Link to={`/week/${week.week}`}>{`第 ${week.week} 周 · ${week.title}`}</Link>{week.gateAfter && <span> · 阶段闯关</span>}</li>)}</ol></section>;
}
