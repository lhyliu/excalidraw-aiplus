import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

export interface BusinessScopeView {
  id: string;
  name: string;
  groupIds: string[];
  rowIds: number[];
  vmCount: number;
  appTypeStats: Record<string, number>;
}

const normalizeScopeName = (serviceName: string): string => {
  const raw = serviceName.trim();
  if (!raw || raw === "unknown") {
    return "未分类业务";
  }

  const presets: Array<{ match: RegExp; scope: string }> = [
    { match: /(oms|order|订单)/i, scope: "订单业务" },
    { match: /(pay|payment|billing|支付)/i, scope: "支付业务" },
    { match: /(inventory|stock|仓储|库存)/i, scope: "库存业务" },
    { match: /(crm|customer|客户)/i, scope: "客户业务" },
    { match: /(monitor|alert|ops|运维)/i, scope: "运维平台" },
  ];

  const preset = presets.find((item) => item.match.test(raw));
  if (preset) {
    return preset.scope;
  }

  const firstToken = raw.split(/[\\/\s|:_-]+/).find(Boolean);
  return firstToken ? firstToken : raw;
};

const inferAppType = (serviceName: string, hostname: string): string => {
  const text = `${serviceName} ${hostname}`.toLowerCase();
  const rules: Array<{ match: RegExp; type: string }> = [
    { match: /(mysql|mariadb|postgres|mongodb|db|oracle)/, type: "database" },
    { match: /(redis|cache)/, type: "cache" },
    { match: /(mq|kafka|rabbit|rocketmq)/, type: "message-queue" },
    { match: /(nginx|gateway|lb|ingress)/, type: "gateway" },
    { match: /(web|frontend|ui)/, type: "web" },
    { match: /(api|app|service|backend)/, type: "app" },
  ];
  const matched = rules.find((item) => item.match.test(text));
  return matched?.type ?? "unknown";
};

export const projectBusinessScopes = (
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
): BusinessScopeView[] => {
  const rowById = new Map(rows.map((row) => [row.rowId, row]));
  const scopes = new Map<string, BusinessScopeView>();

  groups.forEach((group) => {
    const scopeName = normalizeScopeName(group.name);
    const scopeId = `scope:${scopeName}`;
    const existing =
      scopes.get(scopeId) ??
      ({
        id: scopeId,
        name: scopeName,
        groupIds: [],
        rowIds: [],
        vmCount: 0,
        appTypeStats: {},
      } as BusinessScopeView);

    existing.groupIds.push(group.id);
    group.rowIds.forEach((rowId) => {
      if (!existing.rowIds.includes(rowId)) {
        existing.rowIds.push(rowId);
      }
      const row = rowById.get(rowId);
      if (row) {
        const appType = inferAppType(row.vm.serviceName, row.vm.hostname);
        existing.appTypeStats[appType] = (existing.appTypeStats[appType] ?? 0) + 1;
      }
    });
    existing.vmCount = existing.rowIds.length;
    scopes.set(scopeId, existing);
  });

  return Array.from(scopes.values()).sort((a, b) => b.vmCount - a.vmCount);
};

