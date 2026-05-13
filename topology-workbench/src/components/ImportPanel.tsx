import type { ImportReadinessReport } from "../domain/types";

export const SAMPLE_CSV = `instance_id,name,service_type,environment,business_domain,application,system,private_ip,public_ip,cidr,depends_on,connects_to,calls,tags
slb-public,Public SLB,SLB,prod,Commerce,Checkout,Ingress,,203.0.113.10,,svc-checkout,sg-edge,,owner=edge
sg-edge,Edge WAF,WAF,prod,Commerce,Checkout,Ingress,,,,slb-public,,,risk=internet
svc-checkout,Checkout API,service,prod,Commerce,Checkout,Order,10.0.1.10,,,rds-orders,vpc-core,worker-settlement,team=payments;tier=api
rds-orders,Orders Database,RDS,prod,Commerce,Checkout,Order,10.0.2.20,,,,,,risk=pii;tier=data
worker-settlement,Settlement Worker,ECS,dev,Finance,Settlement,Batch,10.1.1.8,,,,,,team=finance
vpc-core,Core VPC,VPC,prod,Shared,Network,Core,,,10.0.0.0/16,,vpn-idc,,owner=network
vpn-idc,IDC Direct Connect,leased_line,prod,Shared,Network,WAN,,,172.16.0.0/16,,,,provider=carrier`;

type ImportPanelProps = {
  readonly csvInput: string;
  readonly isGenerating: boolean;
  readonly readiness?: ImportReadinessReport;
  readonly onCsvInputChange: (value: string) => void;
  readonly onGenerate: () => void;
  readonly onLoadSample: () => void;
};

export function ImportPanel({
  csvInput,
  isGenerating,
  readiness,
  onCsvInputChange,
  onGenerate,
  onLoadSample,
}: ImportPanelProps) {
  return (
    <section className="panel import-panel" aria-labelledby="import-title">
      <div>
        <h2 id="import-title">Import asset inventory</h2>
        <p className="muted">
          Paste CSV inventory with resource and ownership fields.
        </p>
      </div>

      <label className="field">
        <span>CSV input</span>
        <textarea
          value={csvInput}
          onChange={(event) => onCsvInputChange(event.target.value)}
          rows={12}
        />
      </label>

      <div className="button-row">
        <button disabled={isGenerating} onClick={onLoadSample} type="button">
          Load sample CSV
        </button>
        <button
          className="primary-button"
          disabled={isGenerating}
          onClick={onGenerate}
          type="button"
        >
          {isGenerating ? "Generating..." : "Generate topology"}
        </button>
      </div>

      {readiness ? (
        <div className={`readiness-pill readiness-pill--${readiness.level}`}>
          {readiness.level} readiness · {readiness.resolvedRows}/
          {readiness.totalRows} rows mapped
        </div>
      ) : null}
    </section>
  );
}
