export default function App() {
  return (
    <main className="topology-workbench">
      <aside className="import-rail" aria-label="Import controls">
        <div className="rail-heading">Import asset inventory</div>
      </aside>

      <section className="workspace" aria-labelledby="topology-title">
        <header className="workspace-header">
          <div>
            <p className="workspace-kicker">Cloud architecture</p>
            <h1 id="topology-title">Topology Workbench</h1>
          </div>
        </header>

        <div className="canvas-region" role="region" aria-label="Topology canvas">
          <span>Topology canvas</span>
        </div>
      </section>
    </main>
  );
}
