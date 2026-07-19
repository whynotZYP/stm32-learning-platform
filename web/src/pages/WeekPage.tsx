import { Link, useParams } from 'react-router-dom';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function WeekPage() {
  const weekNumber = Number(useParams().week);
  const week = loadCourseMap().weeks.find((item) => item.week === weekNumber);
  if (!week) return <section className="page"><h1>没有找到这一周</h1><Link to="/map">返回学习地图</Link></section>;

  return <section className="page"><h1>{`第 ${week.week} 周`}</h1><h2>{week.title}</h2><p>{`对应源课程：${week.sourceCourseIds.join('、') || '补充基础/综合应用'}`}</p><Link className="button-link" to={`/lesson/${week.lessonIds[0]}`}>进入本周课程</Link></section>;
}
