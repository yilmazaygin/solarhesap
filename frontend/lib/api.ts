import { API_BASE_URL } from "./constants";

/* ============================================================
   API Client — all backend endpoints
   ============================================================ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T = AnyData>(
  endpoint: string,
  data: AnyData,
  options: { timeout?: number } = {}
): Promise<T> {
  const { timeout = 120000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, body.detail || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out. The server may be processing heavy computations.");
    }
    throw new ApiError(0, `Network error: ${(err as Error).message}`);
  }
}

/* ── Solar Simulation Endpoints ──────────────────────── */

function getTimeout(data: AnyData, base: number = 120000) {
  return data.avg_year_strategies?.includes("all") ? 180000 : base;
}

export function runInstesreBird(data: AnyData) {
  return request("/solar-simulation/instesre-bird", data, { timeout: getTimeout(data) });
}

export function runIneichen(data: AnyData) {
  return request("/solar-simulation/pvlib-ineichen", data, { timeout: getTimeout(data) });
}

export function runSimplifiedSolis(data: AnyData) {
  return request("/solar-simulation/pvlib-solis", data, { timeout: getTimeout(data) });
}

export function runPvlibBird(data: AnyData) {
  return request("/solar-simulation/pvlib-bird", data, { timeout: getTimeout(data) });
}

export function runPvgisTmy(data: AnyData) {
  return request("/solar-simulation/pvgis-tmy", data, { timeout: 120000 });
}

export function runPvgisPoa(data: AnyData) {
  return request("/solar-simulation/pvgis-poa", data, { timeout: getTimeout(data, 180000) });
}

export function runDeepComparison(data: AnyData) {
  return request("/solar-simulation/deep-comparison", data, { timeout: getTimeout(data, 180000) });
}

export function runModelChain(data: AnyData) {
  return request("/solar-simulation/run-modelchain", data, { timeout: getTimeout(data, 180000) });
}

/* ── Solar Tools Endpoints ───────────────────────────── */

export function calcJulianDay(data: AnyData) {
  return request("/solar-tools/julian-day", data);
}

export function calcSolarPosition(data: AnyData) {
  return request("/solar-tools/solar-position", data);
}

export function calcSunriseSunset(data: AnyData) {
  return request("/solar-tools/sunrise-sunset", data);
}

export function calcSolarDeclination(data: AnyData) {
  return request("/solar-tools/solar-declination", data);
}

export function calcAirmass(data: AnyData) {
  return request("/solar-tools/airmass", data);
}

export function calcDewPointToPw(data: AnyData) {
  return request("/solar-tools/dew-point-to-pw", data);
}

export function calcStationPressure(data: AnyData) {
  return request("/solar-tools/station-pressure", data);
}

export function calcIsaPressure(data: AnyData) {
  return request("/solar-tools/isa-pressure", data);
}

export function calcLinkeTurbidity(data: AnyData) {
  return request("/solar-tools/linke-turbidity", data);
}

export function calcExtraterrestrial(data: AnyData) {
  return request("/solar-tools/extraterrestrial", data);
}

export function calcInstantBird(data: AnyData) {
  return request("/solar-tools/instant-bird", data);
}

export function calcErbsDecomposition(data: AnyData) {
  return request("/solar-tools/erbs-decomposition", data);
}

export function calcAngleOfIncidence(data: AnyData) {
  return request("/solar-tools/angle-of-incidence", data);
}

export function calcOptimalTilt(data: AnyData) {
  return request("/solar-tools/optimal-tilt", data);
}

export function calcPoaIrradiance(data: AnyData) {
  return request("/solar-tools/poa-irradiance", data);
}
