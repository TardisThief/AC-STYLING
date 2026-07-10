import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

// Mock Supabase client for unit tests
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
        })),
        rpc: vi.fn(),
    })),
}))

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
        })),
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(),
                getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.url/image.jpg' } })),
                createSignedUploadUrl: vi.fn(),
            })),
        },
    })),
}))

// Neutralize transactional email in tests. lib/resend constructs a Resend client
// at module load (`new Resend(process.env.RESEND_API_KEY)`), which throws when the
// key is unset — crashing any test that transitively imports it. Mocking the
// module here prevents that and stops accidental network sends. Tests that assert
// email behavior can import this mocked `sendEmail`.
vi.mock('@/lib/resend', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))
