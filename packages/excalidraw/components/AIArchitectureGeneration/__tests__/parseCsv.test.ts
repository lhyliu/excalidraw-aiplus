/**
 * CSV 解析功能单元测试
 */

import { describe, it, expect } from "vitest";
import { parseCsv, CsvParseError } from "../core/data/parseCsv";

describe("parseCsv", () => {
  it("应正确解析简单 CSV", () => {
    const csv = `hostname,ip
server1,192.168.1.1
server2,192.168.1.2`;

    const result = parseCsv(csv);

    expect(result.headers).toEqual(["hostname", "ip"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values.hostname).toBe("server1");
  });

  it("空输入应抛出错误", () => {
    expect(() => parseCsv("")).toThrow(CsvParseError);
    expect(() => parseCsv("   ")).toThrow(CsvParseError);
  });

  it("应正确处理 Windows 换行符", () => {
    const csv = `hostname,ip\r\nserver1,192.168.1.1`;

    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values.hostname).toBe("server1");
  });

  it("应正确处理引号内换行字段", () => {
    const csv = `name,disk
server1,"disk1
disk2"
server2,"disk3
disk4"`;

    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values.name).toBe("server1");
    expect(result.rows[0].values.disk).toBe("disk1\ndisk2");
    expect(result.rows[1].values.name).toBe("server2");
  });
});
