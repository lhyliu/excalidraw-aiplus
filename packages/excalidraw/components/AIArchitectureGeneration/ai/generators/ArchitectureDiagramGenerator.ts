/**
 * 架构图生成器
 * 从校准后的数据生成 Mermaid 语法架构图
 */

import { BaseAIGenerator } from "./base";
import type {
  AIResult,
  DiagramStyle,
  DiagramGenerationInput,
  NormalizedVmRow,
  ServiceGroup,
} from "../../types";

/** 架构图输出 */
interface DiagramOutput {
  mermaidCode: string;
  style: DiagramStyle;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    generatedAt: string;
  };
}

/** 架构图生成器 */
export class ArchitectureDiagramGenerator extends BaseAIGenerator<
  DiagramGenerationInput,
  DiagramOutput
> {
  readonly id = "architecture-diagram";
  readonly name = "架构图生成器";
  
  async generate(
    input: DiagramGenerationInput,
  ): Promise<AIResult<DiagramOutput>> {
    return this.generateWithRetry(async () => {
      const mermaidCode = this.generateMermaidCode(
        input.serviceGroups,
        input.normalizedRows,
        input.style,
        input.includeDetails,
      );
      
      return {
        mermaidCode,
        style: input.style,
        metadata: {
          nodeCount: input.serviceGroups.length,
          edgeCount: this.estimateEdgeCount(input.serviceGroups),
          generatedAt: new Date().toISOString(),
        },
      };
    });
  }
  
  validateOutput(output: unknown): output is DiagramOutput {
    if (typeof output !== "object" || output === null) return false;
    
    const obj = output as Record<string, unknown>;
    
    return (
      typeof obj.mermaidCode === "string" &&
      typeof obj.style === "string" &&
      typeof obj.metadata === "object" &&
      obj.metadata !== null
    );
  }
  
  /** 生成 Mermaid 代码 */
  private generateMermaidCode(
    groups: ServiceGroup[],
    rows: NormalizedVmRow[],
    style: DiagramStyle,
    includeDetails: boolean,
  ): string {
    switch (style) {
      case "microservices":
        return this.generateMicroservicesDiagram(groups, rows, includeDetails);
      case "layered":
        return this.generateLayeredDiagram(groups, rows, includeDetails);
      case "network":
        return this.generateNetworkDiagram(groups, rows, includeDetails);
      case "monolith":
      default:
        return this.generateMonolithDiagram(groups, rows, includeDetails);
    }
  }
  
  /** 生成微服务架构图 */
  private generateMicroservicesDiagram(
    groups: ServiceGroup[],
    rows: NormalizedVmRow[],
    includeDetails: boolean,
  ): string {
    const lines: string[] = ["graph TD"];
    
    // 添加服务节点
    groups.forEach((group, index) => {
      const nodeId = `S${index}`;
      const rowCount = group.rowIds.length;
      const label = includeDetails
        ? `${group.name}<br/>(${rowCount} instances)`
        : group.name;
      
      lines.push(`  ${nodeId}["${label}"]`);
    });
    
    // 添加连接关系（基于环境或集群）
    const environments = new Map<string, string[]>();
    groups.forEach((group, index) => {
      const groupRows = rows.filter((r) => group.rowIds.includes(r.rowId));
      const env = groupRows[0]?.vm.environment || "default";
      
      if (!environments.has(env)) {
        environments.set(env, []);
      }
      environments.get(env)!.push(`S${index}`);
    });
    
    // 同一环境下的服务互连
    environments.forEach((nodes) => {
      for (let i = 0; i < nodes.length - 1; i++) {
        lines.push(`  ${nodes[i]} -.-> ${nodes[i + 1]}`);
      }
    });
    
    return lines.join("\n");
  }
  
  /** 生成分层架构图 */
  private generateLayeredDiagram(
    groups: ServiceGroup[],
    rows: NormalizedVmRow[],
    includeDetails: boolean,
  ): string {
    const lines: string[] = ["graph TB"];
    
    // 按环境分层
    const envGroups = new Map<string, ServiceGroup[]>();
    groups.forEach((group) => {
      const groupRows = rows.filter((r) => group.rowIds.includes(r.rowId));
      const env = groupRows[0]?.vm.environment || "default";
      
      if (!envGroups.has(env)) {
        envGroups.set(env, []);
      }
      envGroups.get(env)!.push(group);
    });
    
    let subgraphIndex = 0;
    envGroups.forEach((envServices, env) => {
      lines.push(`  subgraph ${env}["${env}"]`);
      
      envServices.forEach((service, idx) => {
        const nodeId = `S${subgraphIndex}_${idx}`;
        const label = includeDetails
          ? `${service.name}<br/>(${service.rowIds.length} instances)`
          : service.name;
        lines.push(`    ${nodeId}["${label}"]`);
      });
      
      lines.push("  end");
      subgraphIndex++;
    });
    
    return lines.join("\n");
  }
  
  /** 生成网络拓扑图 */
  private generateNetworkDiagram(
    groups: ServiceGroup[],
    rows: NormalizedVmRow[],
    includeDetails: boolean,
  ): string {
    const lines: string[] = ["graph LR"];
    
    // 按集群分组
    const clusterGroups = new Map<string, ServiceGroup[]>();
    groups.forEach((group) => {
      const groupRows = rows.filter((r) => group.rowIds.includes(r.rowId));
      const cluster = groupRows[0]?.vm.cluster || "default";
      
      if (!clusterGroups.has(cluster)) {
        clusterGroups.set(cluster, []);
      }
      clusterGroups.get(cluster)!.push(group);
    });
    
    // 创建集群子图
    let clusterIndex = 0;
    clusterGroups.forEach((clusterServices, cluster) => {
      lines.push(`  subgraph ${cluster}["Cluster: ${cluster}"]`);
      
      clusterServices.forEach((service, idx) => {
        const nodeId = `C${clusterIndex}_S${idx}`;
        const label = includeDetails
          ? `${service.name}<br/>${service.rowIds.map(
              (id) => rows.find((r) => r.rowId === id)?.vm.privateIp,
            ).join(", ")}`
          : service.name;
        lines.push(`    ${nodeId}["${label}"]`);
      });
      
      lines.push("  end");
      clusterIndex++;
    });
    
    return lines.join("\n");
  }
  
  /** 生成单体架构图 */
  private generateMonolithDiagram(
    groups: ServiceGroup[],
    rows: NormalizedVmRow[],
    includeDetails: boolean,
  ): string {
    const lines: string[] = ["graph TB"];
    
    // 简化的单体表示
    lines.push(`  App["Application<br/>(${rows.length} servers)"]`);
    
    if (includeDetails) {
      const dbNodes = groups.filter((g) =>
        g.name.toLowerCase().includes("db") ||
        g.name.toLowerCase().includes("database"),
      );
      
      if (dbNodes.length > 0) {
        lines.push(`  DB[("Database")]`);
        lines.push(`  App --> DB`);
      }
    }
    
    return lines.join("\n");
  }
  
  /** 估算边数 */
  private estimateEdgeCount(groups: ServiceGroup[]): number {
    // 简化估算
    return Math.max(0, groups.length - 1);
  }
}

/** 快速生成架构图 */
export async function quickGenerateDiagram(
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
  style: DiagramStyle = "microservices",
): Promise<string | null> {
  const generator = new ArchitectureDiagramGenerator();
  
  const result = await generator.generate({
    serviceGroups: groups,
    normalizedRows: rows,
    style,
    includeDetails: true,
  });
  
  return result.success ? result.data.mermaidCode : null;
}
