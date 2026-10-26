import { ConfigPlugin } from "@expo/config-plugins";
import { withViroAndroid } from "./withViroAndroid";
import { withViroIos } from "./withViroIos";
import type { OpenXRRenderQualityOptions } from "./util/openxrRenderQuality";

const CAMERA_USAGE = "Allow $(PRODUCT_NAME) to use your camera";
const MICROPHONE_USAGE = "Allow $(PRODUCT_NAME) to use your microphone";
const READ_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to access your photos";
const WRITE_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to save photos";
const LOCATION_USAGE = "Allow $(PRODUCT_NAME) to use your location for AR experiences";

export type XrMode = "GVR" | "AR" | "OVR_MOBILE" | "QUEST" | "PICO";

/**
 * Anchor provider type.
 * - "none": Disabled
 * - "arcore": Use ARCore Cloud Anchors / Geospatial API
 * - "reactvision": Use ReactVision backend (requires libreactvisioncca)
 */
export type Provider = "none" | "arcore" | "reactvision";

/** @deprecated Use Provider */
export type CloudAnchorProvider = Provider;
/** @deprecated Use Provider */
export type GeospatialAnchorProvider = Provider;

/**
 * iOS framework linkage type.
 * - "dynamic": Use dynamic frameworks (required for ARCore SDK)
 * - "static": Use static frameworks (smaller binary size, faster launch)
 */
export type IosLinkage = "dynamic" | "static";

/**
 * Options interface for configuring expo plugin
 */
export interface ViroConfigurationOptions {
  /**
   * iOS framework linkage type.
   * When set to "dynamic", uses dynamic frameworks which is required for ARCore SDK.
   * When set to "static", uses static frameworks for smaller binary size.
   *
   * Note: If using provider: "arcore", this will be automatically set to "dynamic".
   *
   * DEFAULTS TO: undefined (uses project default, typically static)
   */
  iosLinkage?: IosLinkage;

  /**
   * Google Cloud API key for ARCore Cloud Anchors and Geospatial API.
   * Required if using provider: "arcore".
   *
   * Get your API key from Google Cloud Console:
   * https://console.cloud.google.com/apis/credentials
   *
   * Make sure to enable the ARCore API for your project.
   */
  googleCloudApiKey?: string;

  /**
   * ReactVision API key for ReactVision Cloud Anchors and Geospatial API.
   * Required if using provider: "reactvision" (the default).
   *
   * Written to AndroidManifest as com.reactvision.RVApiKey and to Info.plist as RVApiKey.
   */
  rvApiKey?: string;

  /**
   * ReactVision Project ID for ReactVision Cloud Anchors and Geospatial API.
   * Required if using provider: "reactvision" (the default).
   *
   * Written to AndroidManifest as com.reactvision.RVProjectId and to Info.plist as RVProjectId.
   */
  rvProjectId?: string;

  /**
   * Override the ReactVision platform base URL.
   * Omit for production. Set to a staging URL for testing.
   *
   * Written to AndroidManifest as com.reactvision.RVEndpoint and to Info.plist as RVEndpoint.
   */
  rvEndpoint?: string;

  /**
   * Anchor provider for both cloud anchors and geospatial anchors.
   * Replaces the deprecated cloudAnchorProvider + geospatialAnchorProvider props.
   *
   * - "reactvision": Use ReactVision backend (requires rvApiKey + rvProjectId)
   * - "arcore": Use ARCore Cloud Anchors / Geospatial API (requires googleCloudApiKey)
   * - "none": Disable both
   *
   * DEFAULTS TO: "reactvision"
   */
  provider?: Provider;

  /**
   * @deprecated Use provider instead.
   * Cloud Anchors provider. Overrides provider for cloud anchors only if set.
   */
  cloudAnchorProvider?: CloudAnchorProvider;

  /**
   * @deprecated Use provider instead.
   * Geospatial Anchor provider. Overrides provider for geospatial only if set.
   */
  geospatialAnchorProvider?: GeospatialAnchorProvider;

  ios?: {
    /**
     * String for app to use for camera usage.
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to use your camera'
     */
    cameraUsagePermission?: string;
    /**
     * String for app to use for microphone usage.
     *
     * DEFAULTS TO: "Allow $(PRODUCT_NAME) to use your microphone"
     */
    microphoneUsagePermission?: string;
    /**
     * String for app to read photos.
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to access your photos'
     */
    photosPermission?: string;
    /**
     * String for app to save photos
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to save photos'
     */
    savePhotosPermission?: string;
    /**
     * String for app to use location (required for Geospatial API)
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to use your location for AR experiences'
     */
    locationUsagePermission?: string;
    /**
     * Whether to include ARCore SDK pods.
     * When true, adds ARCore/CloudAnchors, ARCore/Geospatial, and ARCore/Semantics pods.
     * This is automatically set to true when using provider: "arcore".
     *
     * ViroKit is built with weak linking, so ARCore pods are optional.
     * Without ARCore pods, cloud anchors, geospatial, and semantics features will be disabled at runtime.
     *
     * DEFAULTS TO: false (unless provider is "arcore")
     */
    includeARCore?: boolean;
    /**
     * Whether to include the ARCore/Semantics pod for scene semantic segmentation.
     * When true, adds the ARCore/Semantics pod (and ARCore/CloudAnchors as a base dependency)
     * without enabling cloud anchors or geospatial features.
     *
     * Use this when you want semantic masking (ViroMaterial.semanticMask) but do NOT need
     * cloud anchors or geospatial anchors. If includeARCore is already true, this has no effect.
     *
     * DEFAULTS TO: false
     */
    includeSemantics?: boolean;
  };
  android?: {
    xRMode?: XrMode[];
    /**
     * Meta Developer Portal App ID (numeric string).
     * Written to AndroidManifest as com.oculus.app_id meta-data.
     * Eliminates the "App Name Unavailable" popup on Meta Quest.
     *
     * Get your App ID from the Meta Developer Portal:
     * https://developer.oculus.com/manage
     */
    questAppId?: string;
    /**
     * Meta Quest device targeting, written to AndroidManifest as
     * com.oculus.supportedDevices when xRMode includes "QUEST".
     *
     * DEFAULTS TO: "quest2|questpro|quest3|quest3s"
     */
    questSupportedDevices?: string;
    /**
     * targetSdkVersion ceiling applied when xRMode includes "QUEST". The Meta
     * Quest Store rejects immersive apps above 34. Only ever lowers the value.
     *
     * DEFAULTS TO: 34
     */
    questTargetSdkVersion?: number;
    /**
     * Build arm64-v8a only when xRMode includes "QUEST". Quest hardware is
     * 64-bit and the store warns on 32-bit libraries.
     *
     * DEFAULTS TO: true
     */
    questArm64Only?: boolean;
    /**
    /**
     * Mark the QUEST/OpenXR build as ready for Meta VR Glasses delivery.
     *
     * When true, Viro defaults com.meta.store.defaultDeviceTargets to
     * "quest3+" unless metaDefaultDeviceTargets is supplied explicitly.
     * Meta documents quest3+ as covering the Quest 3 family, Meta VR Glasses,
     * and future Meta VR devices.
     *
     * This does not make controller-only interactions compatible. The app must
     * implement and test eye/hand input separately.
     *
     * DEFAULTS TO: false
     */
    metaVrGlassesCompatible?: boolean;
    /**
     * Optional Meta Horizon Store default-device-target expression written to
     * com.meta.store.defaultDeviceTargets. Examples from Meta include
     * "quest3+", "quest3only", or combined expressions using "|".
     *
     * When omitted and metaVrGlassesCompatible is true, defaults to "quest3+".
     * When both are omitted, Viro leaves Store delivery targeting unchanged.
     */
    metaDefaultDeviceTargets?: string;
    /**
     * Enable Meta VR Layout SDK native dependencies for React Native spatial
     * windows. The app must install both @metavr/layout-compat and
     * @metavr/layout-window-compat as direct dependencies.
     *
     * This is intended for builds whose xRMode includes "QUEST". The Layout
     * SDK is a Standard Android panel/window feature; Viro's immersive OpenXR
     * scene path remains separate.
     *
     * The dependencies are plain `implementation`, for single-variant apps.
     * An app with a `quest` product flavor (expo-horizon-core) should leave
     * this off and enable `metaLayoutSdk` in @expo-pico/core, which links the
     * SDK into the quest flavor only. When this is on and a quest flavor
     * exists, prebuild drops Viro's lines from app/build.gradle and warns.
     *
     * DEFAULTS TO: false
     */
    metaSpatialLayout?: boolean;
    /**
     * MetaVRX BOM version used when metaSpatialLayout is enabled.
     *
     * DEFAULTS TO: "1.2026.0.0"
     */
    metaSpatialLayoutBomVersion?: string;
    /**
     * Optional Meta Quest capabilities, declared when xRMode includes "QUEST".
     * Store review checks every declared permission against what the app does
     * with it, so turn off the ones the app does not use.
     */
    questFeatures?: {
      /**
       * Shared spatial anchors for co-location:
       * horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA.
       *
       * DEFAULTS TO: true
       */
      colocation?: boolean;
      /**
       * Quest Pro eye gaze as a hover source: com.oculus.permission.EYE_TRACKING
       * and the oculus.software.eye_tracking feature.
       *
       * DEFAULTS TO: true
       */
      eyeTracking?: boolean;
      /**
       * The headset cameras through Camera2, which ViroObjectDetector reads:
       * android.permission.CAMERA and horizonos.permission.HEADSET_CAMERA.
       *
       * DEFAULTS TO: true
       */
      passthroughCamera?: boolean;
      /**
       * The runtime's own controller models (XR_FB_render_model):
       * com.oculus.permission.RENDER_MODEL and the com.oculus.feature.RENDER_MODEL
       * feature. Off, the renderer draws its bundled fallback controller mesh.
       *
       * DEFAULTS TO: true
       */
      renderModel?: boolean;
    };
    /**
     * The Horizon OS SDK versions written to the manifest as
     * <horizonos:uses-horizonos-sdk> when xRMode includes "QUEST". Horizon OS
     * warns that an app without it will lose access to its SDK managers.
     *
     * DEFAULTS TO: minSdkVersion 69, and targetSdkVersion equal to minSdkVersion
     */
    questHorizonOsSdk?: {
      minSdkVersion?: number;
      targetSdkVersion?: number;
    };
    /**
     * Startup render quality for the OpenXR renderer: the eye-buffer scale,
     * the foveation the session starts with, and an optional display refresh
     * rate request. Requires xRMode to include
     * "QUEST" or "PICO". Written to AndroidManifest as com.viro.openxr.*
     * meta-data and validated at prebuild.
     *
     * DEFAULTS TO: eyeBufferScale 1.3, foveation { level: "low", dynamic: true },
     * no displayRefreshRate request
     */
    openxr?: OpenXRRenderQualityOptions;
  };
}

/**
 * Default options
 */
export const DEFAULTS = {
  ios: {
    cameraUsagePermission: CAMERA_USAGE,
    microphoneUsagePermission: MICROPHONE_USAGE,
    photosPermission: READ_PHOTOS_USAGE,
    savePhotosPermission: WRITE_PHOTOS_USAGE,
    locationUsagePermission: LOCATION_USAGE,
  },
  android: {
    xRMode: ["GVR", "AR"],
  },
};

/**
 * Configures Viro to work with Expo projects.
 *
 * IMPORTANT: This plugin requires React Native New Architecture (Fabric) to be enabled.
 * ViroReact 2.43.1+ only supports New Architecture.
 *
 * @param config Expo ConfigPlugin
 * @returns expo configuration
 */
const withViro: ConfigPlugin<ViroConfigurationOptions> = (config, props) => {
  // New Architecture is the only architecture in Expo SDK 53+ (and the React
  // Native versions ViroReact supports), so there is nothing to validate here.

  // Apply platform-specific configurations
  config = withViroIos(config, props);
  config = withViroAndroid(config, props);

  return config;
};

export default withViro;
