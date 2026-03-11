export interface ToolUseEntry {
  name: string;
  input: string;
}

export interface ThinkingEntry {
  content: string;
  durationMs?: number;
}

export interface ResultMeta {
  costUsd: number;
  durationMs: number;
  numTurns: number;
  isError: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolUse?: ToolUseEntry[];
  thinking?: ThinkingEntry[];
  resultMeta?: ResultMeta;
}

export interface ChatSession {
  sessionId: string;
  title: string;
  lastModified: number;
  firstPrompt: string | null;
}
