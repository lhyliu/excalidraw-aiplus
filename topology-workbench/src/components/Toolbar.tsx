import type { TopologyFilters } from "../domain/types";

type ToolbarProps = {
  readonly filters: TopologyFilters;
  readonly environments: readonly string[];
  readonly businessDomains: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly onFiltersChange: (filters: TopologyFilters) => void;
  readonly onExportJson: () => void;
  readonly onExportPng: () => void;
  readonly onExportSvg: () => void;
  readonly onRelayout: () => void;
  readonly canExport: boolean;
  readonly exportStatus?: string;
};

export function Toolbar({
  canExport,
  exportStatus,
  filters,
  environments,
  businessDomains,
  resourceTypes,
  onFiltersChange,
  onExportJson,
  onExportPng,
  onExportSvg,
  onRelayout,
}: ToolbarProps) {
  const updateFilter = (patch: TopologyFilters) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="toolbar" aria-label="Topology toolbar">
      <label className="toolbar-field toolbar-search">
        <span>Search topology</span>
        <input
          aria-label="Search topology"
          onChange={(event) => updateFilter({ search: event.target.value })}
          placeholder="Search nodes"
          type="search"
          value={filters.search ?? ""}
        />
      </label>

      <label className="toolbar-field">
        <span>Environment</span>
        <select
          aria-label="Environment"
          onChange={(event) =>
            updateFilter({ environment: event.target.value || undefined })
          }
          value={filters.environment ?? ""}
        >
          <option value="">All environments</option>
          {environments.map((environment) => (
            <option key={environment} value={environment}>
              {environment}
            </option>
          ))}
        </select>
      </label>

      <label className="toolbar-field">
        <span>Business domain</span>
        <select
          aria-label="Business domain"
          onChange={(event) =>
            updateFilter({ businessDomain: event.target.value || undefined })
          }
          value={filters.businessDomain ?? ""}
        >
          <option value="">All domains</option>
          {businessDomains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
      </label>

      <label className="toolbar-field">
        <span>Resource type</span>
        <select
          aria-label="Resource type"
          onChange={(event) =>
            updateFilter({ resourceType: event.target.value || undefined })
          }
          value={filters.resourceType ?? ""}
        >
          <option value="">All types</option>
          {resourceTypes.map((resourceType) => (
            <option key={resourceType} value={resourceType}>
              {resourceType}
            </option>
          ))}
        </select>
      </label>

      <button onClick={onRelayout} type="button">
        Relayout
      </button>
      <button
        aria-pressed={filters.networkOnly === true}
        className={filters.networkOnly ? "toolbar-button--active" : undefined}
        onClick={() => updateFilter({ networkOnly: !filters.networkOnly })}
        type="button"
      >
        Network view
      </button>
      <button disabled={!canExport} onClick={onExportJson} type="button">
        Export JSON
      </button>
      <button disabled={!canExport} onClick={onExportSvg} type="button">
        Export SVG
      </button>
      <button disabled={!canExport} onClick={onExportPng} type="button">
        Export PNG
      </button>
      {exportStatus ? (
        <span className="export-status" role="status">
          {exportStatus}
        </span>
      ) : null}
    </div>
  );
}
