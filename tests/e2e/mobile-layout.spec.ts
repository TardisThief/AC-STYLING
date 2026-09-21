import { test, expect } from '@playwright/test'

/**
 * Mobile layout containment (F14).
 *
 * The assessment recorded that at 360px the home page's document width is
 * 374px, and at 390px it is 404px. Both reproduce. Investigated rather than
 * "fixed", and the 14px turns out not to be a defect:
 *
 *   - the only over-wide element is the TrustedBy marquee track (~4000px), by
 *     design, since it scrolls;
 *   - its container is `overflow-hidden`, and `body` carries
 *     `overflow-x: hidden`, which propagates to the viewport because `html` is
 *     `visible`;
 *   - so `scrollWidth` reports the track's layout extent while the viewport
 *     clips it, and a user cannot scroll sideways at all.
 *
 * Asserting `scrollWidth <= clientWidth` would therefore fail forever for a
 * harmless reason. What actually matters to someone holding a phone is whether
 * the page slides under their thumb, so that is what these check.
 */

const phoneWidths = [360, 390, 414]

for (const width of phoneWidths) {
    test(`the home page cannot be scrolled sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto('/en')
        await page.waitForLoadState('networkidle')

        const scrollX = await page.evaluate(() => {
            window.scrollTo(9999, 0)
            const x = window.scrollX
            window.scrollTo(0, 0)
            return x
        })

        expect(scrollX, 'the page scrolled horizontally, so content is escaping the viewport').toBe(0)
    })
}

test('no element escapes the viewport unclipped at 360px', async ({ page }) => {
    // The complement of the test above: nothing should be sitting past the
    // right edge *without* a clipping ancestor. That is the shape a real
    // overflow bug takes, and it would not be caught by the scroll check alone
    // if body's overflow rule were ever removed.
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/en')
    await page.waitForLoadState('networkidle')

    const escaping = await page.evaluate(() => {
        const win = window.innerWidth
        const clipped = (el: Element) => {
            let p: Element | null = el.parentElement
            while (p) {
                const ox = getComputedStyle(p).overflowX
                if (ox !== 'visible') return true
                p = p.parentElement
            }
            return false
        }
        const out: string[] = []
        document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0 && r.right > win + 1 && !clipped(el)) {
                out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 60)}`)
            }
        })
        return out
    })

    expect(escaping).toEqual([])
})
