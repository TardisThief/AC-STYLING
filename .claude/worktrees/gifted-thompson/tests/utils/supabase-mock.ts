/**
 * Supabase Mock Utilities
 * 
 * Provides proper query chain mocking for Vitest tests.
 * Supabase's query builder returns `this` for method chaining,
 * so mocks need to return objects with all potential methods.
 */

import { vi } from 'vitest'

/**
 * Creates a chainable mock that returns itself for all methods.
 * Use this for queries that need to support arbitrary method chains.
 * 
 * @param finalResult The final result to return when the query is awaited
 * @returns A proxy that returns itself for any method call
 */
export function createChainableMock(finalResult: any = { data: null, error: null }) {
    const chainProxy: any = new Proxy({}, {
        get(_, prop) {
            // When we hit 'then', return the promise behavior
            if (prop === 'then') {
                return (resolve: Function) => resolve(finalResult)
            }
            // For any other method, return a function that returns the proxy
            return vi.fn(() => chainProxy)
        }
    })

    return chainProxy
}

/**
 * Creates a mock Supabase client with query builder support.
 * Each call to .from() can be given a specific result.
 */
export function createMockSupabaseClient() {
    const mockResults: Map<string, any> = new Map()
    const callCounts: Map<string, number> = new Map()

    const mockFrom = vi.fn((tableName: string) => {
        const count = callCounts.get(tableName) || 0
        callCounts.set(tableName, count + 1)

        const key = `${tableName}:${count}`
        const result = mockResults.get(key) || mockResults.get(tableName) || { data: null, error: null }

        return createChainableMock(result)
    })

    const mockAuth = {
        getUser: vi.fn(),
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
    }

    const mockStorage = {
        from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
            remove: vi.fn().mockResolvedValue({ error: null }),
            getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock.url/file.jpg' } })),
            createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://mock.url/upload', token: 'token' }, error: null }),
        })),
    }

    return {
        from: mockFrom,
        auth: mockAuth,
        storage: mockStorage,
        rpc: vi.fn(),

        // Helper to set expected results
        setQueryResult: (table: string, result: any, callIndex?: number) => {
            const key = callIndex !== undefined ? `${table}:${callIndex}` : table
            mockResults.set(key, result)
        },

        // Helper to clear state between tests
        reset: () => {
            mockFrom.mockClear()
            mockResults.clear()
            callCounts.clear()
            Object.values(mockAuth).forEach(fn => fn.mockClear())
        }
    }
}

/**
 * Type for the mock client
 */
export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
