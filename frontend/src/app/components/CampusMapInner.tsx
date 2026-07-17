"use client";
import L from "leaflet";
import { ChevronRight, Maximize2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/authFetch";
import {
    CAMPUS_ANCHOR,
    CAMPUS_LOCATIONS,
    CampusLocation,
    OccupancyStatus,
    statusFor,
    toLatLng,
} from "../lib/campus";

export interface Forecast {
    predicted_occupancy: number;
    status: OccupancyStatus;
}

// Palette (Ronas IT shot). Sage #BFC2AD swapped for --accent.
const C = {
    ink: "#040404",
    surface: "#0d0d0c",
    line: "#5c5c56",
    cream: "#f5eee1",
    muted: "#928b85",
    green: "#6d9c7b",
    accent: "#c9a227",
    danger: "#b4553f",
};

const STATUS_COLOR: Record<OccupancyStatus, string> = {
    Underused: C.green,
    Normal: C.accent,
    Overcrowded: C.danger,
};

const PINS = CAMPUS_LOCATIONS.map((l) => ({
    ...l,
    pos: toLatLng(l.x, l.y) as [number, number],
}));

type Pin = (typeof PINS)[number];

interface Props {
    heightClass?: string;
    filter?: (b: CampusLocation) => boolean;
    onExpand?: () => void;
    onOpenLocation?: (name: string) => void;
    onData?: (f: Record<string, Forecast>) => void;
}

/** Keeps the viewport framed on whatever is currently visible. */
function FitBounds({ pins }: { pins: Pin[] }) {
    const map = useMap();
    useEffect(() => {
        if (!pins.length) return;
        const b = L.latLngBounds(pins.map((p) => p.pos));
        map.fitBounds(b, { padding: [56, 56], maxZoom: 17 });
    }, [pins, map]);
    return null;
}

export default function CampusMapInner({
    heightClass = "h-[62vh] min-h-[420px]",
    filter,
    onExpand,
    onOpenLocation,
    onData,
}: Props) {
    const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    const dataCb = useRef(onData);
    useEffect(() => {
        dataCb.current = onData;
    });

    const fetchForecasts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!localStorage.getItem("access")) throw new Error("Sign in to load occupancy");
            const t = new Date(Date.now() + 15 * 60000);
            t.setSeconds(0, 0);
            const res = await authFetch(`${API_BASE}/api/forecast-all/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ future_time: t.toISOString().replace(/\.\d{3}Z$/, "Z") }),
            });
            if (!res.ok) throw new Error(`Occupancy unavailable (${res.status})`);
            const rows: Array<{
                location_name: string;
                predicted_occupancy: number;
                status: OccupancyStatus;
            }> = await res.json();
            const next: Record<string, Forecast> = {};
            rows.forEach((r) => {
                next[r.location_name] = {
                    predicted_occupancy: r.predicted_occupancy,
                    status: r.status,
                };
            });
            setForecasts(next);
            dataCb.current?.(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load occupancy");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchForecasts();
    }, [fetchForecasts]);

    const visible = useMemo(() => (filter ? PINS.filter(filter) : PINS), [filter]);
    const active = useMemo(() => PINS.find((p) => p.name === selected) ?? null, [selected]);

    useEffect(() => {
        if (selected && !visible.some((p) => p.name === selected)) setSelected(null);
    }, [selected, visible]);

    const statusOf = (p: Pin): OccupancyStatus | null => {
        const f = forecasts[p.name];
        if (!f) return null;
        return f.status ?? statusFor(p.capacity, f.predicted_occupancy);
    };

    // Bigger sites read as bigger dots, same idea as the schematic footprints.
    const radiusOf = (cap: number) => 7 + Math.min(1, Math.sqrt(cap) / Math.sqrt(5000)) * 11;

    return (
        <div
            className="relative rounded-2xl overflow-hidden border"
            style={{ borderColor: C.line, background: C.ink }}
        >
            <div className="absolute top-3 right-3 z-[500] flex gap-2">
                <button
                    onClick={fetchForecasts}
                    disabled={loading}
                    className="h-8 w-8 grid place-items-center rounded-lg border backdrop-blur transition-colors disabled:opacity-50"
                    style={{ borderColor: C.line, background: "rgba(13,13,12,.85)", color: C.cream }}
                    aria-label="Refresh occupancy"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                {onExpand && (
                    <button
                        onClick={onExpand}
                        className="h-8 px-3 flex items-center gap-1.5 rounded-lg border backdrop-blur text-xs font-medium transition-colors"
                        style={{ borderColor: C.line, background: "rgba(13,13,12,.85)", color: C.cream }}
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expand
                    </button>
                )}
            </div>

            <div
                className="absolute bottom-3 left-3 z-[500] flex gap-3 rounded-lg border backdrop-blur px-3 py-2 text-[11px]"
                style={{ borderColor: C.line, background: "rgba(13,13,12,.85)", color: C.muted }}
            >
                {(Object.keys(STATUS_COLOR) as OccupancyStatus[]).map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: STATUS_COLOR[s] }}
                        />
                        {s}
                    </span>
                ))}
            </div>

            {error && (
                <div
                    className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] rounded-lg border px-3 py-1.5 text-xs backdrop-blur"
                    style={{ borderColor: C.danger, background: "rgba(180,85,63,.18)", color: "#e8b4a5" }}
                >
                    {error}
                </div>
            )}

            <MapContainer
                center={[CAMPUS_ANCHOR.lat, CAMPUS_ANCHOR.lng]}
                zoom={16}
                scrollWheelZoom
                zoomControl
                className={`w-full ${heightClass}`}
                style={{ background: C.ink }}
            >
                {/* CARTO Positron — light, low-chroma basemap, so the cream/graphite UI
                    frames it the way the reference shot does. */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    maxZoom={20}
                />
                <FitBounds pins={visible} />

                {visible.map((p) => {
                    const st = statusOf(p);
                    const col = st ? STATUS_COLOR[st] : C.muted;
                    const isSel = selected === p.name;
                    return (
                        <CircleMarker
                            key={p.name}
                            center={p.pos}
                            radius={radiusOf(p.capacity)}
                            pathOptions={{
                                color: isSel ? C.cream : col,
                                weight: isSel ? 3 : 2,
                                fillColor: col,
                                fillOpacity: 0.75,
                            }}
                            eventHandlers={{ click: () => setSelected(isSel ? null : p.name) }}
                        >
                            <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>
                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                            </Tooltip>
                        </CircleMarker>
                    );
                })}
            </MapContainer>

            {active && (
                <DetailSheet
                    pin={active}
                    forecast={forecasts[active.name]}
                    onClose={() => setSelected(null)}
                    onOpen={onOpenLocation ? () => onOpenLocation(active.name) : undefined}
                />
            )}
        </div>
    );
}

function DetailSheet({
    pin,
    forecast,
    onClose,
    onOpen,
}: {
    pin: Pin;
    forecast?: Forecast;
    onClose: () => void;
    onOpen?: () => void;
}) {
    const count = forecast?.predicted_occupancy ?? null;
    const st = forecast
        ? forecast.status ?? statusFor(pin.capacity, forecast.predicted_occupancy)
        : null;
    const pct =
        count !== null && pin.capacity
            ? Math.min(100, Math.round((count / pin.capacity) * 100))
            : null;
    const col = st ? STATUS_COLOR[st] : C.muted;

    return (
        <div className="absolute inset-x-0 bottom-0 z-[600] p-3 sheet">
            <div
                className="rounded-2xl border backdrop-blur-xl shadow-2xl"
                style={{ borderColor: C.line, background: "rgba(13,13,12,.96)" }}
            >
                <div className="flex items-start justify-between gap-4 px-4 pt-3.5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-base font-semibold truncate" style={{ color: C.cream }}>
                                {pin.name}
                            </h3>
                            {st && (
                                <span className="flex items-center gap-1.5 text-xs" style={{ color: col }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                                    {st}
                                </span>
                            )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                            {pin.category}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors shrink-0"
                        style={{ color: C.muted }}
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3.5">
                    <Stat label="Predicted" value={count !== null ? count.toLocaleString() : "—"} />
                    <Stat label="Capacity" value={pin.capacity.toLocaleString()} />
                    <Stat label="Utilisation" value={pct !== null ? `${pct}%` : "—"} />
                    {onOpen && (
                        <div className="col-span-2 sm:col-span-1 flex items-end">
                            <button
                                onClick={onOpen}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-opacity hover:opacity-90"
                                style={{ background: C.cream, color: C.ink }}
                            >
                                Details
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {pct !== null && (
                    <div className="px-4 pb-4">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#26261f" }}>
                            <div
                                className="h-full rounded-full transition-[width] duration-500"
                                style={{ width: `${pct}%`, background: col }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .sheet {
                    animation: sheetUp 180ms ease-out;
                }
                @keyframes sheetUp {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: "#26261f", background: "#141413" }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                {label}
            </div>
            <div
                className="text-lg font-semibold tabular-nums leading-tight mt-0.5"
                style={{ color: C.cream }}
            >
                {value}
            </div>
        </div>
    );
}
