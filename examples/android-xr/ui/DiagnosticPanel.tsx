import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useProbeStore } from "../probeStore";

export function DiagnosticPanel({ onEnter }: { onEnter?: () => void }) {
  const lastEvent = useProbeStore((state) => state.lastEvent);
  const clicks = useProbeStore((state) => state.clicks);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Viro Android XR probe</Text>
      <Text style={styles.body}>
        {onEnter
          ? "Enter the scene, select and drag the cube, then exit and reopen it."
          : "This scene requires an Android XR device. This screen only checks the ordinary Android app shell."}
      </Text>
      <Text style={styles.body}>Selections: {clicks}</Text>
      <Text style={styles.body}>Last event: {lastEvent}</Text>
      {onEnter ? (
        <Pressable
          accessibilityRole="button"
          onPress={onEnter}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Enter immersive view</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 32, justifyContent: "center", backgroundColor: "#101827" },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "700", marginBottom: 16 },
  body: { color: "#D4DDEB", fontSize: 17, marginBottom: 12 },
  button: { backgroundColor: "#93C5FD", borderRadius: 12, padding: 16, marginTop: 12 },
  buttonText: { color: "#101827", fontSize: 17, fontWeight: "600", textAlign: "center" },
});
