import { loadCourseMap } from './domain/content/loadCourseMap';

export function App() {
  const courseMap = loadCourseMap();

  return (
    <main>
      <h1>STM32 系统学习平台</h1>
      <p>24 周，从零基础到能独立排查问题</p>
      <ol aria-label="24 周学习地图">
        {courseMap.weeks.map((week) => (
          <li key={week.week}>{`第 ${week.week} 周 · ${week.title}`}</li>
        ))}
      </ol>
    </main>
  );
}
