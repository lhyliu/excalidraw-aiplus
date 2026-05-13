import type { TopologyNode } from "../domain/types";

type InspectorProps = {
  readonly node?: TopologyNode;
};

const formatDataValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(", ") || "none";
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value === undefined || value === null || value === ""
    ? "none"
    : String(value);
};

export function Inspector({ node }: InspectorProps) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <section className="panel">
        {node ? (
          <>
            <h2>{node.label}</h2>
            <dl className="inspector-list">
              <div>
                <dt>Kind</dt>
                <dd>{node.kind}</dd>
              </div>
              <div>
                <dt>Layer</dt>
                <dd>{node.layer}</dd>
              </div>
              <div>
                <dt>Resource type</dt>
                <dd>{node.resourceType ?? "none"}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>{node.environment ?? "none"}</dd>
              </div>
              <div>
                <dt>Source rows</dt>
                <dd>{node.sourceRows.join(", ")}</dd>
              </div>
            </dl>

            <h3>Tags and data</h3>
            <dl className="inspector-list">
              {Object.entries(node.data).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{formatDataValue(value)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <>
            <h2>Inspector</h2>
            <p className="muted">Select a node to inspect topology metadata.</p>
          </>
        )}
      </section>
    </aside>
  );
}
