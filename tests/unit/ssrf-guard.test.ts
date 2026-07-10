import { describe, it, expect } from 'vitest'
import { assertSafeUrl } from '@/app/lib/ssrf-guard'

describe('ssrf-guard: assertSafeUrl', () => {
    it('accepts public http(s) URLs', () => {
        expect(() => assertSafeUrl('https://example.com/img.jpg')).not.toThrow()
        expect(() => assertSafeUrl('http://cdn.shopify.com/a.png')).not.toThrow()
    })

    it('rejects non-http(s) schemes', () => {
        expect(() => assertSafeUrl('file:///etc/passwd')).toThrow()
        expect(() => assertSafeUrl('ftp://example.com')).toThrow()
        expect(() => assertSafeUrl('gopher://example.com')).toThrow()
    })

    it('rejects localhost and loopback', () => {
        expect(() => assertSafeUrl('http://localhost/admin')).toThrow()
        expect(() => assertSafeUrl('http://127.0.0.1/')).toThrow()
        expect(() => assertSafeUrl('http://[::1]/')).toThrow()
    })

    it('rejects private and link-local IP literals', () => {
        expect(() => assertSafeUrl('http://10.0.0.5/')).toThrow()
        expect(() => assertSafeUrl('http://192.168.1.1/')).toThrow()
        expect(() => assertSafeUrl('http://172.16.0.1/')).toThrow()
        expect(() => assertSafeUrl('http://172.31.255.255/')).toThrow()
        // cloud metadata endpoint
        expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow()
    })

    it('allows public IP literals outside private ranges', () => {
        expect(() => assertSafeUrl('http://172.32.0.1/')).not.toThrow()
        expect(() => assertSafeUrl('http://8.8.8.8/')).not.toThrow()
    })

    it('rejects malformed URLs', () => {
        expect(() => assertSafeUrl('not a url')).toThrow()
    })
})
