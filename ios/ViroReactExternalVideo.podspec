require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../package.json')))

# ViroReactExternalVideo: the iOS build of VRTExternalVideo and its manager.
#
# On iOS, ViroReact vendors the prebuilt dist/lib/libViroReact.a and compiles
# nothing itself. VRTExternalVideo is newer than that archive, so it has to be
# built from source somewhere. Building it inside ViroReact makes CocoaPods
# produce a second libViroReact.a and `pod install` fails with "conflicting
# names: libviroreact.a". This pod builds it under its own product name,
# libViroReactExternalVideo.a.
#
# When the archive is absent (an iOS build from source), ViroReact compiles
# these two files itself, so this pod compiles nothing and only forwards the
# dependency. Once a rebuilt archive carries VRTExternalVideo, delete this pod
# and its line in plugins/withViroIos.ts.
#
# visionOS does not use this pod: ViroReact compiles every source there.

Pod::Spec.new do |s|
  s.name                = 'ViroReactExternalVideo'
  s.version             = package['version']
  s.summary             = 'Source-built VRTExternalVideo for the prebuilt iOS ViroReact archive'
  s.source              = { :git => 'https://github.com/ReactVision/viro.git', :tag => "v#{s.version}" }
  s.homepage            = 'https://github.com/ReactVision/viro'
  s.license             = { :type => 'MIT', :file => '../LICENSE' }
  s.author              = 'ReactVision'
  s.requires_arc        = true
  s.platform            = :ios, '15.1'

  if File.exist?(File.join(__dir__, 'dist/lib/libViroReact.a'))
    s.source_files = [
      'ViroReact/Views/VRTExternalVideo.mm',
      'ViroReact/VRTExternalVideoManager.mm',
    ]
  else
    s.source_files = []
  end

  # VRTExternalVideo converts producer frames with Core Image and ImageIO.
  s.frameworks = ['AVFoundation', 'CoreVideo', 'CoreImage', 'ImageIO']

  s.dependency 'ViroReact'
  s.dependency 'ViroKit'
  s.dependency 'React-Core'

  # Same search paths and defines as ViroReact, so the two .mm files see the
  # headers exactly as they did when ViroReact compiled them. ViroReact's
  # public headers are flattened into Headers/Public/ViroReact.
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/ViroReact"',
      '"$(PODS_TARGET_SRCROOT)/ViroReact/Views"',
      '"$(PODS_TARGET_SRCROOT)/dist/include"',
      '"$(PODS_ROOT)/Headers/Public"',
      '"$(PODS_ROOT)/Headers/Public/ViroReact"',
      '"$(PODS_ROOT)/Headers/Public/ViroKit"',
      '"$(PODS_ROOT)/ViroKit/Headers"',
    ].join(' '),
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) RCT_NEW_ARCH_ENABLED=1',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -std=c++17'
  }
end
