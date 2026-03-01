/**
 * API Layer for LLM Shell
 * Provides typed HTTP client with error handling
 */

import type {
  ApiError as ApiErrorType,
  ServerGroup,
  ServerGroupInput,
  Server,
  ServerInput,
  KeyPair,
  KeyPairInput,
  CommandLog,
  Settings,
  SettingsUpdate,
  SSHConfigEntry,
  SSHConfigImportResult,
  ChatRequest,
} from '../types';

// ============================================================================
// Constants
// ============================================================================

/** Base URL for all API requests (proxied through Vite dev server) */
export const BASE_URL = '/api';

// ============================================================================
// Error Handling
// ============================================================================

/** Custom error class for API errors */
export class ApiError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

// ============================================================================
// HTTP Client
// ============================================================================

/**
 * Generic request function that wraps fetch with error handling
 * @throws ApiError on 4xx/5xx responses
 * @returns Parsed JSON response on success
 */
export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = (await res.json()) as { error: ApiErrorType };
    throw new ApiError(body.error.code, body.error.message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ============================================================================
// Server Groups API
// ============================================================================

/** Get all server groups */
export async function getGroups(): Promise<ServerGroup[]> {
  return request<ServerGroup[]>('/groups');
}

/** Create a new server group */
export async function createGroup(data: ServerGroupInput): Promise<ServerGroup> {
  return request<ServerGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update an existing server group */
export async function updateGroup(
  id: string,
  data: ServerGroupInput
): Promise<ServerGroup> {
  return request<ServerGroup>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Delete a server group */
export async function deleteGroup(id: string): Promise<void> {
  return request<void>(`/groups/${id}`, { method: 'DELETE' });
}

// ============================================================================
// Servers API
// ============================================================================

/** Get all servers, optionally filtered by group */
export async function getServers(groupId?: string): Promise<Server[]> {
  const query = groupId ? `?group_id=${groupId}` : '';
  return request<Server[]>(`/servers${query}`);
}

/** Create a new server */
export async function createServer(data: ServerInput): Promise<Server> {
  return request<Server>('/servers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update an existing server */
export async function updateServer(
  id: string,
  data: ServerInput
): Promise<Server> {
  return request<Server>(`/servers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Delete a server */
export async function deleteServer(id: string): Promise<void> {
  return request<void>(`/servers/${id}`, { method: 'DELETE' });
}

// ============================================================================
// KeyPairs API
// ============================================================================

/** Get all SSH key pairs */
export async function getKeyPairs(): Promise<KeyPair[]> {
  return request<KeyPair[]>('/keypairs');
}

/** Create a new SSH key pair */
export async function createKeyPair(data: KeyPairInput): Promise<KeyPair> {
  return request<KeyPair>('/keypairs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update an existing SSH key pair */
export async function updateKeyPair(
  id: string,
  data: KeyPairInput
): Promise<KeyPair> {
  return request<KeyPair>(`/keypairs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Delete an SSH key pair */
export async function deleteKeyPair(id: string): Promise<void> {
  return request<void>(`/keypairs/${id}`, { method: 'DELETE' });
}

// ============================================================================
// Command Logs API
// ============================================================================

/** Get command logs for a server */
export async function getCommandLogs(
  serverId: string,
  offset = 0,
  limit = 50,
  source?: 'manual' | 'ai'
): Promise<{ items: CommandLog[]; total: number }> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (source) {
    params.append('source', source);
  }
  return request<{ items: CommandLog[]; total: number }>(
    `/servers/${serverId}/commands?${params.toString()}`
  );
}

// ============================================================================
// Settings API
// ============================================================================

/** Get all application settings */
export async function getSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

/** Update application settings (partial update) */
export async function updateSettings(data: SettingsUpdate): Promise<Settings> {
  return request<Settings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// SSH Config Import API
// ============================================================================

/** Preview SSH config entries to import */
export async function previewSSHConfig(): Promise<{ entries: SSHConfigEntry[] }> {
  return request<{ entries: SSHConfigEntry[] }>('/import/ssh-config/preview');
}

/** Import selected SSH config entries */
export async function importSSHConfig(
  selected: string[]
): Promise<SSHConfigImportResult> {
  return request<SSHConfigImportResult>('/import/ssh-config', {
    method: 'POST',
    body: JSON.stringify({ selected }),
  });
}

// ============================================================================
// AI Chat API (SSE)
// ============================================================================

/**
 * Start an AI chat session (returns EventSource-like interface)
 * Note: Uses POST with SSE response, handled via fetch + ReadableStream
 */
export async function chat(
  _sessionId: string,
  _message: string
): Promise<void> {
  // Placeholder - SSE streaming will be implemented when needed
  // This signature matches the expected interface
  throw new Error('SSE chat not yet implemented');
}

// For type compatibility with ChatRequest
export type { ChatRequest };
