export interface QueryTrace {
  id: string;
  prompt: string;
  similarity: number | null;
  latencyMs: number;
  recordedAt: Date;
  actualCacheHit: boolean;
}
