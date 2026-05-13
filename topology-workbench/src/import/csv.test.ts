import { parseCsvInventory } from "./csv";

describe("parseCsvInventory", () => {
  it("preserves headers, stable row IDs, and original cell strings", () => {
    const table = parseCsvInventory(
      " instance_id ,name,private_ip\n i-001 , api-1 , 10.0.0.8 \n i-002 , worker , 10.0.0.9 ",
    );

    expect(table.headers).toEqual([" instance_id ", "name", "private_ip"]);
    expect(table.rows).toEqual([
      {
        rowId: "row-1",
        cells: {
          " instance_id ": " i-001 ",
          name: " api-1 ",
          private_ip: " 10.0.0.8 ",
        },
      },
      {
        rowId: "row-2",
        cells: {
          " instance_id ": " i-002 ",
          name: " worker ",
          private_ip: " 10.0.0.9 ",
        },
      },
    ]);
  });

  it("records parser warnings without throwing", () => {
    const table = parseCsvInventory('id,name\n"a-1,api');

    expect(table.rows).toHaveLength(1);
    expect(table.warnings.length).toBeGreaterThan(0);
    expect(table.warnings[0]).toMatchObject({
      severity: "warning",
      column: "MissingQuotes",
    });
  });

  it("sanitizes blank and duplicate headers into stable unique labels", () => {
    const table = parseCsvInventory("name,name,,类型\napi,api-copy,orphan,ECS");

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
