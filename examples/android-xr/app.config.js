module.exports = {
  expo: {
    name: "Viro Android XR Probe",
    slug: "viro-android-xr-probe",
    version: "1.0.0",
    platforms: ["android"],
    android: {
      package: "com.viro.androidxrprobe",
      // The shared bridge serves other apps that use these permissions. This
      // opaque diagnostic scene needs none of them, including at merge time.
      blockedPermissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.EYE_TRACKING_FINE",
      ],
    },
    plugins: [
      [
        "@reactvision/react-viro",
        {
          provider: "none",
          telemetry: false,
          android: { xRMode: ["ANDROID_XR"] },
        },
      ],
    ],
  },
};
