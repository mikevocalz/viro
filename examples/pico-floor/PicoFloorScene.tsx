/**
 * PicoFloorScene — floor-level tracking origin demo (Workstream A)
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Exercises `trackingOrigin` on ViroXRSceneNavigator. In "floor" mode a ViroQuad
 * laid flat at y=0 should coincide with the physical floor; in "eye" mode the
 * same quad sits at head height. This is the G1 acceptance visual from
 * docs/pico/ (virocore) — flip the toggle and watch the grid drop to the floor.
 *
 * Scoped to Workstream A only. Controller meshes (B) and hand interaction (C)
 * are not represented here because their native halves are not yet implemented
 * (blocked on controller-model asset provenance and on-device profile facts);
 * a demo that drew them would be showing something that does not exist.
 *
 * Not Quest-specific: on Quest "floor" resolves through the STAGE-derived offset,
 * on PICO 4 Ultra through native LOCAL_FLOOR, and on a runtime with neither it
 * stays eye-level. The scene reads the same on all three.
 */

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ViroXRSceneNavigator,
  ViroScene,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroQuad,
  ViroBox,
  ViroText,
  ViroMaterials,
  ViroTrackingOrigin,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({
  floorGrid: {
    // Unlit, so the eye reads the plane's height, not its shading.
    lightingModel: "Constant",
    diffuseColor: "#1CF9F7",
  },
  marker: { lightingModel: "Lambert", diffuseColor: "#F2A73B" },
});

function FloorScene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#FFFFFF" intensity={250} />
      <ViroDirectionalLight color="#FFFFFF" direction={[0, -1, -0.2]} />

      {/* Laid flat (rotated onto the XZ plane) at y=0. In floor mode this is the
          physical floor; a controller resting on the floor reads grip y≈0. */}
      <ViroQuad
        rotation={[-90, 0, 0]}
        position={[0, 0, -1.5]}
        width={2.5}
        height={2.5}
        materials={["floorGrid"]}
      />

      {/* A 0.1 m cube sitting ON the quad, so a wrong origin is obvious: it
          floats at eye level in eye mode, rests on the floor in floor mode. */}
      <ViroBox
        position={[0, 0.05, -1.5]}
        scale={[0.1, 0.1, 0.1]}
        materials={["marker"]}
      />

      <ViroText
        text="y = 0"
        position={[0, 0.2, -1.5]}
        scale={[0.3, 0.3, 0.3]}
        style={styles.label}
      />
    </ViroScene>
  );
}

export default function PicoFloorDemo() {
  const [origin, setOrigin] = useState<ViroTrackingOrigin>("floor");

  return (
    <View style={styles.root}>
      <ViroXRSceneNavigator
        initialScene={{ scene: FloorScene }}
        vrInitialScene={{ scene: FloorScene }}
        trackingOrigin={origin}
        style={styles.navigator}
      />
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.pill, origin === "eye" && styles.pillActive]}
          onPress={() => setOrigin("eye")}
        >
          <Text style={styles.pillText}>Eye level</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, origin === "floor" && styles.pillActive]}
          onPress={() => setOrigin("floor")}
        >
          <Text style={styles.pillText}>Floor level</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navigator: { flex: 1 },
  label: { fontFamily: "Helvetica", fontSize: 20, color: "#FFFFFF" },
  controls: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pillActive: { backgroundColor: "#1CF9F7" },
  pillText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
