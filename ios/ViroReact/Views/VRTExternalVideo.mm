//
//  VRTExternalVideo.mm
//  ViroReact
//
//  Apple/visionOS external-video backend.
//
//  Frames arrive as CVPixelBuffer objects from a producer selected by
//  sourceClass. Core Image performs color conversion, crop/rotation/mirroring,
//  and scaling entirely on Metal. The finished MTLTexture is then wrapped by
//  VROTextureSubstrateMetal and swapped onto the named Viro material.
//

#import "VRTExternalVideo.h"
#import "VRTMaterialManager.h"

#import <CoreImage/CoreImage.h>
#import <ImageIO/CGImageProperties.h>
#import <Metal/Metal.h>
#import <objc/message.h>

#include "VRODriverMetal.h"
#include "VROTexture.h"
#include "VROTextureSubstrateMetal.h"

#include <atomic>

namespace {

static CGImagePropertyOrientation OrientationForFrame(NSInteger degrees, BOOL mirrored) {
    NSInteger normalized = ((degrees % 360) + 360) % 360;
    if (mirrored) {
        switch (normalized) {
            case 90:  return kCGImagePropertyOrientationRightMirrored;
            case 180: return kCGImagePropertyOrientationDownMirrored;
            case 270: return kCGImagePropertyOrientationLeftMirrored;
            default:  return kCGImagePropertyOrientationUpMirrored;
        }
    }

    switch (normalized) {
        case 90:  return kCGImagePropertyOrientationRight;
        case 180: return kCGImagePropertyOrientationDown;
        case 270: return kCGImagePropertyOrientationLeft;
        default:  return kCGImagePropertyOrientationUp;
    }
}

static CIImage *FitImage(CIImage *image,
                         CGFloat width,
                         CGFloat height,
                         NSString *mode,
                         BOOL flipY) {
    CGRect extent = image.extent;
    if (CGRectIsEmpty(extent) || width <= 0 || height <= 0) {
        return image;
    }

    CGFloat sx = width / CGRectGetWidth(extent);
    CGFloat sy = height / CGRectGetHeight(extent);
    if ([mode isEqualToString:@"stretch"]) {
        CGAffineTransform transform = CGAffineTransformMakeTranslation(-CGRectGetMinX(extent),
                                                                       -CGRectGetMinY(extent));
        transform = CGAffineTransformScale(transform, sx, sy);
        image = [image imageByApplyingTransform:transform];
    } else {
        CGFloat scale = [mode isEqualToString:@"contain"] ? MIN(sx, sy) : MAX(sx, sy);
        CGAffineTransform transform = CGAffineTransformMakeTranslation(-CGRectGetMinX(extent),
                                                                       -CGRectGetMinY(extent));
        transform = CGAffineTransformScale(transform, scale, scale);
        image = [image imageByApplyingTransform:transform];

        CGRect scaled = image.extent;
        CGFloat dx = (width - CGRectGetWidth(scaled)) * 0.5 - CGRectGetMinX(scaled);
        CGFloat dy = (height - CGRectGetHeight(scaled)) * 0.5 - CGRectGetMinY(scaled);
        image = [image imageByApplyingTransform:CGAffineTransformMakeTranslation(dx, dy)];
    }

    if (flipY) {
        CGAffineTransform flip = CGAffineTransformIdentity;
        flip = CGAffineTransformTranslate(flip, 0, height);
        flip = CGAffineTransformScale(flip, 1, -1);
        image = [image imageByApplyingTransform:flip];
    }
    return image;
}

} // namespace

@implementation VRTExternalVideo {
    std::shared_ptr<VROMaterial> _boundMaterial;
    std::shared_ptr<VROTexture> _boundTexture;

    id<MTLDevice> _device;
    id<MTLCommandQueue> _commandQueue;
    CIContext *_ciContext;
    CGColorSpaceRef _colorSpace;

    dispatch_queue_t _frameQueue;
    std::atomic<uint64_t> _generation;
    BOOL _providerAttached;
    BOOL _readyFired;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        _resizeMode = @"cover";
        _mirror = NO;
        _flipY = NO;
        _pixelWidth = 1280;
        _pixelHeight = 720;
        _frameQueue = dispatch_queue_create("com.reactvision.external-video.apple",
                                             DISPATCH_QUEUE_SERIAL);
        _generation.store(1);
        _providerAttached = NO;
        _readyFired = NO;
        _colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    }
    return self;
}

- (void)setPixelSizeWidth:(NSInteger)width height:(NSInteger)height {
    if (width <= 0 || height <= 0) {
        return;
    }
    if (_pixelWidth == width && _pixelHeight == height) {
        return;
    }
    _pixelWidth = width;
    _pixelHeight = height;
    [self _restartProvider];
}

- (void)setMaterial:(NSString *)material {
    if ((_material == material) || [_material isEqualToString:material]) {
        return;
    }
    _material = [material copy];
    [self _tryPrepare];
}

- (void)setSourceKey:(NSString *)sourceKey {
    if ((_sourceKey == sourceKey) || [_sourceKey isEqualToString:sourceKey]) {
        return;
    }
    [self _detachProvider];
    _sourceKey = [sourceKey copy];
    [self _tryPrepare];
}

- (void)setSourceClass:(NSString *)sourceClass {
    if ((_sourceClass == sourceClass) || [_sourceClass isEqualToString:sourceClass]) {
        return;
    }

    // Revoke with the OLD provider before changing the class. The Android
    // implementation used to miss this, which leaked the old sink after a
    // provider swap.
    [self _detachProvider];
    _sourceClass = [sourceClass copy];
    [self _tryPrepare];
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
    [super didSetProps:changedProps];
    [self _tryPrepare];
}

- (void)sceneWillAppear {
    [super sceneWillAppear];
    [self _tryPrepare];
}

- (void)sceneWillDisappear {
    [self _detachProvider];
    [super sceneWillDisappear];
}

- (void)_tryPrepare {
    if (!self.driver || !_material || !_sourceKey || !_sourceClass) {
        return;
    }

    VRODriverMetal *metalDriver = dynamic_cast<VRODriverMetal *>(self.driver.get());
    if (!metalDriver) {
        [self _emitError:@"ViroExternalVideo requires the Metal renderer on Apple platforms"];
        return;
    }

    id<MTLDevice> nextDevice = metalDriver->getDevice();
    if (_device != nextDevice || !_ciContext) {
        _device = nextDevice;
        _commandQueue = [_device newCommandQueue];
        _ciContext = [CIContext contextWithMTLDevice:_device
                                             options:@{
            kCIContextWorkingColorSpace : (__bridge id)_colorSpace,
            kCIContextOutputColorSpace : (__bridge id)_colorSpace,
            kCIContextUseSoftwareRenderer : @NO,
        }];
    }

    VRTMaterialManager *manager = [self.bridge moduleForClass:[VRTMaterialManager class]];
    _boundMaterial = [manager getMaterialByName:_material];
    if (!_boundMaterial) {
        [self _emitError:[NSString stringWithFormat:@"Material '%@' not found", _material]];
        return;
    }

    [self _attachProviderIfNeeded];
}

- (void)_attachProviderIfNeeded {
    if (_providerAttached || !_sourceClass || !_sourceKey) {
        return;
    }

    Class provider = NSClassFromString(_sourceClass);
    if (!provider) {
        [self _emitError:[NSString stringWithFormat:
            @"External video provider '%@' not found. Install/register the producer adapter.",
            _sourceClass]];
        return;
    }

    SEL selector = NSSelectorFromString(
        @"provideVideoFramesForSourceKey:consumer:width:height:");
    if (![provider respondsToSelector:selector]) {
        [self _emitError:[NSString stringWithFormat:
            @"External video provider '%@' does not implement provideVideoFramesForSourceKey:consumer:width:height:",
            _sourceClass]];
        return;
    }

    using ProvideFn = void (*)(id, SEL, NSString *, id, NSInteger, NSInteger);
    ((ProvideFn)objc_msgSend)(provider,
                             selector,
                             _sourceKey,
                             self,
                             _pixelWidth,
                             _pixelHeight);
    _providerAttached = YES;
}

- (void)_detachProvider {
    _generation.fetch_add(1);
    _readyFired = NO;

    if (!_providerAttached || !_sourceClass || !_sourceKey) {
        _providerAttached = NO;
        return;
    }

    Class provider = NSClassFromString(_sourceClass);
    SEL selector = NSSelectorFromString(
        @"revokeVideoFramesForSourceKey:consumer:");
    if (provider && [provider respondsToSelector:selector]) {
        using RevokeFn = void (*)(id, SEL, NSString *, id);
        ((RevokeFn)objc_msgSend)(provider, selector, _sourceKey, self);
    }

    _providerAttached = NO;
}

- (void)_restartProvider {
    [self _detachProvider];
    [self _tryPrepare];
}

- (void)consumePixelBuffer:(CVPixelBufferRef)pixelBuffer
           rotationDegrees:(NSInteger)rotationDegrees
                  mirrored:(BOOL)mirrored {
    if (!pixelBuffer || !_device || !_ciContext || !_commandQueue) {
        return;
    }

    CVPixelBufferRetain(pixelBuffer);
    uint64_t generation = _generation.load();
    const NSInteger targetWidth = _pixelWidth;
    const NSInteger targetHeight = _pixelHeight;
    const BOOL effectiveMirror = mirrored ^ _mirror;
    const BOOL flipY = _flipY;
    NSString *resizeMode = [_resizeMode copy];

    dispatch_async(_frameQueue, ^{
        if (generation != self->_generation.load()) {
            CVPixelBufferRelease(pixelBuffer);
            return;
        }

        @autoreleasepool {
            CIImage *image = [CIImage imageWithCVPixelBuffer:pixelBuffer];
            image = [image imageByApplyingOrientation:
                OrientationForFrame(rotationDegrees, effectiveMirror)];
            image = FitImage(image,
                             targetWidth,
                             targetHeight,
                             resizeMode,
                             flipY);

            MTLTextureDescriptor *descriptor =
                [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
                                                                   width:targetWidth
                                                                  height:targetHeight
                                                               mipmapped:NO];
            descriptor.usage = MTLTextureUsageShaderRead |
                               MTLTextureUsageRenderTarget;
            descriptor.storageMode = MTLStorageModePrivate;

            id<MTLTexture> texture = [self->_device newTextureWithDescriptor:descriptor];
            id<MTLCommandBuffer> commandBuffer = [self->_commandQueue commandBuffer];
            commandBuffer.label = @"ViroExternalVideo frame";

            [self->_ciContext render:image
                        toMTLTexture:texture
                       commandBuffer:commandBuffer
                              bounds:CGRectMake(0, 0, targetWidth, targetHeight)
                          colorSpace:self->_colorSpace];

            [commandBuffer addCompletedHandler:^(id<MTLCommandBuffer> completed) {
                if (completed.status == MTLCommandBufferStatusError) {
                    NSString *message = completed.error.localizedDescription ?: @"Metal frame conversion failed";
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [self _emitError:message];
                    });
                    return;
                }

                if (generation != self->_generation.load()) {
                    return;
                }

                dispatch_async(dispatch_get_main_queue(), ^{
                    if (generation != self->_generation.load() ||
                        !self->_boundMaterial) {
                        return;
                    }

                    auto substrate =
                        std::make_unique<VROTextureSubstrateMetal>(texture);
                    auto vroTexture =
                        std::make_shared<VROTexture>(
                            VROTextureType::Texture2D,
                            VROTextureInternalFormat::RGBA8,
                            std::move(substrate));

                    self->_boundTexture = vroTexture;
                    self->_boundMaterial->getDiffuse().setTexture(vroTexture);

                    if (!self->_readyFired) {
                        self->_readyFired = YES;
                        if (self.onCameraReadyViro) {
                            self.onCameraReadyViro(@{});
                        }
                    }
                });
            }];

            [commandBuffer commit];
        }

        CVPixelBufferRelease(pixelBuffer);
    });
}

- (void)_emitError:(NSString *)message {
    NSLog(@"[VRTExternalVideo] %@", message);
    if (_onErrorViro) {
        _onErrorViro(@{ @"error" : message ?: @"External video error" });
    }
}

- (void)prepareForRecycle {
    [self _detachProvider];
    [super prepareForRecycle];
}

- (void)dealloc {
    [self _detachProvider];

    if (_boundMaterial) {
        _boundMaterial->getDiffuse().setTexture(nullptr);
    }

    _boundTexture.reset();
    _boundMaterial.reset();
    _ciContext = nil;
    _commandQueue = nil;
    _device = nil;

    if (_colorSpace) {
        CGColorSpaceRelease(_colorSpace);
        _colorSpace = nullptr;
    }
}

@end
