/**
 * Normalize a Vimeo reference into a bare numeric video id.
 *
 * Admin forms historically stored full URLs ("https://vimeo.com/123456789",
 * player embed links, unlisted links with a hash suffix) while the player
 * needs the numeric id. Accepts a bare id or any vimeo.com URL; returns null
 * for anything that doesn't contain one (placeholders, other hosts, junk).
 */
export function parseVimeoId(value: string | null | undefined): string | null {
    const input = value?.trim();
    if (!input) return null;

    if (/^\d+$/.test(input)) return input;

    const url = input.match(/^https?:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)(?:[/?#]|$)/);
    return url ? url[1] : null;
}
