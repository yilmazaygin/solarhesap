"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface MapPickerProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: number | string;
}

export default function MapPicker({
  latitude,
  longitude,
  onLocationChange,
  height = 300,
}: MapPickerProps) {
  const heightStyle = typeof height === "number" ? `${height}px` : height;
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!isClient || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [latitude || 39.0, longitude || 35.0],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });

      const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const accentGrad = isDark
        ? "linear-gradient(135deg, #fbbf24, #d97706)"
        : "linear-gradient(135deg, #38bdf8, #0284c7)";
      const accentGlow = isDark ? "rgba(251,191,36,0.5)" : "rgba(2,132,199,0.45)";

      const solarIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 32px; height: 32px;
          background: ${accentGrad};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 0 12px ${accentGlow};
          display: flex; align-items: center; justify-content: center;
        "><div style="
          transform: rotate(45deg);
          color: #0f172a;
          font-size: 14px;
          font-weight: bold;
        ">☀</div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      if (latitude && longitude) {
        markerRef.current = L.marker([latitude, longitude], { icon: solarIcon }).addTo(map);
      }

      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Math.round(lat * 10000) / 10000;
        const roundedLng = Math.round(lng * 10000) / 10000;

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          markerRef.current = L.marker([roundedLat, roundedLng], { icon: solarIcon }).addTo(map);
        }

        onLocationChange(roundedLat, roundedLng);
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isDark]);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && latitude && longitude) {
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  if (!isClient) {
    return (
      <div
        style={{ height: heightStyle }}
        className="w-full rounded-none bg-white/[0.04] border-y border-white/[0.06] flex items-center justify-center"
      >
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className="h-5 w-5" />
          <span className="text-sm">Harita yükleniyor…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div
        ref={mapRef}
        id="map-picker"
        style={{ height: heightStyle, zIndex: 1 }}
        className="w-full"
      />
    </>
  );
}
