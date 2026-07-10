import { describe, it, expect, vi, beforeEach } from 'vitest'

// linkIntakeProfile is a thin wrapper that dynamically imports and delegates to
// activateStudioAccess (the robust activation logic lives in the studio actions).
// The deep transfer/merge behavior is that function's responsibility; here we
// verify the delegation contract.
vi.mock('@/app/actions/studio', () => ({
    activateStudioAccess: vi.fn(),
}))

import { linkIntakeProfile } from '@/app/actions/auth'
import { activateStudioAccess } from '@/app/actions/studio'

describe('Auth Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('linkIntakeProfile', () => {
        it('delegates to activateStudioAccess with the token and returns its result', async () => {
            vi.mocked(activateStudioAccess).mockResolvedValue({ success: true })

            const result = await linkIntakeProfile('token-abc')

            expect(activateStudioAccess).toHaveBeenCalledWith('token-abc')
            expect(result).toEqual({ success: true })
        })

        it('propagates an error result from activateStudioAccess', async () => {
            vi.mocked(activateStudioAccess).mockResolvedValue({ success: false, error: 'Unauthorized' })

            const result = await linkIntakeProfile('token-xyz')

            expect(result).toEqual({ success: false, error: 'Unauthorized' })
        })
    })
})
