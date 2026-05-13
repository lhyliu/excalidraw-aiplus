import type {
  PatchSummary,
  PatchValidationResult,
  TopologyPatch,
  TopologyPatchOperation,
} from "../domain/types";

type PatchReviewProps = {
  readonly instruction: string;
  readonly patch?: TopologyPatch;
  readonly summary?: PatchSummary;
  readonly validation?: PatchValidationResult;
  readonly canPropose: boolean;
  readonly canRollback: boolean;
  readonly onInstructionChange: (instruction: string) => void;
  readonly onPropose: () => void;
  readonly onToggleOperation: (operationId: string, enabled: boolean) => void;
  readonly onApply: () => void;
  readonly onReject: () => void;
  readonly onRollback: () => void;
};

const operationText = (operation: TopologyPatchOperation) => {
  switch (operation.type) {
    case "addNode":
      return `Add node ${operation.node.label}`;
    case "updateNode":
      if (operation.changes.data?.hidden) {
        return `Hide node ${operation.nodeId}`;
      }
      if (operation.changes.data?.validationRisk) {
        return `Annotate risk ${operation.nodeId}`;
      }
      if (operation.changes.businessDomain) {
        return `Move ${operation.nodeId} to ${operation.changes.businessDomain}`;
      }
      if (operation.changes.layer) {
        return `Move ${operation.nodeId} to ${operation.changes.layer}`;
      }
      return `Update node ${operation.nodeId}`;
    case "removeNode":
      return `Remove node ${operation.nodeId}`;
    case "addEdge":
      return operation.edge.label
        ? operation.edge.label
        : `Add ${operation.edge.kind} edge`;
    case "updateEdge":
      return `Update edge ${operation.edgeId}`;
    case "removeEdge":
      return `Remove edge ${operation.edgeId}`;
  }
};

const hasEnabledOperations = (patch: TopologyPatch) =>
  patch.operations.some((operation) => operation.enabled !== false);

export function PatchReview({
  instruction,
  patch,
  summary,
  validation,
  canPropose,
  canRollback,
  onInstructionChange,
  onPropose,
  onToggleOperation,
  onApply,
  onReject,
  onRollback,
}: PatchReviewProps) {
  const risks = summary?.validationRisks ?? validation?.risks ?? [];
  const canApply = Boolean(
    patch && validation?.valid && hasEnabledOperations(patch),
  );

  return (
    <section
      className="panel patch-review"
      aria-labelledby="patch-review-title"
    >
      <div className="panel-header">
        <div>
          <h2 id="patch-review-title">Patch review</h2>
          <p className="muted">
            Propose local topology changes from a natural-language instruction.
          </p>
        </div>
      </div>

      <label className="field">
        <span>AI patch instruction</span>
        <textarea
          aria-label="AI patch instruction"
          onChange={(event) => onInstructionChange(event.target.value)}
          rows={3}
          value={instruction}
        />
      </label>

      <div className="button-row">
        <button disabled={!canPropose} onClick={onPropose} type="button">
          Propose patch
        </button>
        <button disabled={!canRollback} onClick={onRollback} type="button">
          Rollback patch
        </button>
      </div>

      {patch && summary ? (
        <>
          <div className="patch-summary">
            <strong>{summary.title}</strong>
            <span>{summary.description}</span>
          </div>

          <div>
            <h3>Operations</h3>
            {patch.operations.length > 0 ? (
              <ul className="patch-operation-list">
                {patch.operations.map((operation) => (
                  <li key={operation.id}>
                    <label>
                      <input
                        aria-label={`Enable operation ${operation.id}`}
                        checked={operation.enabled !== false}
                        onChange={(event) =>
                          onToggleOperation(operation.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{operationText(operation)}</span>
                    </label>
                    <small>{operation.type}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No operations proposed.</p>
            )}
          </div>

          <div>
            <h3>Validation risks</h3>
            {risks.length > 0 ? (
              <ul className="issue-list">
                {risks.map((risk, index) => (
                  <li key={`${risk.operationId ?? risk.code}-${index}`}>
                    {risk.severity}: {risk.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No blocking validation risks.</p>
            )}
          </div>

          <div className="button-row">
            <button
              className="primary-button"
              disabled={!canApply}
              onClick={onApply}
              type="button"
            >
              Apply patch
            </button>
            <button onClick={onReject} type="button">
              Reject patch
            </button>
          </div>
        </>
      ) : (
        <p className="muted">No AI patch pending.</p>
      )}
    </section>
  );
}
