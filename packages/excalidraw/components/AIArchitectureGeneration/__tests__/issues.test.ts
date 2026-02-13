/**
 * 问题检测功能单元测试
 */

import { describe, it, expect } from "vitest";
import { detectIssues } from "../core/validation/issues";
import type { NormalizedVmRow } from "../types";

describe("detectIssues", () => {
  const createRow = (rowId: number, overrides: Partial<NormalizedVmRow["vm"]> = {}): NormalizedVmRow => ({
    rowId,
    raw: {},
    vm: {
      hostname: `host${rowId}`,
      privateIp: `192.168.1.${rowId}`,
      serviceName: "default-service",
      environment: "production",
      cpuCores: 4,
      memoryGb: 16,
      cluster: "cluster-1",
      region: "us-east",
      ...overrides,
    },
  });

  it("应返回空数组当没有问题时", () => {
    const rows = [createRow(0), createRow(1)];
    const issues = detectIssues(rows);
    expect(issues).toHaveLength(0);
  });

  it("应检测缺少 hostname", () => {
    const rows = [createRow(0, { hostname: "" })];
    const issues = detectIssues(rows);
    expect(issues.some((i) => i.code === "missing_required" && i.field === "hostname")).toBe(true);
  });

  it("应检测重复的 hostname", () => {
    const rows = [
      createRow(0, { hostname: "duplicate-host" }),
      createRow(1, { hostname: "duplicate-host" }),
    ];
    const issues = detectIssues(rows);
    expect(issues.some((i) => i.code === "duplicate_hostname")).toBe(true);
  });

  it("应检测无效的 IP 地址", () => {
    const rows = [createRow(0, { privateIp: "invalid-ip" })];
    const issues = detectIssues(rows);
    expect(issues.some((i) => i.code === "invalid_ip" && i.field === "privateIp")).toBe(true);
  });

  it("应检测缺少服务名称", () => {
    const rows = [createRow(0, { hostname: "checkout-api-01", serviceName: "unknown" })];
    const issues = detectIssues(rows);
    const serviceIssue = issues.find(
      (i) => i.code === "missing_required" && i.field === "serviceName",
    );
    expect(serviceIssue).toBeTruthy();
  });
});
