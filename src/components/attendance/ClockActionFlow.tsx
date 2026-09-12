"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, MapPin, RotateCcw, ShieldAlert, Loader2, Upload, AlertTriangle } from "lucide-react";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { recordAttendanceEvent } from "@/lib/actions/attendance";
import { haversineMeters, formatClockTime } from "@/lib/attendance";
import { useLiveCamera } from "@/components/attendance/useLiveCamera";
import { MapPreview } from "@/components/attendance/MapPreview";
import { cn } from "@/lib/utils";
import type { AttendanceEventType, Branch } from "@/lib/types";

type LocationResult = { lat: number; lng: number; accuracy: number };
type LocationErrorKind = "denied" | "unavailable";

const POOR_ACCURACY_METERS = 100;

const COPY: Record<
  AttendanceEventType,
  { title: string; verifyTitle: string; cta: string; successTitle: string; successBody: string; needsSelfie: boolean }
> = {
  CLOCK_IN: {
    title: "Clock in",
    verifyTitle: "Verify clock-in",
    cta: "Confirm clock-in",
    successTitle: "You're in. 🔥",
    successBody: "Clock-in confirmed. Have a great shift.",
    needsSelfie: true,
  },
  LUNCH_START: {
    title: "Start lunch",
    verifyTitle: "Verify lunch start",
    cta: "Confirm lunch start",
    successTitle: "Enjoy your lunch 🍽️",
    successBody: "Your 30-minute break starts now.",
    needsSelfie: false,
  },
  LUNCH_END: {
    title: "End lunch",
    verifyTitle: "Verify lunch end",
    cta: "Confirm lunch end",
    successTitle: "Welcome back",
    successBody: "You're back on shift.",
    needsSelfie: false,
  },
  CLOCK_OUT: {
    title: "Clock out",
    verifyTitle: "Verify clock-out",
    cta: "Confirm clock-out",
    successTitle: "Shift complete 🎉",
    successBody: "Clock-out confirmed. See you next shift.",
    needsSelfie: true,
  },
};

function getPosition(): Promise<LocationResult | { error: LocationErrorKind }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ error: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => resolve({ error: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function ClockActionFlow({
  eventType,
  open,
  onClose,
  branch,
}: {
  eventType: AttendanceEventType;
  open: boolean;
  onClose: () => void;
  branch: Pick<Branch, "attendance_lat" | "attendance_lng" | "attendance_radius_m">;
}) {
  const router = useRouter();
  const copy = COPY[eventType];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"selfie" | "location" | "confirm" | "submitting" | "success">(
    copy.needsSelfie ? "selfie" : "location"
  );
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState<LocationErrorKind | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

  // The viewfinder is only active while we're actually showing it — once a
  // photo is taken (live or via the fallback picker) the stream stops and
  // the camera light turns off, matching the "only during these four
  // events, never idle in the background" location/camera privacy rule.
  const cameraActive = step === "selfie" && !selfiePreview;
  // Destructured (rather than kept as one `camera` object accessed via
  // `camera.foo`) so the linter can tell `cameraVideoRef` — the one real
  // ref — apart from the plain state/callbacks alongside it; accessing
  // fields through a single object that also carries a ref gets flagged
  // as a ref-during-render read even for the non-ref fields.
  const { videoRef: cameraVideoRef, status: cameraStatus, capture: captureFrame, retry: retryCamera } = useLiveCamera(cameraActive);

  // No reset-on-reopen effect needed: the parent only ever mounts this
  // component while `activeFlow` is set (`{activeFlow && <ClockActionFlow .../>}`)
  // and unmounts it on close, so every open is already a fresh instance —
  // the useState initializers above are all the "reset" this needs.

  async function requestLocation() {
    setLocating(true);
    setLocationError(null);
    const result = await getPosition();
    setLocating(false);
    if ("error" in result) {
      setLocationError(result.error);
      return;
    }
    setLocation(result);
    if (result.accuracy <= POOR_ACCURACY_METERS) {
      setStep("confirm");
    }
  }

  useEffect(() => {
    if (step !== "location" || location || locationError || locating) return;
    // Deferred a tick so the geolocation call (and the setState calls it
    // makes) runs outside this effect's own synchronous execution — it's
    // a request to an external system (the browser's location API), not
    // state derived from props/state, so an effect is the right place to
    // kick it off; the timer just avoids the "setState in effect body" trap.
    const timer = setTimeout(() => requestLocation(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleCapture() {
    const file = captureFrame();
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  }

  function handleFallbackFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelfieFile(f);
    setSelfiePreview(URL.createObjectURL(f));
  }

  function retakeSelfie() {
    setSelfieFile(null);
    setSelfiePreview(null);
  }

  async function handleSubmit() {
    setStep("submitting");
    setSubmitError(undefined);
    try {
      const fd = new FormData();
      if (selfieFile) fd.set("selfie", selfieFile);
      if (location) {
        fd.set("latitude", String(location.lat));
        fd.set("longitude", String(location.lng));
        fd.set("accuracy_meters", String(location.accuracy));
        fd.set("location_permission", "granted");
      } else {
        fd.set("location_permission", locationError === "denied" ? "denied" : "unavailable");
      }
      const result = await recordAttendanceEvent(eventType, fd);
      if (result.ok) {
        setStep("success");
        router.refresh();
      } else {
        setSubmitError(result.error);
        setStep("confirm");
      }
    } catch {
      setSubmitError("Unable to verify attendance. Please check your connection and try again.");
      setStep("confirm");
    }
  }

  const distancePreview =
    location && branch.attendance_lat != null && branch.attendance_lng != null
      ? Math.round(haversineMeters(location.lat, location.lng, branch.attendance_lat, branch.attendance_lng))
      : null;
  const zoneConfigured = branch.attendance_lat != null && branch.attendance_lng != null;
  const withinZone = distancePreview !== null && distancePreview <= branch.attendance_radius_m;

  function handleClose() {
    if (step === "submitting") return;
    onClose();
  }

  return (
    <Overlay open={open} onClose={handleClose} title={step === "success" ? undefined : copy.title}>
      {step === "selfie" && (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <p className="text-sm text-muted">
            We&apos;ll use your camera to take a quick photo for attendance verification. It&apos;s only visible to you and
            park management — and only captured for this clock event, never in the background.
          </p>

          {selfiePreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selfiePreview} alt="Selfie preview" className="h-56 w-56 rounded-[var(--radius-md)] object-cover shadow-[var(--shadow-card)]" />
              <div className="flex w-full gap-2">
                <Button variant="outline" fullWidth onClick={retakeSelfie}>
                  <RotateCcw className="h-4 w-4" /> Retake
                </Button>
                <Button fullWidth onClick={() => setStep("location")}>
                  Use photo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-neutral-900 shadow-[var(--shadow-card)]">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "h-full w-full scale-x-[-1] object-cover transition-opacity",
                    cameraStatus === "ready" ? "opacity-100" : "opacity-0"
                  )}
                />

                {cameraStatus === "ready" && (
                  <span className="pointer-events-none absolute inset-8 rounded-full border-2 border-white/70" aria-hidden />
                )}

                {cameraStatus === "starting" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <span className="text-xs">Starting camera…</span>
                  </div>
                )}

                {(cameraStatus === "denied" || cameraStatus === "unavailable") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/90">
                    <ShieldAlert className="h-7 w-7" />
                    <p className="text-sm font-semibold">
                      {cameraStatus === "denied" ? "Camera access needed" : "Camera unavailable"}
                    </p>
                  </div>
                )}
              </div>

              {cameraStatus === "ready" && (
                <>
                  <p className="text-sm font-medium text-foreground">Position your face inside the frame</p>
                  <Button fullWidth size="lg" onClick={handleCapture}>
                    <Camera className="h-4 w-4" /> Capture selfie
                  </Button>
                </>
              )}

              {(cameraStatus === "denied" || cameraStatus === "unavailable") && (
                <div className="flex w-full flex-col gap-2">
                  <p className="text-xs text-muted">
                    {cameraStatus === "denied"
                      ? "Camera access is required to verify attendance. Enable it for this site in your browser settings, then retry."
                      : "This device's camera couldn't be reached. You can still attach a photo instead."}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" fullWidth onClick={retryCamera}>
                      <RotateCcw className="h-4 w-4" /> Try again
                    </Button>
                    <Button fullWidth onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Upload instead
                    </Button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFallbackFileChange}
              />
            </>
          )}
        </div>
      )}

      {step === "location" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          {locating && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-sm text-muted">Getting your location…</p>
            </>
          )}

          {!locating && locationError && (
            <>
              <ShieldAlert className="h-8 w-8 text-warning" />
              <p className="text-sm font-medium text-foreground">
                {locationError === "denied" ? "Location permission denied" : "Location unavailable"}
              </p>
              <p className="text-sm text-muted">
                {locationError === "denied"
                  ? "Enable location access for this site in your browser settings, or continue without it — your manager will see it as unverified."
                  : "We couldn't get a GPS reading. Move to an open area and try again, or continue without it."}
              </p>
              <div className="flex w-full gap-2">
                <Button variant="outline" fullWidth onClick={requestLocation}>
                  Try again
                </Button>
                <Button fullWidth onClick={() => setStep("confirm")}>
                  Continue anyway
                </Button>
              </div>
            </>
          )}

          {!locating && location && location.accuracy > POOR_ACCURACY_METERS && (
            <>
              <ShieldAlert className="h-8 w-8 text-warning" />
              <p className="text-sm font-medium text-foreground">Location accuracy is too low</p>
              <p className="text-sm text-muted">
                Accuracy is ±{Math.round(location.accuracy)}m. Please move to an open area and try again.
              </p>
              <div className="flex w-full gap-2">
                <Button variant="outline" fullWidth onClick={requestLocation}>
                  Retry
                </Button>
                <Button fullWidth onClick={() => setStep("confirm")}>
                  Continue anyway
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4 py-2">
          <h3 className="text-center text-base font-semibold">{copy.verifyTitle}</h3>

          {selfiePreview && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selfiePreview} alt="Selfie preview" className="h-32 w-32 rounded-[var(--radius-md)] object-cover" />
            </div>
          )}

          <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted p-4 text-sm">
            {copy.needsSelfie && (
              <Row label="Selfie" value={selfiePreview ? "Captured" : "Not captured"} ok={!!selfiePreview} />
            )}
            <Row
              label="Location"
              value={
                !location
                  ? locationError === "denied"
                    ? "Permission denied"
                    : "Unavailable"
                  : !zoneConfigured
                  ? "Zone not configured yet"
                  : withinZone
                  ? "Inside attendance zone"
                  : "Outside attendance zone"
              }
              ok={!!location && (!zoneConfigured || withinZone)}
              icon={MapPin}
            />
            {location && distancePreview !== null && <Row label="Distance" value={`${distancePreview}m`} />}
            {location && <Row label="GPS accuracy" value={`±${Math.round(location.accuracy)}m`} />}
            <Row label="Time" value={formatClockTime(new Date().toISOString())} />
          </div>

          {location && <MapPreview lat={location.lat} lng={location.lng} className="h-32 w-full" />}

          {submitError && <p className="text-sm text-danger">{submitError}</p>}

          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setStep(copy.needsSelfie ? "selfie" : "location")}
            >
              <RotateCcw className="h-4 w-4" /> Redo
            </Button>
            <Button fullWidth onClick={handleSubmit}>
              {copy.cta}
            </Button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-muted">Verifying attendance…</p>
        </div>
      )}

      {step === "success" && (
        <div className="animate-fade-in flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <h3 className="font-display text-xl font-bold">{copy.successTitle}</h3>
          <p className="text-sm text-muted">{copy.successBody}</p>
          <p className="text-2xl font-bold tabular-nums">{formatClockTime(new Date().toISOString())}</p>
          <Button fullWidth size="lg" onClick={onClose} className="mt-2">
            Done
          </Button>
        </div>
      )}
    </Overlay>
  );
}

function Row({
  label,
  value,
  ok,
  icon: Icon,
}: {
  label: string;
  value: string;
  ok?: boolean;
  icon?: typeof MapPin;
}) {
  // A checkmark/warning icon carries the status independent of color —
  // not everyone can rely on the green/amber text alone to tell the two
  // apart.
  const StatusIcon = ok === false ? AlertTriangle : ok === true ? CheckCircle2 : null;
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-muted">
        {StatusIcon ? (
          <StatusIcon className={cn("h-3.5 w-3.5", ok ? "text-success" : "text-warning")} aria-hidden />
        ) : (
          Icon && <Icon className="h-3.5 w-3.5" />
        )}
        {label}
      </span>
      <span className={ok === false ? "font-medium text-warning" : ok === true ? "font-medium text-success" : "font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}
