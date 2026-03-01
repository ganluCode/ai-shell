/**
 * TypeScript type definitions for LLM Shell
 * Based on docs/data-api-design.md
 */

// ============================================================================
// Enum Types
// ============================================================================

/** SSH authentication method */
export type AuthType = 'key' | 'password';

/** Command risk level classification */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Source of command execution */
export type CommandSource = 'manual' | 'ai';

// ============================================================================
// Core Entity Interfaces
// ============================================================================

/** Server group for organizing servers */
export interface ServerGroup {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** SSH key pair */
export interface KeyPair {
  id: string;
  label: string;
  private_key_path: string;
  public_key_path: string | null;
  created_at: string;
  updated_at: string;
}

/** Server configuration */
export interface Server {
  id: string;
  group_id: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  auth_type: AuthType;
  key_id: string | null;
  proxy_jump: string | null;
  startup_cmd: string | null;
  notes: string | null;
  color: string | null;
  sort_order: number;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Command execution log */
export interface CommandLog {
  id: string;
  server_id: string;
  session_id: string;
  command: string;
  output_summary: string | null;
  risk_level: RiskLevel | null;
  source: CommandSource;
  executed_at: string;
}

/** Application settings */
export interface Settings {
  model: string;
  terminal_font: string;
  terminal_size: string;
  theme: string;
  output_buffer: string;
  context_lines: string;
  max_chat_rounds: string;
}

// ============================================================================
// Input Interfaces (for create/update operations)
// ============================================================================

/** Input for creating/updating a server group */
export interface ServerGroupInput {
  name: string;
  color?: string | null;
  sort_order?: number;
}

/** Input for creating/updating an SSH key pair */
export interface KeyPairInput {
  label: string;
  private_key_path: string;
  public_key_path?: string | null;
  passphrase?: string | null;
}

/** Input for creating/updating a server */
export interface ServerInput {
  group_id?: string | null;
  label: string;
  host: string;
  port?: number;
  username: string;
  auth_type: AuthType;
  key_id?: string | null;
  password?: string | null;
  proxy_jump?: string | null;
  startup_cmd?: string | null;
  notes?: string | null;
  color?: string | null;
  sort_order?: number;
}

/** Partial update for application settings */
export interface SettingsUpdate {
  model?: string;
  terminal_font?: string;
  terminal_size?: string;
  theme?: string;
  output_buffer?: string;
  context_lines?: string;
  max_chat_rounds?: string;
  api_key?: string;
}

// ============================================================================
// AI Chat Interfaces
// ============================================================================

/** Request to start an AI chat */
export interface ChatRequest {
  session_id: string;
  message: string;
}

/** AI-generated command suggestion */
export interface CommandSuggestion {
  command: string;
  explanation: string;
  risk_level: RiskLevel;
}

/** SSE event from AI chat endpoint (discriminated union) */
export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'command'; suggestion: CommandSuggestion; thinking?: string }
  | { type: 'commands'; suggestions: CommandSuggestion[]; thinking?: string }
  | { type: 'error'; error: { code: string; message: string } }
  | { type: 'done' };

// ============================================================================
// SSH Config Import Interfaces
// ============================================================================

/** Parsed entry from ~/.ssh/config */
export interface SSHConfigEntry {
  label: string;
  host: string | null;
  username: string | null;
  port: number;
  identity_file: string | null;
  proxy_jump: string | null;
  already_exists: boolean;
}

/** Input for importing selected SSH config entries */
export interface SSHConfigImportInput {
  selected: string[];
}

/** Result of SSH config import operation */
export interface SSHConfigImportResult {
  imported: number;
  servers: Server[];
}

// ============================================================================
// Error Interface
// ============================================================================

/** API error response */
export interface ApiError {
  code: string;
  message: string;
}
