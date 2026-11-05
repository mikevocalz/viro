//
//  VRTExternalVideo.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  iOS/visionOS half of ViroExternalVideo: binds frames pushed by an external producer to the
//  diffuse texture of a named material. Android producers instead draw into a Surface; see
//  VRTExternalVideo.java.
//

#import <Foundation/Foundation.h>
#import "VRTView.h"
#import "VRTExternalVideoFrameConsumer.h"

NS_ASSUME_NONNULL_BEGIN

@interface VRTExternalVideo : VRTView <VRTExternalVideoFrameConsumer>

@property (nonatomic, copy, nullable) NSString *material;
@property (nonatomic, copy, nullable) NSString *sourceKey;
@property (nonatomic, copy, nullable) NSString *sourceClass;
/** "cover" (default), "contain" or "stretch". */
@property (nonatomic, copy) NSString *resizeMode;
@property (nonatomic, assign) BOOL mirror;

@property (nonatomic, copy, nullable) RCTDirectEventBlock onCameraReadyViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onErrorViro;

- (instancetype)initWithBridge:(RCTBridge *)bridge;
- (void)setPixelSizeWidth:(NSInteger)width height:(NSInteger)height;

@end

NS_ASSUME_NONNULL_END
