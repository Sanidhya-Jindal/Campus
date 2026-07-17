"use client";
import {
    ArrowLeft,
    Building2,
    ChevronRight,
    Grid3x3,
    Map as MapIcon,
    Search,
    Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import CampusMap, { Forecast } from "../../components/CampusMap";
import ProtectedRoute from "../../components/protectedRoute";
import {
    CAMPUS_LOCATIONS,
    CATEGORIES,
    CampusLocation,
    STATUS_STYLE,
    statusFor,
} from "../../lib/campus";

function LocationPage() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("All");
    const [view, setView] = useState<"map" | "grid">("map");
    const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});

    const filter = useCallback(
        (b: CampusLocation) => {
            const q = query.trim().toLowerCase();
            return (
                (!q || b.name.toLowerCase().includes(q)) &&
                (category === "All" || b.category === category)
            );
        },
        [query, category]
    );

    const visible = useMemo(() => CAMPUS_LOCATIONS.filter(filter), [filter]);
    const open = (name: string) =>
        router.push(`/pages/indivisuallocation/${encodeURIComponent(name)}`);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-40">
                <div className="mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                                <Building2 className="w-5 h-5 text-sky-400" />
                            </div>
                            <div>
                                <h1 className="text-base font-semibold text-white leading-tight">
                                    Campus Map
                                </h1>
                                <p className="text-xs text-slate-500">
                                    {visible.length} of {CAMPUS_LOCATIONS.length} locations
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push("/pages/crowdstatus")}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                            >
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="hidden sm:inline text-slate-300">Crowd View</span>
                            </button>
                            <button
                                onClick={() => router.push("/pages/dashboard")}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 text-slate-400" />
                                <span className="hidden sm:inline text-slate-300">Dashboard</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search locations"
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600 transition-colors"
                        />
                    </div>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="px-3 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-sky-600 transition-colors"
                    >
                        <option value="All">All types</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                    <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setView("map")}
                            className={`p-1.5 rounded transition-colors ${
                                view === "map" ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-300"
                            }`}
                            aria-label="Map view"
                        >
                            <MapIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView("grid")}
                            className={`p-1.5 rounded transition-colors ${
                                view === "grid" ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-300"
                            }`}
                            aria-label="Grid view"
                        >
                            <Grid3x3 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {view === "map" ? (
                    <CampusMap
                        heightClass="h-[70vh] min-h-[460px]"
                        filter={filter}
                        onOpenLocation={open}
                        onData={setForecasts}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {visible.map((b) => {
                            const f = forecasts[b.name];
                            const st = f ? f.status ?? statusFor(b.capacity, f.predicted_occupancy) : null;
                            return (
                                <button
                                    key={b.name}
                                    onClick={() => open(b.name)}
                                    className="text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-sky-700 transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold text-white group-hover:text-sky-400 transition-colors">
                                            {b.name}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{b.category}</div>
                                    <div className="mt-3 flex items-baseline gap-1.5">
                                        <span className="text-xl font-semibold text-slate-100 tabular-nums">
                                            {f ? f.predicted_occupancy.toLocaleString() : "—"}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            / {b.capacity.toLocaleString()}
                                        </span>
                                    </div>
                                    {st && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs">
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[st].dot}`} />
                                            <span className={STATUS_STYLE[st].text}>{st}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <ProtectedRoute>
            <LocationPage />
        </ProtectedRoute>
    );
}
