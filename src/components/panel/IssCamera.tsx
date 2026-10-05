import type { IssMediaSource } from "@/lib/sources/nasa/iss-media";

const BUTTON =
  "flex h-8 items-center justify-center gap-2 rounded border text-[10px] font-medium tracking-[0.2em] transition-colors";

/**
 * Official NASA stream for the ISS, inside the ISS panel. The iframe exists
 * only while `open` is true: nothing from YouTube loads before VIEW CAMERA,
 * and closing removes it from the DOM (which stops the player). Never claims
 * the video is live: NASA may show previously recorded footage.
 */
export default function IssCamera({
  media,
  open,
  onOpenChange,
}: {
  media: IssMediaSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <section className="border-t border-line px-4 py-3">
      <h3 className="mb-2 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">CAMERA</h3>
      <p className="text-[12px] text-fg">ISS camera</p>
      <p className="text-[11px] leading-snug text-fg-subtle">Official {media.provider} stream</p>

      {open ? (
        <>
          <div className="mt-3 aspect-video w-full overflow-hidden rounded border border-line bg-base">
            <iframe
              src={media.embedUrl}
              title={`${media.provider} ISS stream (YouTube)`}
              className="h-full w-full"
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-fg-subtle">
            Feed availability varies. {media.provider} may display previously recorded
            footage when live camera video is unavailable.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={media.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON} border-line text-fg-muted hover:border-line-strong hover:text-fg`}
            >
              OPEN ON YOUTUBE
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`${BUTTON} border-line text-fg-muted hover:border-line-strong hover:text-fg`}
            >
              CLOSE CAMERA
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[11px] leading-snug text-fg-subtle">
            External video provided by {media.provider} via YouTube. It loads only when
            you open it.
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className={`${BUTTON} mt-3 w-full border-gold/40 text-gold hover:border-gold/70`}
          >
            VIEW CAMERA
          </button>
        </>
      )}
    </section>
  );
}
