import { Cloud, Database, FileSpreadsheet, Scale, Table, Upload } from 'lucide-react'
import { PageHeader, TaskTile } from '../components/ui'

export function Tools() {
  return (
    <div>
      <PageHeader eyebrow="Werkzeuge" title="Rechner, Tabellen, Daten" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TaskTile to="/korrektur" icon={Scale} title="Korrekturrechner" subtitle="Zu viel oder zu wenig eingewogen?" />
        <TaskTile to="/fette" icon={Table} title="Fette & Öle" subtitle="Verseifungszahlen, Fettsäuren, Jodzahl" />
        <TaskTile to="/lager/artikel" icon={FileSpreadsheet} title="Artikel & Preise" subtitle="Packungen, Dichte, Preishistorie" />
        <TaskTile to="/lager/import" icon={Upload} title="Import" subtitle="Salandia-Bestellungen einlesen" />
        <TaskTile to="/sync" icon={Cloud} title="Sync & Konto" subtitle="Geräte abgleichen, verschlüsselt sichern" />
        <TaskTile to="/daten" icon={Database} title="Daten & Sicherung" subtitle="Export, Import, Zurücksetzen" />
      </div>
    </div>
  )
}
