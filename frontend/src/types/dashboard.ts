export interface QueryTrace {
  id: string;
  prompt: string;
  similarity: number;
  latencyMs: number;
  recordedAt: Date;
  actualCacheHit: boolean;
}