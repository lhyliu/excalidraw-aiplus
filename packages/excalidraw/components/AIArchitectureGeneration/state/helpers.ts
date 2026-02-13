import type { AliasStore, FieldMapping, StandardField } from "../types";

export const toEditKey = (rowId: number, field: StandardField): string =>
  `${rowId}:${field}`;

export const buildAliasStoreFromMapping = (
  mapping: FieldMapping,
  previous: AliasStore = {},
): AliasStore => {
  const next: AliasStore = { ...previous };
  for (const [field, header] of Object.entries(mapping) as Array<
    [StandardField, string | undefined]
  >) {
    if (!header || header.startsWith("__manual__")) {
      continue;
    }
    const aliases = new Set([...(next[field] ?? []), header]);
    next[field] = Array.from(aliases);
  }
  return next;
};

export const validateFieldMapping = (mapping: FieldMapping) => {
  const requiredFields = [
    "hostname",
    "privateIp",
    "serviceName",
  ] as StandardField[];
  const missingRequiredFields = requiredFields.filter((field) => !mapping[field]);
  const usedHeaders = new Map<string, StandardField[]>();
  requiredFields.forEach((field) => {
    const header = mapping[field];
    if (!header) {
      return;
    }
    usedHeaders.set(header, [...(usedHeaders.get(header) ?? []), field]);
  });
  usedHeaders.forEach((fields) => {
    if (fields.length <= 1) {
      return;
    }
    fields.slice(1).forEach((field) => {
      if (!missingRequiredFields.includes(field)) {
        missingRequiredFields.push(field);
      }
    });
  });
  if (missingRequiredFields.length === 0) {
    return { ok: true } as const;
  }
  return { ok: false, missingRequiredFields } as const;
};
