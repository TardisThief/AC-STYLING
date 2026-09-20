/**
 * SSRF protections for server actions that fetch or navigate to a
 * caller-supplied URL (image scraping, remote-image upload).
 *
 * Three layers:
 *  - `assertSafeUrl` — synchronous: scheme must be http(s), and a literal IP
 *    host must not be private, loopback, link-local, multicast or reserved.
 *  - `resolveAndAssertPublic` — resolves the hostname and rejects if any
 *    resolved address is non-public, catching hostnames that map to internal
 *    ranges.
 *  - `safeFetch` — performs the request while re-validating **every redirect
 *    hop**, with a timeout and a byte cap. Validating only the URL the caller
 *    supplied is not enough: a public URL that 302s to 169.254.169.254 defeats
 *    the first two layers entirely (F07).
 *
 * Known residual risk: DNS is resolved for validation and again by the network
 * stack for the connection, so a name that changes answers between the two
 * (DNS rebinding) is not fully prevented. Closing that needs connecting to a
 * pinned address with an explicit Host header, which Node's fetch does not
 * expose. The byte cap, timeout, redirect checks and response-type checks are
 * what limit the damage in the meantime.
 */

const PRIVATE_V4 = [
    /^127\./,             // loopback
    /^10\./,              // private
    /^192\.168\./,        // private
    /^169\.254\./,        // link-local (incl. cloud metadata 169.254.169.254)
    /^0\./,               // "this" network
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
    /^192\.0\.0\./,       // IETF protocol assignments
    /^192\.0\.2\./,       // TEST-NET-1
    /^198\.51\.100\./,    // TEST-NET-2
    /^203\.0\.113\./,     // TEST-NET-3
];

function isPrivateV4(ip: string): boolean {
    if (PRIVATE_V4.some((re) => re.test(ip))) return true;

    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        // Not a well-formed dotted quad — refuse rather than guess.
        return true;
    }

    const [a, b] = octets;

    // 172.16.0.0 – 172.31.255.255
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 198.18.0.0/15 benchmarking
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved, which includes the
    // 255.255.255.255 broadcast address. Neither was covered before, so both
    // were reachable.
    if (a >= 224) return true;

    return false;
}

/**
 * Expand an IPv6 address to its eight 16-bit groups.
 *
 * Needed because the WHATWG URL parser normalises addresses: the hostname of
 * `http://[::ffff:127.0.0.1]/` comes back as `::ffff:7f00:1`. The previous
 * guard matched IPv4-mapped addresses with a dotted-decimal regex, which that
 * normalisation defeats — so loopback was reachable through an IPv6 literal.
 *
 * Returns null if the address is not parseable, which callers treat as unsafe.
 */
function expandV6(input: string): number[] | null {
    let addr = input.toLowerCase().replace(/^\[|\]$/g, '');

    // Drop a zone index (fe80::1%eth0).
    const pct = addr.indexOf('%');
    if (pct !== -1) addr = addr.slice(0, pct);

    // A trailing dotted quad (::ffff:127.0.0.1) becomes two hex groups.
    const tail = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
    if (tail) {
        const [, head, a, b, c, d] = tail;
        const q = [a, b, c, d].map(Number);
        if (q.some((n) => n > 255)) return null;
        addr = head +
            ((q[0] << 8) | q[1]).toString(16) + ':' +
            ((q[2] << 8) | q[3]).toString(16);
    }

    const halves = addr.split('::');
    if (halves.length > 2) return null;

    const parse = (part: string) =>
        part === '' ? [] : part.split(':').map((g) => parseInt(g, 16));

    const head = parse(halves[0]);
    const tailGroups = halves.length === 2 ? parse(halves[1]) : [];

    if ([...head, ...tailGroups].some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;

    let groups: number[];
    if (halves.length === 2) {
        const fill = 8 - head.length - tailGroups.length;
        if (fill < 0) return null;
        groups = [...head, ...Array(fill).fill(0), ...tailGroups];
    } else {
        groups = head;
    }

    return groups.length === 8 ? groups : null;
}

function isPrivateV6(ip: string): boolean {
    const groups = expandV6(ip);
    if (!groups) return true; // unparseable: fail closed

    const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

    // Unspecified (::) and loopback (::1).
    if (groups.every((g) => g === 0)) return true;
    if (groups.slice(0, 7).every((g) => g === 0) && g7 === 1) return true;

    const asV4 = (hi: number, lo: number) =>
        `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

    // IPv4-mapped ::ffff:a.b.c.d — the bypass that made loopback reachable.
    if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
        return isPrivateV4(asV4(g6, g7));
    }

    // IPv4-compatible ::a.b.c.d (deprecated but still routable by some stacks).
    if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
        return isPrivateV4(asV4(g6, g7));
    }

    // NAT64 well-known prefix 64:ff9b::/96 embeds an IPv4 destination.
    if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
        return isPrivateV4(asV4(g6, g7));
    }

    // fe80::/10 link-local (fe80–febf), not just the fe80 prefix.
    if ((g0 & 0xffc0) === 0xfe80) return true;

    // fc00::/7 unique local.
    if ((g0 & 0xfe00) === 0xfc00) return true;

    // ff00::/8 multicast, which was not covered before.
    if ((g0 & 0xff00) === 0xff00) return true;

    // 2001:db8::/32 documentation.
    if (g0 === 0x2001 && g1 === 0x0db8) return true;

    return false;
}

function isPrivateAddress(ip: string): boolean {
    return ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip);
}

/** Exposed for tests: classify a bare address string. */
export function isNonPublicAddress(ip: string): boolean {
    return isPrivateAddress(ip);
}

/**
 * Synchronous validation. Throws on a disallowed scheme or a literal
 * non-public IP host. Returns the parsed URL for reuse.
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
    if (host === 'localhost' || host.endsWith('.localhost')) {
        throw new Error('URL host is not allowed');
    }

    // Credentials in the URL are a redirect-laundering aid and never needed
    // for fetching a public image.
    if (url.username || url.password) {
        throw new Error('URL host is not allowed');
    }

    const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
    if (looksLikeIp && isPrivateAddress(host)) {
        throw new Error('URL host is not allowed');
    }

    return url;
}

/**
 * DNS-resolving validation. Rejects hostnames whose resolved addresses fall in
 * non-public ranges.
 */
export async function resolveAndAssertPublic(url: URL): Promise<void> {
    const host = url.hostname.replace(/^\[|\]$/g, '');

    // Literal IPs were already checked in assertSafeUrl.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return;

    const dns = await import('dns');
    const results = await dns.promises.lookup(host, { all: true });
    if (!results.length) throw new Error('URL host does not resolve');

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

export interface SafeFetchOptions {
    /** Abort the whole request after this long. */
    timeoutMs?: number;
    /** Refuse a body larger than this, whether or not it declares a length. */
    maxBytes?: number;
    /** How many redirects to follow, each one re-validated. */
    maxRedirects?: number;
    /** If given, the response's content-type must start with one of these. */
    allowedContentTypes?: readonly string[];
}

export interface SafeFetchResult {
    body: Uint8Array;
    contentType: string;
    /** The URL actually fetched, after redirects. */
    finalUrl: string;
}

const DEFAULTS = {
    timeoutMs: 10_000,
    maxBytes: 10 * 1024 * 1024,
    maxRedirects: 3,
};

/**
 * Fetch a caller-supplied URL with every hop validated.
 *
 * `fetch` follows redirects by default and does not tell you where it went, so
 * validating the caller's URL and then calling `fetch` protects nothing: one
 * 302 to a link-local address and the guard is bypassed. Here redirects are
 * handled manually so each `Location` goes through the same checks as the
 * original, and the body is read with a byte budget so a hostile endpoint
 * cannot exhaust memory by streaming forever.
 */
export async function safeFetch(
    rawUrl: string,
    options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
    const { timeoutMs, maxBytes, maxRedirects } = { ...DEFAULTS, ...options };

    let current = await assertPublicUrl(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        for (let hop = 0; hop <= maxRedirects; hop++) {
            const response = await fetch(current.toString(), {
                redirect: 'manual',
                signal: controller.signal,
                headers: { accept: '*/*' },
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) throw new Error('Redirect without a destination');
                if (hop === maxRedirects) throw new Error('Too many redirects');

                // Resolve relative redirects against the URL we just fetched,
                // then re-run the full check on the result. This is the hop
                // that used to be unvalidated.
                current = await assertPublicUrl(new URL(location, current).toString());
                continue;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }

            const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();

            if (options.allowedContentTypes?.length) {
                const ok = options.allowedContentTypes.some((t) => contentType.startsWith(t));
                if (!ok) throw new Error(`Unexpected content type: ${contentType || 'none'}`);
            }

            // Trust the declared length only to refuse early; the real limit is
            // enforced while reading, because the header can lie.
            const declared = Number(response.headers.get('content-length'));
            if (Number.isFinite(declared) && declared > maxBytes) {
                throw new Error('Response too large');
            }

            const body = await readCapped(response, maxBytes);
            return { body, contentType, finalUrl: current.toString() };
        }

        throw new Error('Too many redirects');
    } finally {
        clearTimeout(timer);
    }
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
    if (!response.body) {
        const buf = new Uint8Array(await response.arrayBuffer());
        if (buf.byteLength > maxBytes) throw new Error('Response too large');
        return buf;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new Error('Response too large');
        }
        chunks.push(value);
    }

    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out;
}
