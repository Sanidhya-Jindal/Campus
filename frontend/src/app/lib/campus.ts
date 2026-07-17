// Single source of truth for the campus map.
//
// Capacities mirror LOCATION_MAX_CAPACITY in Backend/api/views.py — the same
// numbers the /api/forecast-all/ endpoint uses to derive Overcrowded /
// Normal / Underused, so the map's bars agree with the API's own verdict.
//
// The dataset has no coordinates, so `x`/`y` are a hand-placed schematic
// layout (percentages of the canvas), carried over from the crowdstatus view
// so both pages show the same campus.

export type Category =
    | "Residential"
    | "Dining"
    | "Academic"
    | "Laboratory"
    | "Recreation"
    | "Event Space"
    | "Administrative";

export type OccupancyStatus = "Overcrowded" | "Normal" | "Underused";

export interface CampusLocation {
    name: string;
    category: Category;
    capacity: number;
    x: number;        // 0-100, percentage across the map
    y: number;        // 0-100, percentage down the map
    rotation: number; // slight rotation keeps the block grid from feeling CAD-like
    aspect: number;   // width / height of the footprint
}

export const CAMPUS_LOCATIONS: CampusLocation[] = [
    { name: "Gym",            category: "Recreation",     capacity: 1012, x: 10, y: 15, rotation: 0,  aspect: 1.0 },
    { name: "Admin Lobby",    category: "Administrative", capacity: 710,  x: 30, y: 18, rotation: -1, aspect: 0.75 },
    { name: "Seminar Room",   category: "Academic",       capacity: 1800, x: 55, y: 15, rotation: 1,  aspect: 1.05 },
    { name: "WORKSHOP",       category: "Laboratory",     capacity: 20,   x: 75, y: 18, rotation: 1,  aspect: 0.8 },
    { name: "LAB",            category: "Laboratory",     capacity: 30,   x: 90, y: 22, rotation: -2, aspect: 0.72 },
    { name: "Faculty Office", category: "Administrative", capacity: 650,  x: 40, y: 26, rotation: 1,  aspect: 0.85 },
    { name: "LAB_101",        category: "Laboratory",     capacity: 40,   x: 65, y: 40, rotation: -2, aspect: 0.86 },
    { name: "LAB_305",        category: "Laboratory",     capacity: 30,   x: 85, y: 45, rotation: 3,  aspect: 0.97 },
    { name: "Hostel",         category: "Residential",    capacity: 5000, x: 17, y: 45, rotation: -2, aspect: 1.38 },
    { name: "Main Building",  category: "Administrative", capacity: 30,   x: 50, y: 50, rotation: 0,  aspect: 1.19 },
    { name: "Library",        category: "Academic",       capacity: 2150, x: 33, y: 60, rotation: -1, aspect: 1.08 },
    { name: "LAB_102",        category: "Laboratory",     capacity: 15,   x: 70, y: 64, rotation: 1,  aspect: 0.72 },
    { name: "LAB_A2",         category: "Laboratory",     capacity: 12,   x: 90, y: 66, rotation: -1, aspect: 0.69 },
    { name: "Auditorium",     category: "Event Space",    capacity: 1360, x: 55, y: 74, rotation: -1, aspect: 1.11 },
    { name: "Cafeteria",      category: "Dining",         capacity: 1360, x: 15, y: 75, rotation: -2, aspect: 0.84 },
    { name: "LAB_A1",         category: "Laboratory",     capacity: 20,   x: 80, y: 80, rotation: 1,  aspect: 0.76 },
];

/**
 * The dataset has no coordinates. To render on a real basemap we anchor the
 * schematic layout over a campus-sized box and project each location's x/y
 * into it, so relative positions are preserved. The anchor is a placeholder —
 * override with NEXT_PUBLIC_CAMPUS_LAT / _LNG to sit over a real campus.
 */
export const CAMPUS_ANCHOR = {
    lat: Number(process.env.NEXT_PUBLIC_CAMPUS_LAT ?? 28.5449),
    lng: Number(process.env.NEXT_PUBLIC_CAMPUS_LNG ?? 77.1926),
};

// ~700m wide x ~550m tall — a believable campus footprint.
const SPAN_LNG = 0.0072;
const SPAN_LAT = 0.005;

/** Projects schematic x/y (0-100) onto lat/lng around the anchor. */
export function toLatLng(x: number, y: number): [number, number] {
    const lng = CAMPUS_ANCHOR.lng - SPAN_LNG / 2 + (x / 100) * SPAN_LNG;
    // y grows downward on the schematic; latitude grows upward.
    const lat = CAMPUS_ANCHOR.lat + SPAN_LAT / 2 - (y / 100) * SPAN_LAT;
    return [lat, lng];
}

export const CATEGORIES: Category[] = [
    "Residential",
    "Dining",
    "Academic",
    "Laboratory",
    "Recreation",
    "Event Space",
    "Administrative",
];

/** Matches get_occupancy_status() in Backend/api/views.py. */
export function statusFor(capacity: number, count: number): OccupancyStatus {
    if (!capacity) return "Normal";
    const ratio = count / capacity;
    if (ratio > 0.9) return "Overcrowded";
    if (ratio < 0.3) return "Underused";
    return "Normal";
}

export const STATUS_STYLE: Record<
    OccupancyStatus,
    { fill: string; stroke: string; text: string; dot: string; label: string }
> = {
    Overcrowded: {
        fill: "rgba(244,63,94,0.22)",
        stroke: "#fb7185",
        text: "text-rose-300",
        dot: "bg-rose-400",
        label: "Overcrowded",
    },
    Normal: {
        fill: "rgba(56,189,248,0.16)",
        stroke: "#38bdf8",
        text: "text-sky-300",
        dot: "bg-sky-400",
        label: "Normal",
    },
    Underused: {
        fill: "rgba(52,211,153,0.14)",
        stroke: "#34d399",
        text: "text-emerald-300",
        dot: "bg-emerald-400",
        label: "Underused",
    },
};

/**
 * Footprint size in map units. Capacity spans 12 -> 5000, so a linear scale
 * would make the labs invisible next to the hostel; sqrt compresses that into
 * a readable range while keeping the ordering true.
 */
export function footprintSize(capacity: number): { w: number; h: number } {
    const MIN_CAP = 12;
    const MAX_CAP = 5000;
    const MIN_PX = 42;
    const MAX_PX = 104;
    const t =
        (Math.sqrt(capacity) - Math.sqrt(MIN_CAP)) /
        (Math.sqrt(MAX_CAP) - Math.sqrt(MIN_CAP));
    const base = MIN_PX + Math.max(0, Math.min(1, t)) * (MAX_PX - MIN_PX);
    return { w: base, h: base };
}
