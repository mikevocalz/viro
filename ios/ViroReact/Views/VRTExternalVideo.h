//
//  VRTExternalVideo.h
//  ViroReact
//
//  Cross-platform external video surface. Apple producers deliver CVPixelBuffer
//  frames; Android producers receive an android.view.Surface.
//

#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import "VRTView.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Apple producer -> Viro frame contract.
 *
 * A provider is selected by the JS `sourceClass` prop and is invoked through
 * Objective-C runtime selectors, so Viro does not link against WebRTC, Mux, or
 * any other producer SDK.
 */
@protocol VRTExternalVideoFrameConsumer <NSObject>

- (void)consumePixelBuffer:(CVPixelBufferRef)pixelBuffer
           rotationDegrees:(NSInteger)rotationDegrees
                  mirrored:(BOOL)mirrored;

@end

@interface VRTExternalVideo : VRTView <VRTExternalVideoFrameConsumer>

@property (nonatomic, copy, nullable) NSString *material;
@property (nonatomic, copy, nullable) NSString *sourceKey;
@property (nonatomic, copy, nullable) NSString *sourceClass;
@property (nonatomic, copy) NSString *resizeMode; // "cover" | "contain" | "stretch"
@property (nonatomic, assign) BOOL mirror;
@property (nonatomic, assign) BOOL flipY;
@property (nonatomic, assign) NSInteger pixelWidth;
@property (nonatomic, assign) NSInteger pixelHeight;

@property (nonatomic, copy, nullable) RCTDirectEventBlock onCameraReadyViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onErrorViro;

- (instancetype)initWithBridge:(RCTBridge *)bridge;
- (void)setPixelSizeWidth:(NSInteger)width height:(NSInteger)height;

@end

NS_ASSUME_NONNULL_END
