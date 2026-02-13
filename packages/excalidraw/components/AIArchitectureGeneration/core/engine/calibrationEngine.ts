/**
 * 校准引擎
 * 从原 importWorkflow/calibrationEngine.ts 迁移
 */

import type {
  CalibrationTask,
  CalibrationTaskType,
  Issue,
  ServiceGroup,
  CalibrationState,
} from "../../types";

/** 校准引擎配置 */
export interface CalibrationEngineConfig {
  autoCreateTasks?: boolean;
  taskPriority?: ("issues" | "groups")[];
}

/** 校准引擎 */
export class CalibrationEngine {
  private tasks: CalibrationTask[] = [];
  private config: CalibrationEngineConfig;
  
  constructor(config: CalibrationEngineConfig = {}) {
    this.config = {
      autoCreateTasks: true,
      taskPriority: ["issues", "groups"],
      ...config,
    };
  }
  
  /** 从问题和分组创建校准任务 */
  createTasks(
    issues: Issue[],
    serviceGroups: ServiceGroup[],
  ): CalibrationTask[] {
    this.tasks = [];
    
    const priority = this.config.taskPriority || ["issues", "groups"];
    
    for (const type of priority) {
      if (type === "issues") {
        this.addIssueTasks(issues);
      } else if (type === "groups") {
        this.addGroupTasks(serviceGroups);
      }
    }
    
    return this.tasks;
  }
  
  /** 添加问题修复任务 */
  private addIssueTasks(issues: Issue[]): void {
    const blockingIssues = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    
    // 先添加阻塞性问题
    blockingIssues.forEach((issue) => {
      this.tasks.push({
        id: `task-issue-${issue.id}`,
        type: "resolve_issue",
        title: `修复: ${issue.message}`,
        blocking: true,
        done: false,
        issueId: issue.id,
      });
    });
    
    // 添加警告（非阻塞）
    warnings.forEach((issue) => {
      this.tasks.push({
        id: `task-issue-${issue.id}`,
        type: "resolve_issue",
        title: `检查: ${issue.message}`,
        blocking: false,
        done: false,
        issueId: issue.id,
      });
    });
  }
  
  /** 添加分组确认任务 */
  private addGroupTasks(groups: ServiceGroup[]): void {
    groups.forEach((group) => {
      this.tasks.push({
        id: `task-group-${group.id}`,
        type: "confirm_group",
        title: `确认服务分组: ${group.name} (${group.rowIds.length} 台)`,
        blocking: false,
        done: false,
        groupId: group.id,
      });
    });
  }
  
  /** 获取所有任务 */
  getTasks(): CalibrationTask[] {
    return [...this.tasks];
  }
  
  /** 获取待办任务 */
  getPendingTasks(): CalibrationTask[] {
    return this.tasks.filter((t) => !t.done);
  }
  
  /** 获取已完成任务 */
  getCompletedTasks(): CalibrationTask[] {
    return this.tasks.filter((t) => t.done);
  }
  
  /** 获取阻塞性任务 */
  getBlockingTasks(): CalibrationTask[] {
    return this.tasks.filter((t) => t.blocking && !t.done);
  }
  
  /** 完成任务 */
  completeTask(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.done = true;
      return true;
    }
    return false;
  }
  
  /** 取消完成任务 */
  uncompleteTask(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.done = false;
      return true;
    }
    return false;
  }
  
  /** 检查是否所有阻塞性任务都已完成 */
  isBlockingComplete(): boolean {
    return this.getBlockingTasks().length === 0;
  }
  
  /** 检查是否所有任务都已完成 */
  isComplete(): boolean {
    return this.tasks.length > 0 && this.getPendingTasks().length === 0;
  }
  
  /** 获取校准状态 */
  getState(): CalibrationState {
    return {
      tasks: this.tasks,
      status: this.isComplete() ? "confirmed" : "in_progress",
    };
  }
  
  /** 重置任务 */
  reset(): void {
    this.tasks = [];
  }
  
  /** 获取进度 */
  getProgress(): { total: number; completed: number; percentage: number } {
    const total = this.tasks.length;
    const completed = this.getCompletedTasks().length;
    
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

/** 创建默认校准引擎 */
export function createCalibrationEngine(
  config?: CalibrationEngineConfig,
): CalibrationEngine {
  return new CalibrationEngine(config);
}

/** 批量完成任务 */
export function batchCompleteTasks(
  engine: CalibrationEngine,
  taskIds: string[],
): { success: string[]; failed: string[] } {
  const success: string[] = [];
  const failed: string[] = [];
  
  taskIds.forEach((id) => {
    if (engine.completeTask(id)) {
      success.push(id);
    } else {
      failed.push(id);
    }
  });
  
  return { success, failed };
}
