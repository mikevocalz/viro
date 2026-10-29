import { create } from "zustand";

type ProbePosition = [number, number, number];

type ProbeState = {
  clicks: number;
  cubePosition: ProbePosition;
  lastEvent: string;
  report: (event: string, detail?: unknown) => void;
  select: () => void;
  drag: (position: ProbePosition) => void;
};

export const useProbeStore = create<ProbeState>((set) => ({
  clicks: 0,
  cubePosition: [0, 0, -2],
  lastEvent: "Waiting for the immersive scene",
  report: (event, detail) => {
    console.info("[ViroAndroidXR]", JSON.stringify({ event, detail }));
    set({ lastEvent: event });
  },
  select: () => set((state) => ({ clicks: state.clicks + 1 })),
  // Native Viro moves the object; retain its final authored position across
  // React updates and activity re-entry as well.
  drag: (cubePosition) => set({ cubePosition }),
}));
