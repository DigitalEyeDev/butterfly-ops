/**
 * A real map preview without adding a mapping library/API-key dependency —
 * OpenStreetMap's public embed endpoint takes a bounding box + marker and
 * needs nothing but an iframe. Good enough for "does this pin look right,"
 * which is all a location-verification preview needs to do.
 */
export function MapPreview({
  lat,
  lng,
  className,
  spanDegrees = 0.006,
}: {
  lat: number;
  lng: number;
  className?: string;
  /** How wide a window to show, in degrees — ~0.006 is roughly a 600m view. */
  spanDegrees?: number;
}) {
  const bbox = [lng - spanDegrees, lat - spanDegrees, lng + spanDegrees, lat + spanDegrees].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className={className}>
      <iframe
        src={src}
        title="Location preview"
        loading="lazy"
        className="h-full w-full rounded-[var(--radius-sm)] border border-border"
      />
    </div>
  );
}
