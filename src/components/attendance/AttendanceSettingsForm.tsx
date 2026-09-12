"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { updateAttendanceSettings } from "@/lib/actions/attendance";
import { MapPreview } from "@/components/attendance/MapPreview";
import type { Branch } from "@/lib/types";

export function AttendanceSettingsForm({ branch }: { branch: Branch }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [lat, setLat] = useState(branch.attendance_lat?.toString() ?? "");
  const [lng, setLng] = useState(branch.attendance_lng?.toString() ?? "");
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        error("Couldn't get your location. Check permissions and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await updateAttendanceSettings(formData);
      if (result.ok) {
        success("Attendance settings saved.");
        router.refresh();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't save these settings. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Attendance zone</h2>
      <p className="mb-4 text-sm text-muted">
        The park&apos;s coordinates and how far (in meters) a clock-in can be from them and still count as verified.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label htmlFor="attendance_lat">Latitude</Label>
          <Input id="attendance_lat" name="attendance_lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="20.2961" />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="attendance_lng">Longitude</Label>
          <Input id="attendance_lng" name="attendance_lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="85.8245" />
        </FieldGroup>
      </div>

      <Button type="button" variant="outline" size="sm" loading={locating} onClick={useCurrentLocation} className="mb-4">
        <LocateFixed className="h-3.5 w-3.5" /> Use my current location
      </Button>

      {lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) && (
        <MapPreview lat={Number(lat)} lng={Number(lng)} className="mb-4 h-40 w-full" />
      )}

      <FieldGroup>
        <Label htmlFor="attendance_radius_m">Allowed radius (meters)</Label>
        <Input id="attendance_radius_m" name="attendance_radius_m" type="number" min={20} max={2000} defaultValue={branch.attendance_radius_m} />
      </FieldGroup>

      <h2 className="mb-1 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Shift policy</h2>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label htmlFor="expected_start_time">Expected start time</Label>
          <Input id="expected_start_time" name="expected_start_time" type="time" defaultValue={branch.expected_start_time} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="expected_shift_minutes">Expected shift (minutes)</Label>
          <Input id="expected_shift_minutes" name="expected_shift_minutes" type="number" min={60} max={1440} defaultValue={branch.expected_shift_minutes} />
        </FieldGroup>
      </div>
      <FieldGroup>
        <Label htmlFor="lunch_allowed_minutes">Allowed lunch (minutes)</Label>
        <Input id="lunch_allowed_minutes" name="lunch_allowed_minutes" type="number" min={0} max={240} defaultValue={branch.lunch_allowed_minutes} />
      </FieldGroup>

      {fieldError && <FieldError>{fieldError}</FieldError>}

      <Button type="submit" fullWidth loading={pending} className="mt-2">
        Save settings
      </Button>
    </form>
  );
}
