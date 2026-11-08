/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Memory Management & Working Set Optimization Data Types
 */

export interface ProcessMemoryDetail {
  pid: number;
  name: string;
  process_type: string;
  memory_before_mb: number;
  memory_after_mb: number;
  freed_mb: number;
}

export interface AntigravityMemorySummary {
  total_processes: number;
  total_memory_mb: number;
  ide_memory_mb: number;
  cli_memory_mb: number;
  sidecar_memory_mb: number;
  other_memory_mb: number;
}

export interface AntigravityMemoryPurgeResult {
  success: boolean;
  total_processes_trimmed: number;
  zombie_processes_killed: number;
  memory_before_mb: number;
  memory_after_mb: number;
  memory_freed_mb: number;
  details: ProcessMemoryDetail[];
  message: string;
}
