import type { Issue } from "../../AIArchitectureGeneration";

export interface IssueSuggestionContextRow {
  rowId: number;
  hostname: string;
  privateIp: string;
  serviceName: string;
  message: string;
}

export const buildIssueSuggestionMessages = (
  issueTitle: string,
  issueCode: Issue["code"],
  issueField: Issue["field"] | undefined,
  rows: IssueSuggestionContextRow[],
) => {
  const sample = rows
    .slice(0, 8)
    .map(
      (row) =>
        `row=${row.rowId},hostname=${row.hostname || "-"},privateIp=${row.privateIp || "-"},serviceName=${row.serviceName || "-"},issue=${row.message}`,
    )
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "你是企业资产数据校准助手。根据问题类型和上下文给出可执行修复建议。输出 JSON: {\"suggestedValue\":\"...\",\"reason\":\"...\"}",
    },
    {
      role: "user" as const,
      content: `请为以下待确认项提供一个可执行建议值。\n类型:${issueTitle}\ncode:${issueCode}\nfield:${issueField ?? "unknown"}\n样本:\n${sample}\n要求:\n1) suggestedValue 必须可直接填入该字段\n2) reason 用一句话说明依据\n3) 若无法可靠建议，suggestedValue 返回空字符串`,
    },
  ];
};
