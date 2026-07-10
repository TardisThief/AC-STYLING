/**
 * SSRF protections for server actions that fetch or navigate to a
 * caller-supplied URL (image scraping, remote-image upload).
 *
 * Two layers:
 *  - `assertSafeUrl` — synchronous, cheap checks: scheme must be http(s), and
 *    any literal IP host must not be private / loopback / link-local.
 *  - `resolveAndAssertPublic` — resolves the hostname via DNS and rejects if any
 *    resolved address is private, catching DNS-rebinding and hostnames that map
 *    to internal ranges. Node-only (uses `dns`); safe in server actions.
 */

const PRIVATE_V4 = [
    /^127\./,             // loopback
    /^10\./,              // private
    /^192\.168\./,        // private
    /^169\.254\./,        // link-local (incl. cloud metadata 169.254.169.254)
    /^0\./,               // "this" network
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
];

function isPrivateV4(ip: string): boolean {
    if (PRIVATE_V4.some((re) => re.test(ip))) return true;
    // 172.16.0.0 – 172.31.255.255
    const m = /^172\.(\d+)\./.exec(ip);
    if (m) {
        const octet = Number(m[1]);
        if (octet >= 16 && octet <= 31) return true;
    }
    return false;
}

function isPrivateV6(ip: string): boolean {
    const addr = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (addr === '::1' || addr === '::') return true;      // loopback / unspecified
    if (addr.startsWith('fe80')) return true;              // link-local
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique local
    // IPv4-mapped (::ffff:127.0.0.1)
    const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)/.exec(addr);
    if (mapped) return isPrivateV4(mapped[1]);
    return false;
}

function isPrivateAddress(ip: string): boolean {
    return ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip);
}

/**
 * Synchronous validation. Throws on a disallowed scheme or a literal
 * private-IP host. Returns the parsed URL for reuse.
 */
export function assertSafeUrl(rawUrl: string): URL {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http(s) URLs are allowed');
    }

    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost') throw new Error('URL host is not allowed');

    // If the host is a literal IP, block private ranges up front.
    const looksLikeIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
    if (looksLikeIp && isPrivateAddress(host)) {
        throw new Error('URL host is not allowed');
    }

    return url;
}

/**
 * DNS-resolving validation. Rejects hostnames whose resolved addresses fall in
 * private ranges. Run this in addition to `assertSafeUrl` before fetching.
 */
export async function resolveAndAssertPublic(url: URL): Promise<void> {
    const host = url.hostname.replace(/^\[|\]$/g, '');

    // Literal IPs were already checked in assertSafeUrl.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return;

    const dns = await import('dns');
    const results = await dns.promises.lookup(host, { all: true });
    for (const { address } of results) {
        if (isPrivateAddress(address)) {
            throw new Error('URL host resolves to a private address');
        }
    }
}

/** Convenience: validate + DNS-check a raw URL string. Returns the parsed URL. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
    const url = assertSafeUrl(rawUrl);
    await resolveAndAssertPublic(url);
    return url;
}
