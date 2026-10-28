import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Correction } from './pages/Correction'
import { DataPage } from './pages/DataPage'
import { FatList } from './pages/FatList'
import { RecipeEditor } from './pages/RecipeEditor'
import { RecipeList } from './pages/RecipeList'
import { Worksheet } from './pages/Worksheet'

const NAV = [
  ['/', 'Rezepte'],
  ['/korrektur', 'Korrektur'],
  ['/fette', 'Fette & Öle'],
  ['/daten', 'Daten'],
] as const

export default function App() {
  return (
    <HashRouter>
      <nav className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-bold tracking-tight">olisoap</span>
          {NAV.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `text-sm ${isActive ? 'font-semibold text-accent' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<RecipeList />} />
          <Route path="/rezepte/:id" element={<RecipeEditor />} />
          <Route path="/rezepte/:id/druck" element={<Worksheet />} />
          <Route path="/korrektur" element={<Correction />} />
          <Route path="/korrektur/:id" element={<Correction />} />
          <Route path="/fette" element={<FatList />} />
          <Route path="/daten" element={<DataPage />} />
        </Routes>
      </main>
    </HashRouter>
  )
}
