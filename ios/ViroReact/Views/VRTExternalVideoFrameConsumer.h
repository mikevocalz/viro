//
//  VRTExternalVideoFrameConsumer.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Frame contract between an Apple external-video producer and Viro.
 *
 * A producer is the Objective-C class named by the JS `sourceClass` prop. Viro calls its class
 * methods through the runtime, so it never links against WebRTC or any other producer SDK:
 *
 *   + (void)provideVideoFramesForSourceKey:(NSString *)sourceKey
 *                                 consumer:(id<VRTExternalVideoFrameConsumer>)consumer
 *                                    width:(NSInteger)width
 *                                   height:(NSInteger)height;
 *   + (void)revokeVideoFramesForSourceKey:(NSString *)sourceKey
 *                                consumer:(id<VRTExternalVideoFrameConsumer>)consumer;
 *
 * The producer then pushes frames to the consumer from any thread. The consumer retains the
 * buffer for as long as it needs it; the producer may release its own reference on return.
 */
@protocol VRTExternalVideoFrameConsumer <NSObject>

/**
 * Delivers one frame. `rotationDegrees` (0, 90, 180, 270) is the clockwise rotation that makes the
 * frame upright; `mirrored` then flips the upright frame horizontally. Any pixel format Core Image reads is
 * accepted, including NV12 and BGRA. Frames that arrive while the previous one is still being
 * uploaded are dropped.
 */
- (void)consumePixelBuffer:(CVPixelBufferRef)pixelBuffer
           rotationDegrees:(NSInteger)rotationDegrees
                  mirrored:(BOOL)mirrored;

@end

NS_ASSUME_NONNULL_END
