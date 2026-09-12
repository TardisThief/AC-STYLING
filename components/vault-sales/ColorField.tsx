"use client";

import { useEffect, useRef } from "react";

/**
 * The one bold element on the page.
 *
 * A season is not a box. Module 3 of Colorimetría teaches that it is a position
 * across temperature, value and intensity, so the honest drawing is a
 * continuous field in which the four seasons emerge as soft regions — not four
 * labelled swatches, which is both the category cliché and a misstatement of
 * the curriculum.
 *
 * The four anchors sit at their real coordinates (warm/cool on x, light/dark on
 * y) and every pixel is an inverse-distance blend of them, so there are no
 * borders anywhere. A twelve-part subdivision is drawn at an alpha low enough
 * to register as texture but not to be read: you can see that more precision
 * exists without being able to locate yourself in it. That is the 4 / 12
 * boundary made visual, and it sits directly beside the copy that states it.
 *
 * No text is ever placed on the field — it is background and accent only, which
 * keeps it clear of the contrast floor.
 */

// Season anchors: [x = warm->cool, y = light->dark, colour]
const ANCHORS: Array<[number, number, [number, number, number]]> = [
    [0.24, 0.26, [216, 182, 92]],  // spring  — warm, light
    [0.24, 0.76, [169, 106, 62]],  // autumn  — warm, deep
    [0.78, 0.28, [159, 176, 190]], // summer  — cool, light
    [0.78, 0.74, [74, 74, 106]],   // winter  — cool, deep
];

// Low-resolution buffer, scaled up by CSS. The softness is a property of the
// drawing rather than a blur filter, and it keeps the per-pixel loop cheap.
const BUF_W = 220;
const BUF_H = 132;

function paint(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = BUF_W;
    canvas.height = BUF_H;

    const img = ctx.createImageData(BUF_W, BUF_H);
    const data = img.data;

    for (let py = 0; py < BUF_H; py++) {
        const y = py / (BUF_H - 1);
        for (let px = 0; px < BUF_W; px++) {
            const x = px / (BUF_W - 1);

            let r = 0, g = 0, b = 0, wsum = 0;
            for (const [ax, ay, [ar, ag, ab]] of ANCHORS) {
                const dx = x - ax;
                const dy = y - ay;
                // +epsilon keeps the anchor pixel itself finite.
                const d2 = dx * dx + dy * dy + 0.004;
                const w = 1 / (d2 * d2); // inverse distance^4 — soft but regional
                r += ar * w; g += ag * w; b += ab * w; wsum += w;
            }

            const i = (py * BUF_W + px) * 4;
            data[i] = r / wsum;
            data[i + 1] = g / wsum;
            data[i + 2] = b / wsum;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);

    // The twelve sub-seasons: present, deliberately unreadable.
    //
    // A uniform grid was the wrong drawing twice over -- it looked like a table
    // and it invited you to read a coordinate off it, which is the opposite of
    // what this says. Each line instead fades to nothing at the edges and peaks
    // faintly at the centre, so the subdivision only surfaces where the seasons
    // actually blend into each other. That is also where sub-seasons genuinely
    // live, and it leaves the four regions themselves clean.
    ctx.lineWidth = 1;

    const fade = (a: number, b: number, horizontal: boolean) => {
        const g = horizontal
            ? ctx.createLinearGradient(0, 0, BUF_W, 0)
            : ctx.createLinearGradient(0, 0, 0, BUF_H);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,255,255,0.085)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(a, b);
        horizontal ? ctx.lineTo(BUF_W, b) : ctx.lineTo(a, BUF_H);
        ctx.stroke();
    };

    for (let c = 1; c < 4; c++) fade((BUF_W / 4) * c, 0, false);
    for (let rIdx = 1; rIdx < 3; rIdx++) fade(0, (BUF_H / 3) * rIdx, true);
}

export default function ColorField({ label }: { label: string }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // One paint, on mount. Nothing animates: the graphic is an argument,
        // not an effect, so prefers-reduced-motion needs no separate branch.
        if (ref.current) paint(ref.current);
    }, []);

    return (
        <div
            role="img"
            aria-label={label}
            className="relative w-full overflow-hidden rounded-sm"
            style={{ aspectRatio: "220 / 132" }}
        >
            <canvas
                ref={ref}
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
                style={{ imageRendering: "auto" }}
            />
        </div>
    );
}
