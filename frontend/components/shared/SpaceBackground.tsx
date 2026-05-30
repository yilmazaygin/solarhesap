"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

// Deterministic pseudo-random generator for hydration safety
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Pre-generate stars so they are exactly the same on server and client
const stars = Array.from({ length: 150 }).map((_, i) => ({
  id: i,
  x: seededRandom(i * 1.1) * 100,
  y: seededRandom(i * 2.2) * 100,
  size: seededRandom(i * 3.3) * 2 + 0.5, // 0.5px to 2.5px
  opacity: seededRandom(i * 4.4) * 0.5 + 0.1, // 0.1 to 0.6
  delay: seededRandom(i * 5.5) * 5, // 0 to 5s
  duration: 3 + seededRandom(i * 6.6) * 4, // 3s to 7s
}));

export default function SpaceBackground({ 
  isGlobal = true, 
  className = "absolute inset-0"
}: { 
  isGlobal?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Hide global background on homepage or in light mode
  if (isGlobal && pathname === "/") return null;
  if (theme === "light") return null;

  const positionClass = isGlobal ? "fixed inset-0 opacity-80" : className;

  return (
    <div className={`${positionClass} z-[-1] overflow-hidden pointer-events-none`}>
      {/* Background tint based on theme */}
      <div className="absolute inset-0 bg-transparent dark:bg-slate-950/20" />

      {/* Static & Twinkling Stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-slate-900 dark:bg-white animate-twinkle"
          style={{
            top: `${star.y}%`,
            left: `${star.x}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--tw-star-opacity': star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Shooting Stars */}
      <div className="shooting-star-container">
        <div className="shooting-star top-[10%] left-[40%]" style={{ animationDelay: '0s' }} />
        <div className="shooting-star top-[50%] left-[80%]" style={{ animationDelay: '3.5s' }} />
        <div className="shooting-star top-[30%] left-[10%]" style={{ animationDelay: '8s' }} />
        <div className="shooting-star top-[80%] left-[60%]" style={{ animationDelay: '11.5s' }} />
      </div>
    </div>
  );
}
