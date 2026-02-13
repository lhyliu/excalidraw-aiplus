/**
 * AI生成器基类
 * 定义统一的AI生成器接口和基础实现
 */

import type { AIResult, AIGenerator } from "../../types";

/** 基础生成器配置 */
interface BaseGeneratorConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/** 基础AI生成器 */
export abstract class BaseAIGenerator<TInput, TOutput>
  implements AIGenerator<TInput, TOutput>
{
  abstract readonly id: string;
  abstract readonly name: string;
  
  protected config: Required<BaseGeneratorConfig>;
  
  constructor(config: BaseGeneratorConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 30000,
    };
  }
  
  /** 生成方法 - 子类实现 */
  abstract generate(input: TInput): Promise<AIResult<TOutput>>;
  
  /** 验证输出 - 子类实现 */
  abstract validateOutput(output: unknown): output is TOutput;
  
  /** 带重试的生成 */
  protected async generateWithRetry(
    generateFn: () => Promise<TOutput>,
  ): Promise<AIResult<TOutput>> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          generateFn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("生成超时")),
              this.config.timeout,
            ),
          ),
        ]);
        
        if (this.validateOutput(result)) {
          return {
            success: true,
            data: result,
            confidence: 0.9, // 默认置信度
          };
        } else {
          return {
            success: false,
            error: "输出格式无效",
            retryable: true,
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 最后一次尝试，不再重试
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || "生成失败",
      retryable: true,
    };
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** 生成器注册表 */
export class GeneratorRegistry {
  private generators = new Map<string, AIGenerator<unknown, unknown>>();
  
  /** 注册生成器 */
  register<TInput, TOutput>(
    generator: AIGenerator<TInput, TOutput>,
  ): void {
    this.generators.set(generator.id, generator as AIGenerator<unknown, unknown>);
  }
  
  /** 获取生成器 */
  get<TInput, TOutput>(id: string): AIGenerator<TInput, TOutput> | undefined {
    return this.generators.get(id) as AIGenerator<TInput, TOutput> | undefined;
  }
  
  /** 检查生成器是否存在 */
  has(id: string): boolean {
    return this.generators.has(id);
  }
  
  /** 获取所有生成器 */
  getAll(): AIGenerator<unknown, unknown>[] {
    return Array.from(this.generators.values());
  }
  
  /** 移除生成器 */
  unregister(id: string): boolean {
    return this.generators.delete(id);
  }
}

/** 全局生成器注册表实例 */
export const globalGeneratorRegistry = new GeneratorRegistry();
