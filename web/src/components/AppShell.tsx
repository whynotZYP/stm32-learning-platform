import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return <>
    <header className="site-header">
      <Link className="site-title" to="/">STM32 学习</Link>
      <nav aria-label="主导航">
        <Link to="/">首页</Link>
        <Link to="/map">学习地图</Link>
        <Link to="/report">知识报告</Link>
      </nav>
    </header>
    <main><Outlet /></main>
  </>;
}
