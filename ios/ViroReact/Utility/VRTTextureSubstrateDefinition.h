//
//  VRTTextureSubstrateDefinition.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Makes VROTextureSubstrate a complete type for code that holds the
//  std::unique_ptr<VROTextureSubstrate> returned by VROVideoTextureCache.
//
//  The iOS ViroKit.framework publishes VROTexture.h and VROVideoTextureCache.h, both of which pass
//  substrates by unique_ptr, but its ViroRenderer.xcodeproj target does not mark
//  VROTextureSubstrate.h Public, so the header is missing from the shipped framework. visionOS
//  stages every ViroRenderer header and is unaffected. Once the iOS target publishes the header,
//  the first branch below is taken and the fallback is dead code that can be deleted.
//
//  The fallback is the definition from virocore 6541ac3c, the source of the shipped iOS ViroKit,
//  token for token and under the same include guard. The bridge only destroys substrates, which
//  dispatches through the virtual destructor in the object's own vtable inside ViroKit.
//

#ifndef VRTTextureSubstrateDefinition_h
#define VRTTextureSubstrateDefinition_h

#if __has_include(<ViroKit/VROTextureSubstrate.h>)
#import <ViroKit/VROTextureSubstrate.h>
#else

#ifndef VROTextureSubstrate_h
#define VROTextureSubstrate_h

#include <stdio.h>

enum class VROWrapMode;

class VROTextureSubstrate {
public:
    virtual ~VROTextureSubstrate() {}
    virtual void updateWrapMode(VROWrapMode wrapModeS, VROWrapMode wrapModeT) = 0;

    // In-place update for R32F textures (same width/height). Must be called on GL thread.
    virtual void updateR32FData(const float *data, int width, int height) {}
};

#endif /* VROTextureSubstrate_h */

#endif /* __has_include(<ViroKit/VROTextureSubstrate.h>) */

#endif /* VRTTextureSubstrateDefinition_h */
