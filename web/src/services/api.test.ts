import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { request, ApiError, BASE_URL } from './api'

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
})
