import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  request,
  ApiError,
  BASE_URL,
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getServers,
  createServer,
  updateServer,
  deleteServer,
  getKeyPairs,
  createKeyPair,
  updateKeyPair,
  deleteKeyPair,
} from './api'
import type { ServerGroup, Server, KeyPair } from '../types'

describe('api', () => {
  describe('BASE_URL', () => {
    it('is set to /api', () => {
      expect(BASE_URL).toBe('/api')
    })
  })

  describe('request', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('returns data on 200 response', async () => {
      const mockData = { id: '1', name: 'test' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response)

      const result = await request('/test')

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    it('throws ApiError on 4xx response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        }),
      } as Response)

      try {
        await request('/test')
        expect.fail('Expected ApiError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).code).toBe('BAD_REQUEST')
        expect((error as ApiError).message).toBe('Invalid input')
      }
    })

    it('throws ApiError on 5xx response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: { code: 'INTERNAL_ERROR', message: 'Server error' },
        }),
      } as Response)

      try {
        await request('/test')
        expect.fail('Expected ApiError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).code).toBe('INTERNAL_ERROR')
        expect((error as ApiError).message).toBe('Server error')
      }
    })
  })

  // ============================================================================
  // Groups CRUD API Tests
  // ============================================================================

  describe('Groups API', () => {
    const mockGroup: ServerGroup = {
      id: 'group-1',
      name: 'Production',
      color: '#FF6B6B',
      sort_order: 0,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    }

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    describe('getGroups', () => {
      it('makes GET request to /api/groups and returns groups array', async () => {
        const mockGroups = [mockGroup]
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockGroups,
        } as Response)

        const result = await getGroups()

        expect(result).toEqual(mockGroups)
        expect(fetch).toHaveBeenCalledWith('/api/groups', expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }))
      })
    })

    describe('createGroup', () => {
      it('makes POST request to /api/groups with group data', async () => {
        const input = { name: 'Production', color: '#FF6B6B' }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockGroup,
        } as Response)

        const result = await createGroup(input)

        expect(result).toEqual(mockGroup)
        expect(fetch).toHaveBeenCalledWith('/api/groups', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('updateGroup', () => {
      it('makes PUT request to /api/groups/:id with group data', async () => {
        const input = { name: 'Production Updated', color: '#00FF00' }
        const updatedGroup = { ...mockGroup, ...input }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedGroup,
        } as Response)

        const result = await updateGroup('group-1', input)

        expect(result).toEqual(updatedGroup)
        expect(fetch).toHaveBeenCalledWith('/api/groups/group-1', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('deleteGroup', () => {
      it('makes DELETE request to /api/groups/:id', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => undefined,
        } as Response)

        await deleteGroup('group-1')

        expect(fetch).toHaveBeenCalledWith('/api/groups/group-1', expect.objectContaining({
          method: 'DELETE',
        }))
      })
    })
  })

  // ============================================================================
  // Servers CRUD API Tests
  // ============================================================================

  describe('Servers API', () => {
    const mockServer: Server = {
      id: 'server-1',
      group_id: 'group-1',
      label: 'prod-web-01',
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 0,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    }

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    describe('getServers', () => {
      it('makes GET request to /api/servers and returns servers array', async () => {
        const mockServers = [mockServer]
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockServers,
        } as Response)

        const result = await getServers()

        expect(result).toEqual(mockServers)
        expect(fetch).toHaveBeenCalledWith('/api/servers', expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }))
      })

      it('makes GET request with group_id query parameter when provided', async () => {
        const mockServers = [mockServer]
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockServers,
        } as Response)

        const result = await getServers('group-1')

        expect(result).toEqual(mockServers)
        expect(fetch).toHaveBeenCalledWith('/api/servers?group_id=group-1', expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }))
      })
    })

    describe('createServer', () => {
      it('makes POST request to /api/servers with server data', async () => {
        const input = {
          label: 'prod-web-01',
          host: '192.168.1.100',
          username: 'root',
          auth_type: 'key' as const,
          key_id: 'key-1',
        }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockServer,
        } as Response)

        const result = await createServer(input)

        expect(result).toEqual(mockServer)
        expect(fetch).toHaveBeenCalledWith('/api/servers', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('updateServer', () => {
      it('makes PUT request to /api/servers/:id with server data', async () => {
        const input = { label: 'prod-web-01-updated', host: '192.168.1.101', username: 'root', auth_type: 'key' as const }
        const updatedServer = { ...mockServer, ...input }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedServer,
        } as Response)

        const result = await updateServer('server-1', input)

        expect(result).toEqual(updatedServer)
        expect(fetch).toHaveBeenCalledWith('/api/servers/server-1', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('deleteServer', () => {
      it('makes DELETE request to /api/servers/:id', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => undefined,
        } as Response)

        await deleteServer('server-1')

        expect(fetch).toHaveBeenCalledWith('/api/servers/server-1', expect.objectContaining({
          method: 'DELETE',
        }))
      })
    })
  })

  // ============================================================================
  // Keypairs CRUD API Tests
  // ============================================================================

  describe('Keypairs API', () => {
    const mockKeyPair: KeyPair = {
      id: 'key-1',
      label: 'My SSH Key',
      private_key_path: '/Users/user/.ssh/id_rsa',
      public_key_path: '/Users/user/.ssh/id_rsa.pub',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    }

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    describe('getKeyPairs', () => {
      it('makes GET request to /api/keypairs and returns keypairs array', async () => {
        const mockKeyPairs = [mockKeyPair]
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockKeyPairs,
        } as Response)

        const result = await getKeyPairs()

        expect(result).toEqual(mockKeyPairs)
        expect(fetch).toHaveBeenCalledWith('/api/keypairs', expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }))
      })
    })

    describe('createKeyPair', () => {
      it('makes POST request to /api/keypairs with keypair data', async () => {
        const input = {
          label: 'My SSH Key',
          private_key_path: '/Users/user/.ssh/id_rsa',
          passphrase: 'secret',
        }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockKeyPair,
        } as Response)

        const result = await createKeyPair(input)

        expect(result).toEqual(mockKeyPair)
        expect(fetch).toHaveBeenCalledWith('/api/keypairs', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('updateKeyPair', () => {
      it('makes PUT request to /api/keypairs/:id with keypair data', async () => {
        const input = { label: 'Updated Key', private_key_path: '/Users/user/.ssh/id_rsa' }
        const updatedKeyPair = { ...mockKeyPair, label: 'Updated Key' }
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedKeyPair,
        } as Response)

        const result = await updateKeyPair('key-1', input)

        expect(result).toEqual(updatedKeyPair)
        expect(fetch).toHaveBeenCalledWith('/api/keypairs/key-1', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(input),
        }))
      })
    })

    describe('deleteKeyPair', () => {
      it('makes DELETE request to /api/keypairs/:id', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => undefined,
        } as Response)

        await deleteKeyPair('key-1')

        expect(fetch).toHaveBeenCalledWith('/api/keypairs/key-1', expect.objectContaining({
          method: 'DELETE',
        }))
      })
    })
  })
})
