"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface MapPickerProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({
  latitude,
  longitude,
  onLocationChange,
}: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mapRef.current) return;

    // Dynamic import of leaflet
    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
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

      // Dark tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // Custom marker icon
      const solarIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #fbbf24, #d97706);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 0 12px rgba(251,191,36,0.5);
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

      // Add marker if valid coords
      if (latitude && longitude) {
        markerRef.current = L.marker([latitude, longitude], {
          icon: solarIcon,
        }).addTo(map);
      }

      // Click handler
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Math.round(lat * 10000) / 10000;
        const roundedLng = Math.round(lng * 10000) / 10000;

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          markerRef.current = L.marker([roundedLat, roundedLng], {
            icon: solarIcon,
          }).addTo(map);
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
  }, [isClient]);

  // Update marker when lat/lng changes externally
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && latitude && longitude) {
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  if (!isClient) {
    return (
      <div className="w-full h-[300px] rounded-xl bg-surface-900 border border-white/[0.06] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className="h-5 w-5" />
          <span className="text-sm">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div
        ref={mapRef}
        id="map-picker"
        className="w-full h-[300px] rounded-xl overflow-hidden border border-white/[0.06]"
        style={{ zIndex: 1 }}
      />
      <div className="absolute bottom-3 left-3 z-[2] px-3 py-1.5 rounded-lg text-xs font-medium bg-black/70 backdrop-blur-sm text-slate-300 border border-white/[0.06]">
        <MapPin className="h-3 w-3 inline mr-1 text-amber-400" />
        Click the map to select coordinates
      </div>
    </div>
  );
}
