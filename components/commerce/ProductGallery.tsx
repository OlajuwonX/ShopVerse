"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { cn } from "@/lib/cn";

type GalleryImage = {
  alt: string;
  publicId: string;
};

type ProductGalleryProps = {
  images: readonly GalleryImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const labelId = useId();
  const [activeIndex, setActiveIndex] = useState(0);

  const slides =
    images.length > 0
      ? images
      : [{ alt: productName, publicId: "" } satisfies GalleryImage];

  const showAt = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children.item(index);

    if (!track || !slide) {
      return;
    }

    track.scrollTo({ left: (slide as HTMLElement).offsetLeft, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track || slides.length < 2) {
      return;
    }

    let frame = 0;

    function onScroll() {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;

        const current = trackRef.current;

        if (!current) {
          return;
        }

        const index = Math.round(current.scrollLeft / current.clientWidth);
        setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
      });
    }

    track.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      track.removeEventListener("scroll", onScroll);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [slides.length]);

  return (
    <div className="grid gap-3">
      <ul
        aria-labelledby={labelId}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        ref={trackRef}
        tabIndex={0}
      >
        {slides.map((image, index) => (
          <li
            className="w-full shrink-0 snap-center"
            key={`${image.publicId}-${index}`}
          >
            <CloudinaryImage
              alt={index === 0 ? image.alt : `${productName}, image ${index + 1}`}
              displayWidth={720}
              priority={index === 0}
              publicId={image.publicId.length > 0 ? image.publicId : null}
              ratio="square"
              sizes="(min-width: 1024px) 40vw, 92vw"
            />
          </li>
        ))}
      </ul>

      <p className="sr-only" id={labelId}>
        {productName} gallery, {slides.length}{" "}
        {slides.length === 1 ? "image" : "images"}
      </p>

      {slides.length > 1 ? (
        <ul aria-label="Choose image" className="flex flex-wrap gap-2">
          {slides.map((image, index) => (
            <li key={`thumb-${image.publicId}-${index}`}>
              <button
                aria-current={index === activeIndex}
                className={cn(
                  "block size-16 overflow-hidden rounded-md border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  index === activeIndex ? "border-brand" : "border-border",
                )}
                onClick={() => {
                  showAt(index);
                }}
                type="button"
              >
                <CloudinaryImage
                  alt=""
                  displayWidth={64}
                  publicId={image.publicId.length > 0 ? image.publicId : null}
                  ratio="square"
                  sizes="64px"
                />
                <span className="sr-only">
                  Show image {index + 1} of {slides.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
