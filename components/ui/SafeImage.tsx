"use client";

import { useState, ImgHTMLAttributes } from "react";
import { FALLBACK_IMAGE_URL } from "@/app/lib/constants";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    /** A nullable image column is fine: a missing source shows the fallback. */
    src?: ImgHTMLAttributes<HTMLImageElement>['src'] | null;
    fallbackSrc?: string;
    showIconOnFailure?: boolean;
}

export default function SafeImage({
    src,
    alt,
    className,
    fallbackSrc = FALLBACK_IMAGE_URL,
    showIconOnFailure = false,
    ...props
}: SafeImageProps) {
    const [imgSrc, setImgSrc] = useState<string | undefined>((src ?? undefined) as string | undefined);
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
        if (!hasError) {
            setImgSrc(fallbackSrc);
            setHasError(true);
        }
    };

    if (hasError && showIconOnFailure) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
                <ImageOff size={24} />
            </div>
        );
    }

    return (
        <img
            src={imgSrc || fallbackSrc}
            alt={alt || "Image"}
            className={className}
            onError={handleError}
            {...props}
        />
    );
}
