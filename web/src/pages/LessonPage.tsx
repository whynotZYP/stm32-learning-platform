import { Link, useParams } from 'react-router-dom';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function LessonPage() {
  const lessonId = useParams().lessonId;
  const week = loadCourseMap().weeks.find((item) => item.lessonIds.includes(lessonId ?? ''));
  if (!week || !lessonId) return <section className="page"><h1>没有找到这节课程</h1><p>请从学习地图选择已经安排的课程。</p><Link to="/map">返回学习地图</Link></section>;

  return <section className="page"><h1>{week.title}</h1><p>{`这是第 ${week.week} 周的课程入口。详细讲义、实验和阶段考核会随着课程内容逐步加入。`}</p><p>开始前请先确认开发板未上电、接线无短路；完成操作后保留可观察的现象或串口数据。</p><Link className="button-link" to="/assessment/entry-diagnostic">进行入门诊断</Link><p><Link to={`/week/${week.week}`}>返回本周概览</Link></p></section>;
}
