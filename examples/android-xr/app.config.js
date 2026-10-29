module.exports = {
  expo: {
    name: "Viro Android XR Probe",
    slug: "viro-android-xr-probe",
    version: "1.0.0",
    platforms: ["android"],
    android: {
      package: "com.viro.androidxrprobe",
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
