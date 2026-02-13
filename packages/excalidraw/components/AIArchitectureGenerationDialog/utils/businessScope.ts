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

export interface BusinessScopeAssignment {
  name: string;
  groupIds: string[];
}

export const projectBusinessScopesByAssignments = (
  assignments: BusinessScopeAssignment[],
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
): BusinessScopeView[] => {
  const rowById = new Map(rows.map((row) => [row.rowId, row]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const scopes = new Map<string, BusinessScopeView>();

  assignments.forEach((assignment, index) => {
    const scopeName = assignment.name.trim() || `业务范围${index + 1}`;
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
    assignment.groupIds.forEach((groupId) => {
      const group = groupById.get(groupId);
      if (!group) {
        return;
      }
      if (!existing.groupIds.includes(group.id)) {
        existing.groupIds.push(group.id);
      }
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
    });
    existing.vmCount = existing.rowIds.length;
    scopes.set(scopeId, existing);
  });

  const scopedGroupIds = new Set(
    Array.from(scopes.values()).flatMap((scope) => scope.groupIds),
  );
  const unscopedGroups = groups.filter((group) => !scopedGroupIds.has(group.id));
  if (unscopedGroups.length > 0) {
    const fallbackScopeId = "scope:未分类业务";
    const fallbackScope =
      scopes.get(fallbackScopeId) ??
      ({
        id: fallbackScopeId,
        name: "未分类业务",
        groupIds: [],
        rowIds: [],
        vmCount: 0,
        appTypeStats: {},
      } as BusinessScopeView);
    unscopedGroups.forEach((group) => {
      if (!fallbackScope.groupIds.includes(group.id)) {
        fallbackScope.groupIds.push(group.id);
      }
      group.rowIds.forEach((rowId) => {
        if (!fallbackScope.rowIds.includes(rowId)) {
          fallbackScope.rowIds.push(rowId);
        }
        const row = rowById.get(rowId);
        if (row) {
          const appType = inferAppType(row.vm.serviceName, row.vm.hostname);
          fallbackScope.appTypeStats[appType] =
            (fallbackScope.appTypeStats[appType] ?? 0) + 1;
        }
      });
    });
    fallbackScope.vmCount = fallbackScope.rowIds.length;
    scopes.set(fallbackScopeId, fallbackScope);
  }

  return Array.from(scopes.values())
    .filter((scope) => scope.rowIds.length > 0)
    .sort((a, b) => b.vmCount - a.vmCount);
};
