import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BatchDetail, BatchList } from './pages/Batches'
import { Correction } from './pages/Correction'
import { Dashboard } from './pages/Dashboard'
import { DataPage } from './pages/DataPage'
import { Designer } from './pages/Designer'
import { Demo } from './pages/Demo'
import { FatList } from './pages/FatList'
import { GuidePrint } from './pages/GuidePrint'
import { InventoryPage } from './pages/InventoryPage'
import { Labels } from './pages/Labels'
import { RecipeEditor } from './pages/RecipeEditor'
import { RecipeList } from './pages/RecipeList'
import { Settings } from './pages/Settings'
import { Shopping } from './pages/Shopping'
import { SiedenRun, SiedenStart } from './pages/Sieden'
import { SyncPage } from './pages/SyncPage'
import { Tools } from './pages/Tools'
import { BatchWorksheet, Worksheet } from './pages/Worksheet'

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sieden" element={<SiedenStart />} />
          <Route path="/sieden/:id" element={<SiedenRun />} />
          <Route path="/rezepte" element={<RecipeList />} />
          <Route path="/entwickeln" element={<Designer />} />
          <Route path="/rezepte/:id" element={<RecipeEditor />} />
          <Route path="/rezepte/:id/druck" element={<Worksheet />} />
          <Route path="/rezepte/:id/anleitung" element={<GuidePrint />} />
          <Route path="/lager/*" element={<InventoryPage />} />
          <Route path="/einkauf" element={<Shopping />} />
          <Route path="/chargen" element={<BatchList />} />
          <Route path="/chargen/:id" element={<BatchDetail />} />
          <Route path="/chargen/:id/druck" element={<BatchWorksheet />} />
          <Route path="/chargen/:id/etikett" element={<Labels />} />
          <Route path="/werkzeuge" element={<Tools />} />
          <Route path="/korrektur" element={<Correction />} />
          <Route path="/korrektur/:id" element={<Correction />} />
          <Route path="/fette" element={<FatList />} />
          <Route path="/daten" element={<DataPage />} />
          <Route path="/profil" element={<Settings />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
