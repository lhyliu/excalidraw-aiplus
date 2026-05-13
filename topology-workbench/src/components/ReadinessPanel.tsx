import type {
  ClassificationIssue,
  DataQualityIssue,
  ImportReadinessReport,
  ImportWarning,
} from "../domain/types";

type ReadinessPanelProps = {
  readonly readiness?: ImportReadinessReport;
  readonly generationError?: string;
  readonly importWarnings: readonly ImportWarning[];
  readonly normalizationIssues: readonly DataQualityIssue[];
  readonly classificationIssues: readonly ClassificationIssue[];
};

export function ReadinessPanel({
  readiness,
  generationError,
  importWarnings,
  normalizationIssues,
  classificationIssues,
}: ReadinessPanelProps) {
  const warnings = [
    ...(generationError ? [generationError] : []),
    ...importWarnings.map((warning) => warning.message),
    ...(readiness?.blockingIssues ?? []),
    ...(readiness?.warnings ?? []),
    ...normalizationIssues.map((issue) => issue.message),
    ...classificationIssues.map((issue) => issue.message),
  ];

  return (
    <section className="panel" aria-labelledby="readiness-title">
      <h2 id="readiness-title">Readiness</h2>
      {readiness ? (
        <dl className="metric-grid">
          <div>
            <dt>Level</dt>
            <dd>{readiness.level}</dd>
          </div>
          <div>
            <dt>Rows</dt>
            <dd>
              {readiness.resolvedRows}/{readiness.totalRows}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="muted">Generate a topology to see import readiness.</p>
      )}

      {warnings.length > 0 ? (
        <ul className="issue-list">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : readiness ? (
        <p className="muted">No import warnings.</p>
      ) : null}
    </section>
  );
}
