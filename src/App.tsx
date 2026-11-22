import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Study from './pages/Study';
import Quiz from './pages/Quiz';
import Chapter from './pages/Chapter';
import List from './pages/List';
import Settings from './pages/Settings';
import Stats from './pages/Stats';

export default function App() {
  return (
    <div className="app">
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chapter/:chapterId" element={<Chapter />} />
          <Route path="/study/:chapterId" element={<Study />} />
          <Route path="/quiz/:chapterId" element={<Quiz />} />
          <Route path="/list" element={<List />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>ホーム</NavLink>
        <NavLink to="/list">単語一覧</NavLink>
        <NavLink to="/stats">記録</NavLink>
        <NavLink to="/settings">設定</NavLink>
      </nav>
    </div>
  );
}
