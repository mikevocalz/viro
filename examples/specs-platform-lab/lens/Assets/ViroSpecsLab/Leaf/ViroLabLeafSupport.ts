import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsInteractionHost } from "../../ViroSpecs/lens/ViroSpecsInteractionHost";
import type { ViroSpecsPortableInteraction } from "../../ViroSpecs/lens/ViroSpecsProtocol";

/**
 * Shared lookups for the generated Platform Lab scenarios.
 *
 * Every name here comes from ViroGeneratedSceneHost.ts (compiled from
 * examples/specs-platform-lab/SpecsPlatformLab.tsx) and the runtime naming in
 * ViroSpecsSceneRuntime ("viro:<id>"), ViroSpecsInteractionRuntime
 * ("viro-interactable:<id>") and ViroSpecsNavigationRuntime
 * ("viro:volumetric-line", "viro:line-point:<n>"). The host objects are the ones
 * scripts/specs-lens-setup.mjs creates.
 */
export const LAB = {
  root: "viro:platform-lab-root",
  title: "viro:platform-lab-title",
  model: "viro:platform-lab-model",
  modelInteractable: "viro-interactable:platform-lab-model",
  modelId: "platform-lab-model",
  line: "viro:volumetric-line",
  linePoint: (index: number) => "viro:line-point:" + index,
  interactionHost: "InteractionHost",
  titleText: "Viro Cross-Platform Lab",
  // SpecsPlatformLab.tsx: root at [0, 0, -1.5] m, polyline points relative to
  // the root, all converted to Lens centimeters.
  rootWorldCm: [0, 0, -150] as const,
  linePointsWorldCm: [
    [-30, -20, -138],
    [0, 2, -138],
    [30, -8, -138],
  ] as const,
};

/** The generated host applies the scene on OnStartEvent; give it a beat. */
export async function waitForGeneratedScene(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (findSceneObjectByName(LAB.root)) return;
    await sleep(100);
  }
  expect(findSceneObjectByName(LAB.root)).toBeTruthy();
}

export function textOf(name: string): string | undefined {
  const object = findSceneObjectByName(name);
  const text = object?.getComponent("Component.Text") as Text | null;
  return text?.text;
}

export function expectNear(actual: vec3, expected: readonly number[], toleranceCm: number): void {
  expect(Math.abs(actual.x - expected[0])).toBeLessThan(toleranceCm);
  expect(Math.abs(actual.y - expected[1])).toBeLessThan(toleranceCm);
  expect(Math.abs(actual.z - expected[2])).toBeLessThan(toleranceCm);
}

/** Records portable interaction events for one target while `body` runs. */
export async function recordInteractions(
  targetId: string,
  body: () => Promise<void>
): Promise<ViroSpecsPortableInteraction[]> {
  const hostObject = findSceneObjectByName(LAB.interactionHost);
  expect(hostObject).toBeTruthy();
  const host = hostObject.getComponent(
    ViroSpecsInteractionHost.getTypeName()
  ) as ViroSpecsInteractionHost;
  expect(host).toBeTruthy();
  const events: ViroSpecsPortableInteraction[] = [];
  const unsubscribe = host.subscribe((event) => {
    if (event.targetId === targetId) events.push(event);
  });
  try {
    await body();
    await sleep(100);
  } finally {
    unsubscribe();
  }
  return events;
}

export function phases(events: readonly ViroSpecsPortableInteraction[]): string {
  return events.map((event) => event.phase).join(",");
}
