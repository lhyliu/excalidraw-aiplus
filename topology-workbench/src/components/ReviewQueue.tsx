import type { ClassifiedAsset } from "../domain/types";

type ReviewQueueProps = {
  readonly assets: readonly ClassifiedAsset[];
  readonly onAcceptMedium: () => void;
};

export function ReviewQueue({ assets, onAcceptMedium }: ReviewQueueProps) {
  const reviewAssets = assets.filter(
    (asset) => asset.reviewRequired && asset.confidence !== "high",
  );
  const mediumCount = reviewAssets.filter(
    (asset) => asset.confidence === "medium",
  ).length;

  return (
    <section className="panel" aria-labelledby="review-title">
      <div className="panel-header">
        <h2 id="review-title">Review queue</h2>
        <button
          disabled={mediumCount === 0}
          onClick={onAcceptMedium}
          type="button"
        >
          Accept medium-confidence suggestions
        </button>
      </div>

      {reviewAssets.length === 0 ? (
        <p className="muted">No reviewed assets waiting.</p>
      ) : (
        <ul className="review-list">
          {reviewAssets.map((asset) => (
            <li key={asset.identity}>
              <strong>{asset.label}</strong>
              <span>
                {asset.confidence === "medium"
                  ? "Medium confidence"
                  : "Low confidence"}
              </span>
              <small>
                {asset.nodeKind} · {asset.layer}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
