/**
 * Environment flag parsing.
 *
 * These exist because of a real misconfiguration: `VAULT_REVEAL_UPCOMING` was
 * set to `TRUE` in the Vercel dashboard while the code compared `=== 'true'`,
 * so the Vault catalogue stayed invisible with nothing in any log to explain
 * it. The uppercase case is the one that actually bit, so it is pinned first.
 */

import { describe, it, expect } from 'vitest'
import { isEnabled } from '@/app/lib/env-flags'

describe('isEnabled', () => {
    it('accepts TRUE, the spelling the dashboard produced', () => {
        expect(isEnabled('TRUE')).toBe(true)
    })

    it.each(['true', 'True', 'TRUE', ' true ', '1', 'yes', 'YES', 'on'])(
        'treats %j as enabled',
        (value) => expect(isEnabled(value)).toBe(true)
    )

    it.each(['false', 'FALSE', '0', 'no', 'off', '', '   '])(
        'treats %j as disabled',
        (value) => expect(isEnabled(value)).toBe(false)
    )

    it('is disabled when the variable is unset', () => {
        expect(isEnabled(undefined)).toBe(false)
    })

    it('does not enable on an unrelated value', () => {
        // A flag that must be explicitly switched on should not be switched on
        // by a typo either.
        expect(isEnabled('ture')).toBe(false)
        expect(isEnabled('enabled')).toBe(false)
    })
})
