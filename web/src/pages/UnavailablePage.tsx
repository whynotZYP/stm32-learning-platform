import { Link } from 'react-router-dom';

export function UnavailablePage() {
  return <section className="page"><h1>这个页面暂未开放</h1><p>你访问的学习内容还没有准备好。</p><Link to="/">返回首页</Link></section>;
}
