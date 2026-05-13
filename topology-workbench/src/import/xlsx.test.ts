import { parseXlsxInventory } from "./xlsx";

const encoder = new TextEncoder();

class FakeWorkbookFile extends File {
  async arrayBuffer() {
    return encoder
      .encode(
        JSON.stringify([
          ["instance_id", "name", "类型"],
          ["i-001", "api", "ECS"],
          ["i-002", "db", "RDS"],
        ]),
      )
      .buffer;
  }
}

vi.mock("read-excel-file/browser", () => ({
  readSheet: async (file: File) => {
    const text = new TextDecoder().decode(await file.arrayBuffer());
    return JSON.parse(text);
  },
}));

describe("parseXlsxInventory", () => {
  it("parses first sheet rows into the raw table shape", async () => {
    const table = await parseXlsxInventory(
      new FakeWorkbookFile([], "inventory.xlsx"),
    );

    expect(table).toEqual({
      headers: ["instance_id", "name", "类型"],
      rows: [
        {
          rowId: "row-1",
          cells: { instance_id: "i-001", name: "api", 类型: "ECS" },
        },
        {
          rowId: "row-2",
          cells: { instance_id: "i-002", name: "db", 类型: "RDS" },
        },
      ],
      warnings: [],
    });
  });

  it("sanitizes blank and duplicate headers into stable unique labels", async () => {
    const table = await parseXlsxInventory(
      new File(
        [
          JSON.stringify([
            ["name", "name", "", "类型"],
            ["api", "api-copy", "orphan", "ECS"],
          ]),
        ],
        "inventory.xlsx",
      ),
    );

    expect(table.headers).toEqual(["name", "name_2", "column_3", "类型"]);
    expect(table.rows[0]).toEqual({
      rowId: "row-1",
      cells: {
        name: "api",
        name_2: "api-copy",
        column_3: "orphan",
        类型: "ECS",
      },
    });
    expect(table.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Duplicate header renamed from name to name_2",
          column: "name_2",
        }),
        expect.objectContaining({
          message: "Blank header renamed to column_3",
          column: "column_3",
        }),
      ]),
    );
  });
});
