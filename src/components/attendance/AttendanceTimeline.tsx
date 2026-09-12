import { MapPin, MapPinOff, Camera } from "lucide-react";
import { formatClockTime } from "@/lib/attendance";
import { MapPreview } from "@/components/attendance/MapPreview";
import { LOCATION_STATUS_LABELS } from "@/lib/types";
import type { AttendanceEvent } from "@/lib/types";

const EVENT_LABEL: Record<string, string> = {
  CLOCK_IN: "Clock in",
  LUNCH_START: "Lunch start",
  LUNCH_END: "Lunch end",
  CLOCK_OUT: "Clock out",
};

export function AttendanceTimeline({ events }: { events: AttendanceEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">No events recorded yet today.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {events.map((event) => {
        const verified = event.location_status === "VERIFIED";
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{EVENT_LABEL[event.event_type]}</p>
              <p className="text-sm font-medium tabular-nums text-muted">{formatClockTime(event.event_timestamp)}</p>
            </div>

            <div className="mt-1 space-y-0.5 text-sm text-muted">
              {event.evidence_image_url && (
                <p className="inline-flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Selfie captured
                </p>
              )}
              <p className={verified ? "inline-flex items-center gap-1.5 text-success" : "inline-flex items-center gap-1.5"}>
                {verified ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}
                {LOCATION_STATUS_LABELS[event.location_status]}
                {event.distance_from_park_meters !== null && ` · ${Math.round(event.distance_from_park_meters)}m`}
                {event.accuracy_meters !== null && ` · ±${Math.round(event.accuracy_meters)}m`}
              </p>
              {event.latitude !== null && event.longitude !== null && (
                <a
                  href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-medium text-brand hover:underline"
                >
                  Open in Maps
                </a>
              )}
            </div>

            {(event.evidence_image_url || (event.latitude !== null && event.longitude !== null)) && (
              <div className="mt-2 flex gap-2">
                {event.evidence_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.evidence_image_url} alt="Attendance selfie" className="h-24 w-24 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                )}
                {event.latitude !== null && event.longitude !== null && (
                  <MapPreview lat={event.latitude} lng={event.longitude} className="h-24 w-full max-w-[220px]" />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
