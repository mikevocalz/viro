import { ConfigPlugin } from "@expo/config-plugins";
import type { ExpoConfig } from "@expo/config-types";
import type { ViroConfigurationOptions, XrMode } from "./withViro";
export declare function resolveViroXrModes(config: ExpoConfig, props?: ViroConfigurationOptions): XrMode[];
/**
 * Shared OpenXR activity for Quest and PICO. The component name stays
 * VRQuestScene for compatibility. Expo-PICO supplies the PICO flavor's
 * launcher contract; Quest metadata is only added when QUEST is requested.
 */
export declare const withViroOpenXRActivity: ConfigPlugin<ViroConfigurationOptions>;
export declare const withViroAndroid: ConfigPlugin<ViroConfigurationOptions>;
