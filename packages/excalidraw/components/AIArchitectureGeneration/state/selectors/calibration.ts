import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

import type {
  CalibrationState,
  CalibrationTask,
  ConfidenceState,
  Issue,
  ServiceGroup,
} from "../../types";
import { issuesAtom, normalizedRowsAtom, serviceGroupsAtom } from "./derived";

const STORAGE_KEY_PREFIX = "excalidraw_ai_arch_gen_v2";
const fallbackMemoryStorage = new Map<string, string>();

const jsonStorage = createJSONStorage(() => {
  const candidate =
    typeof window !== "undefined"
      ? (window.localStorage as Storage | undefined)
      : undefined;
  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  ) {
    return candidate;
  }
  return {
    getItem: (key: string) => fallbackMemoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      fallbackMemoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      fallbackMemoryStorage.delete(key);
    },
  };
});

export const completedCalibrationTaskIdsAtom = atomWithStorage<string[]>(
  `${STORAGE_KEY_PREFIX}_completed_tasks`,
  [],
  jsonStorage,
);

export const buildCalibrationTasks = (
  issues: Issue[],
  groups: ServiceGroup[],
): CalibrationTask[] => [
  ...issues.map((issue) => ({
    id: `task:issue:${issue.id}`,
    type: "resolve_issue" as const,
    title: `Resolve issue: ${issue.code} (row ${issue.rowId})`,
    blocking: issue.severity === "error",
    done: false,
    issueId: issue.id,
  })),
  ...groups.filter((group) => group.confidence < 0.8).map((group) => ({
    id: `task:group:${group.id}`,
    type: "confirm_group" as const,
    title: `Confirm inferred group: ${group.name}`,
    blocking: group.confidence < 0.8,
    done: false,
    groupId: group.id,
  })),
];

export const buildCalibrationState = (
  issues: Issue[],
  groups: ServiceGroup[],
): CalibrationState => {
  const tasks = buildCalibrationTasks(issues, groups);
  return {
    tasks,
    status: tasks.length === 0 ? "confirmed" : "in_progress",
  };
};

export const calibrationStateAtom = atom((get) => {
  const base = buildCalibrationState(get(issuesAtom), get(serviceGroupsAtom));
  const doneSet = new Set(get(completedCalibrationTaskIdsAtom));
  const tasks = base.tasks.map((task) => ({
    ...task,
    done: doneSet.has(task.id),
  }));
  const hasBlockingOpen = tasks.some((task) => task.blocking && !task.done);
  return {
    tasks,
    status: hasBlockingOpen ? "in_progress" : "confirmed",
  } as CalibrationState;
});

type CalibrationQualityGate = {
  ready: boolean;
  reasons: string[];
  metrics: {
    totalAssets: number;
    hostnameCoverage: number;
    ipCoverage: number;
    blockingIssueCount: number;
  };
};

const COVERAGE_THRESHOLD = 0.95;

export const calibrationQualityGateAtom = atom<CalibrationQualityGate>((get) => {
  const rows = get(normalizedRowsAtom);
  const issues = get(issuesAtom);
  const totalAssets = rows.length;

  if (totalAssets === 0) {
    return {
      ready: false,
      reasons: ["当前没有可校准资产，请先确认字段映射与数据质量"],
      metrics: {
        totalAssets,
        hostnameCoverage: 0,
        ipCoverage: 0,
        blockingIssueCount: issues.filter((issue) => issue.severity === "error").length,
      },
    };
  }

  const hostnameCoverage =
    rows.filter((row) => row.vm.hostname.trim().length > 0).length / totalAssets;
  const ipCoverage =
    rows.filter((row) => row.vm.privateIp.trim().length > 0).length / totalAssets;
  const blockingIssueCount = issues.filter((issue) => issue.severity === "error").length;

  const reasons: string[] = [];
  if (hostnameCoverage < COVERAGE_THRESHOLD) {
    reasons.push(`主机名覆盖率不足（${Math.round(hostnameCoverage * 100)}%）`);
  }
  if (ipCoverage < COVERAGE_THRESHOLD) {
    reasons.push(`内网 IP 覆盖率不足（${Math.round(ipCoverage * 100)}%）`);
  }
  if (blockingIssueCount > 0) {
    reasons.push(`仍有 ${blockingIssueCount} 个阻断级待确认项未处理`);
  }

  return {
    ready: reasons.length === 0,
    reasons,
    metrics: {
      totalAssets,
      hostnameCoverage,
      ipCoverage,
      blockingIssueCount,
    },
  };
});

export const updateConfidenceState = (
  state: CalibrationState,
  qualityGate: CalibrationQualityGate,
): ConfidenceState => {
  if (!qualityGate.ready) {
    return "calibrating";
  }
  if (state.tasks.length === 0 || state.status === "confirmed") {
    return "confirmed";
  }
  return "calibrating";
};

export const confidenceStateAtom = atom<ConfidenceState>((get) =>
  updateConfidenceState(get(calibrationStateAtom), get(calibrationQualityGateAtom)),
);

export const markCalibrationTaskDoneAtom = atom(
  null,
  (get, set, taskId: string) => {
    const prev = get(completedCalibrationTaskIdsAtom);
    if (!prev.includes(taskId)) {
      set(completedCalibrationTaskIdsAtom, [...prev, taskId]);
    }
  },
);

export const markCalibrationTaskUndoneAtom = atom(
  null,
  (get, set, taskId: string) => {
    const prev = get(completedCalibrationTaskIdsAtom);
    if (prev.includes(taskId)) {
      set(
        completedCalibrationTaskIdsAtom,
        prev.filter((id) => id !== taskId),
      );
    }
  },
);
