"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "ready" | "denied" | "unavailable";

/**
 * Live front-camera capture via getUserMedia — a real in-page viewfinder,
 * not a hand-off to the OS camera app. Falls back cleanly: `status`
 * becomes "denied" or "unavailable" rather than throwing, so the caller
 * can offer a file-picker fallback for browsers/contexts where the camera
 * API isn't available (older browsers, non-secure origins, no camera).
 */
export function useLiveCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    // Nothing to start while inactive — resetting to "idle" happens in this
    // same effect's cleanup below (fired when `active` flips back to
    // false), not here, so there's no setState left in the effect body's
    // early-return path.
    if (!active) return;

    let cancelled = false;

    async function start() {
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    // Deferred a tick, same reasoning as the geolocation effect in
    // ClockActionFlow: this kicks off a request to an external system
    // (the camera), so an effect is the right place for it, but the
    // `setStatus("starting")` at the top of `start()` still counts as
    // "setState synchronously in the effect body" unless it's pushed
    // outside this tick.
    const timer = setTimeout(start, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const capture = useCallback((): File | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const bytes = atob(dataUrl.split(",")[1]);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new File([array], "selfie.jpg", { type: "image/jpeg" });
  }, []);

  return { videoRef, status, capture, retry, stop };
}
