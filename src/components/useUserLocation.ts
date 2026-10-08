"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserLocation } from "@/components/map/user-location-layer";

export type UserLocationStatus = "off" | "locating" | "on" | "denied" | "unavailable";

/**
 * The user's live position (phone locate control), from the browser's
 * Geolocation API — only after the user asks (the browser then asks for
 * permission), only while switched on, high accuracy. Client-side only: the
 * position is drawn on the map and is never sent to the server, stored, or
 * given to SMILEY. Stopping (or leaving the page) clears the watch.
 */
export function useUserLocation() {
  const [status, setStatus] = useState<UserLocationStatus>("off");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const watchRef = useRef<number | null>(null);

  const clear = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext) {
      setStatus("unavailable");
      return;
    }
    clear();
    setStatus("locating");
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy });
        setStatus("on");
      },
      (error) => {
        // Permission refused: stop; anything else (no fix, timeout): stop too, the user can retry.
        clear();
        setLocation(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, []);

  const stop = useCallback(() => {
    clear();
    setLocation(null);
    setStatus("off");
  }, []);

  useEffect(() => clear, []);

  return { status, location, start, stop };
}
