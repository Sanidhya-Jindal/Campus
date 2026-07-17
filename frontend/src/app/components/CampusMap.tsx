"use client";
import dynamic from "next/dynamic";
import type { CampusLocation } from "../lib/campus";

export type { Forecast } from "./CampusMapInner";

// Leaflet reads `window` at module scope, so it must never be server-rendered.
const CampusMapInner = dynamic(() => import("./CampusMapInner"), {
    ssr: false,
    loading: () => (
        <div className="rounded-2xl border border-[#5c5c56] bg-[#0d0d0c] h-[44vh] min-h-[320px] grid place-items-center">
            <div className="h-6 w-6 rounded-full border-2 border-[#5c5c56] border-t-[#f5eee1] animate-spin" />
        </div>
    ),
});

export default function CampusMap(props: {
    heightClass?: string;
    filter?: (b: CampusLocation) => boolean;
    onExpand?: () => void;
    onOpenLocation?: (name: string) => void;
    onData?: (f: Record<string, { predicted_occupancy: number; status: never }>) => void;
}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <CampusMapInner {...(props as any)} />;
}
