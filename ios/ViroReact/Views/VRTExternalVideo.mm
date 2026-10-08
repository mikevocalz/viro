//
//  VRTExternalVideo.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Frames arrive from the producer on its own thread. Each one is converted on a private serial
//  queue: Core Image applies the producer's rotation and mirroring, fits the frame to pixelSize,
//  and renders it into a pooled BGRA CVPixelBuffer. The main thread then wraps that buffer with
//  the renderer's video texture cache and swaps it into the material, the same way the iOS AVPlayer
//  video texture does. Going through VRODriver::newVideoTextureCache keeps this independent of the
//  backend: the iPhone renderer is OpenGL ES, the visionOS renderer is Metal.
//
//  At most one frame is in flight from conversion to upload; frames that arrive in between are
//  dropped, so a slow renderer never builds a queue.
//

#import "VRTExternalVideo.h"
#import "VRTMaterialManager.h"
#import "VRTTextureSubstrateDefinition.h"

#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>
#import <objc/message.h>

#import <ViroKit/VRODriver.h>
#import <ViroKit/VROMaterial.h>
#import <ViroKit/VROTexture.h>
#import <ViroKit/VROVideoTextureCache.h>

#include <atomic>

namespace {

enum class VRTExternalVideoResizeMode : int { Cover = 0, Contain = 1, Stretch = 2 };

static NSString *const kProvideSelector = @"provideVideoFramesForSourceKey:consumer:width:height:";
static NSString *const kRevokeSelector = @"revokeVideoFramesForSourceKey:consumer:";

static CGImagePropertyOrientation OrientationForFrame(NSInteger degrees, BOOL mirrored) {
    NSInteger normalized = ((degrees % 360) + 360) % 360;
    if (mirrored) {
        switch (normalized) {
            // Rotating 90 CW then mirroring equals mirroring then rotating 270 CW (EXIF 5).
            case 90:  return kCGImagePropertyOrientationLeftMirrored;
            case 180: return kCGImagePropertyOrientationDownMirrored;
            case 270: return kCGImagePropertyOrientationRightMirrored;
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

static CIImage *FitImage(CIImage *image, CGFloat width, CGFloat height,
                         VRTExternalVideoResizeMode mode) {
    CGRect extent = image.extent;
    if (CGRectIsEmpty(extent) || CGRectIsInfinite(extent)) {
        return image;
    }
    CGFloat sx = width / CGRectGetWidth(extent);
    CGFloat sy = height / CGRectGetHeight(extent);
    CGAffineTransform toOrigin =
        CGAffineTransformMakeTranslation(-CGRectGetMinX(extent), -CGRectGetMinY(extent));

    if (mode == VRTExternalVideoResizeMode::Stretch) {
        return [image imageByApplyingTransform:CGAffineTransformConcat(
            toOrigin, CGAffineTransformMakeScale(sx, sy))];
    }

    CGFloat scale = mode == VRTExternalVideoResizeMode::Contain ? MIN(sx, sy) : MAX(sx, sy);
    CIImage *scaled = [image imageByApplyingTransform:CGAffineTransformConcat(
        toOrigin, CGAffineTransformMakeScale(scale, scale))];
    CGRect scaledExtent = scaled.extent;
    CGFloat dx = (width - CGRectGetWidth(scaledExtent)) * 0.5 - CGRectGetMinX(scaledExtent);
    CGFloat dy = (height - CGRectGetHeight(scaledExtent)) * 0.5 - CGRectGetMinY(scaledExtent);
    // "contain" leaves bars; fill them with opaque black instead of undefined pixels.
    CIImage *centered = [scaled imageByApplyingTransform:CGAffineTransformMakeTranslation(dx, dy)];
    CIImage *black = [[CIImage imageWithColor:[CIColor colorWithRed:0 green:0 blue:0]]
        imageByCroppingToRect:CGRectMake(0, 0, width, height)];
    return [centered imageByCompositingOverImage:black];
}

static uint64_t PackSize(NSInteger width, NSInteger height) {
    return ((uint64_t)(uint32_t)width << 32) | (uint64_t)(uint32_t)height;
}

static NSInteger PackedWidth(uint64_t size) { return (NSInteger)(size >> 32); }
static NSInteger PackedHeight(uint64_t size) { return (NSInteger)(size & 0xffffffffu); }

// Output buffers kept alive after upload. The Metal video texture cache releases its
// CVMetalTextureRef at once, so without this the pool could recycle a buffer the renderer is
// still sampling. Three matches the OpenGL cache's own in-flight ring.
static const size_t kRetainedOutputBuffers = 3;

static CVPixelBufferPoolRef CreateBGRAPool(NSInteger width, NSInteger height) {
    NSMutableDictionary *attributes = [@{
        (id)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA),
        (id)kCVPixelBufferWidthKey : @(width),
        (id)kCVPixelBufferHeightKey : @(height),
        (id)kCVPixelBufferIOSurfacePropertiesKey : @{},
        (id)kCVPixelBufferMetalCompatibilityKey : @YES,
    } mutableCopy];
#if TARGET_OS_IOS
    attributes[(id)kCVPixelBufferOpenGLESCompatibilityKey] = @YES;
#endif
    CVPixelBufferPoolRef pool = nullptr;
    CVPixelBufferPoolCreate(kCFAllocatorDefault, nullptr,
                            (__bridge CFDictionaryRef)attributes, &pool);
    return pool;
}

} // namespace

@implementation VRTExternalVideo {
    // Main thread only.
    std::shared_ptr<VROMaterial> _boundMaterial;
    std::shared_ptr<VROTexture> _texture;
    std::shared_ptr<VROVideoTextureCache> _textureCache;
    std::weak_ptr<VRODriver> _textureCacheDriver;
    CVPixelBufferRef _retainedOutputs[kRetainedOutputBuffers];
    size_t _nextRetainedOutput;
    NSString *_attachedClass;
    NSString *_attachedKey;
    NSString *_reportedError;
    BOOL _readyFired;

    // Read from the producer's thread.
    std::atomic<uint64_t> _generation;
    std::atomic<bool> _frameInFlight;
    // Width in the high 32 bits, height in the low 32, so a frame never sees half a resize.
    std::atomic<uint64_t> _pixelSize;
    std::atomic<int> _resizeModeValue;
    std::atomic<bool> _mirrorValue;

    // Frame queue only.
    dispatch_queue_t _frameQueue;
    CIContext *_ciContext;
    CGColorSpaceRef _colorSpace;
    CVPixelBufferPoolRef _pool;
    NSInteger _poolWidth;
    NSInteger _poolHeight;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        _resizeMode = @"cover";
        _generation.store(1);
        _frameInFlight.store(false);
        _pixelSize.store(PackSize(1280, 720));
        _resizeModeValue.store((int)VRTExternalVideoResizeMode::Cover);
        _mirrorValue.store(false);
        _frameQueue = dispatch_queue_create("com.reactvision.external-video",
                                            DISPATCH_QUEUE_SERIAL);
        _colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    }
    return self;
}

#pragma mark - Props

- (void)setMaterial:(NSString *)material {
    if (_material == material || [_material isEqualToString:material]) {
        return;
    }
    [self _unbindMaterial];
    _material = [material copy];
    [self _tryPrepare];
}

- (void)setSourceKey:(NSString *)sourceKey {
    if (_sourceKey == sourceKey || [_sourceKey isEqualToString:sourceKey]) {
        return;
    }
    [self _detachProvider];
    _sourceKey = [sourceKey copy];
    [self _tryPrepare];
}

- (void)setSourceClass:(NSString *)sourceClass {
    if (_sourceClass == sourceClass || [_sourceClass isEqualToString:sourceClass]) {
        return;
    }
    // Revoke through the class that was attached, not the new one.
    [self _detachProvider];
    _sourceClass = [sourceClass copy];
    [self _tryPrepare];
}

- (void)setResizeMode:(NSString *)resizeMode {
    _resizeMode = [resizeMode copy] ?: @"cover";
    VRTExternalVideoResizeMode mode = VRTExternalVideoResizeMode::Cover;
    if ([_resizeMode isEqualToString:@"contain"]) {
        mode = VRTExternalVideoResizeMode::Contain;
    } else if ([_resizeMode isEqualToString:@"stretch"]) {
        mode = VRTExternalVideoResizeMode::Stretch;
    }
    _resizeModeValue.store((int)mode);
}

- (void)setMirror:(BOOL)mirror {
    _mirror = mirror;
    _mirrorValue.store(mirror);
}

- (void)setPixelSizeWidth:(NSInteger)width height:(NSInteger)height {
    if (width <= 0 || height <= 0 || width > UINT32_MAX || height > UINT32_MAX) {
        return;
    }
    const uint64_t size = PackSize(width, height);
    if (size == _pixelSize.load()) {
        return;
    }
    _pixelSize.store(size);
    // The producer was told the old size; offer again so it can re-negotiate.
    [self _detachProvider];
    [self _tryPrepare];
}

- (void)setDriver:(std::shared_ptr<VRODriver>)driver {
    [super setDriver:driver];
    [self _tryPrepare];
}

#pragma mark - VRTView lifecycle

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
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

- (void)prepareForRecycle {
    [self _detachProvider];
    [self _unbindMaterial];
    [super prepareForRecycle];
}

- (void)dealloc {
    [self _detachProvider];

    // UIKit normally releases the view on main, but a producer thread holding the consumer can
    // take the last reference. Material and texture state belong to the render thread, which on
    // iOS is main, so hand them over instead of destroying them here.
    std::shared_ptr<VROMaterial> material = std::move(_boundMaterial);
    std::shared_ptr<VROTexture> texture = std::move(_texture);
    std::shared_ptr<VROVideoTextureCache> cache = std::move(_textureCache);
    NSMutableArray *outputs = [NSMutableArray array];
    for (size_t i = 0; i < kRetainedOutputBuffers; i++) {
        if (_retainedOutputs[i]) {
            [outputs addObject:(__bridge_transfer id)_retainedOutputs[i]];
            _retainedOutputs[i] = nullptr;
        }
    }
    void (^release)(void) = ^{
        if (material && texture && material->getDiffuse().getTexture() == texture) {
            material->getDiffuse().setTexture(nullptr);
        }
        (void)cache;
        (void)outputs;
    };
    if ([NSThread isMainThread]) {
        release();
    } else {
        dispatch_async(dispatch_get_main_queue(), release);
    }

    if (_pool) {
        CVPixelBufferPoolRelease(_pool);
    }
    if (_colorSpace) {
        CGColorSpaceRelease(_colorSpace);
    }
}

#pragma mark - Binding

- (void)_tryPrepare {
    if (!self.driver || !_material || !_sourceKey || !_sourceClass) {
        return;
    }
    if (![self _bindMaterial]) {
        return;
    }
    [self _attachProviderIfNeeded];
}

- (BOOL)_bindMaterial {
    VRTMaterialManager *manager = [self.bridge moduleForClass:[VRTMaterialManager class]];
    std::shared_ptr<VROMaterial> material = [manager getMaterialByName:_material];
    if (!material) {
        [self _emitError:[NSString stringWithFormat:@"Material '%@' not found", _material]];
        return NO;
    }
    if (material != _boundMaterial) {
        [self _unbindMaterial];
        _boundMaterial = material;
    }
    if (_texture) {
        _boundMaterial->getDiffuse().setTexture(_texture);
    }
    return YES;
}

- (void)_unbindMaterial {
    if (_boundMaterial && _texture &&
        _boundMaterial->getDiffuse().getTexture() == _texture) {
        _boundMaterial->getDiffuse().setTexture(nullptr);
    }
    _boundMaterial.reset();
}

- (void)_attachProviderIfNeeded {
    if (_attachedClass) {
        return;
    }
    Class provider = NSClassFromString(_sourceClass);
    if (!provider) {
        [self _emitError:[NSString stringWithFormat:
            @"External video producer '%@' not found. Install the producer adapter "
            @"(for WebRTC: react-native-viro-webrtc) and rebuild the app.", _sourceClass]];
        return;
    }
    SEL provide = NSSelectorFromString(kProvideSelector);
    if (![provider respondsToSelector:provide]) {
        [self _emitError:[NSString stringWithFormat:
            @"External video producer '%@' does not implement +%@", _sourceClass, kProvideSelector]];
        return;
    }

    _attachedClass = [_sourceClass copy];
    _attachedKey = [_sourceKey copy];
    using ProvideFn = void (*)(id, SEL, NSString *, id, NSInteger, NSInteger);
    const uint64_t size = _pixelSize.load();
    ((ProvideFn)objc_msgSend)(provider, provide, _attachedKey, self,
                              PackedWidth(size), PackedHeight(size));
}

- (void)_detachProvider {
    // Frames already converted for the old source are discarded on arrival.
    _generation.fetch_add(1);
    _readyFired = NO;
    _reportedError = nil;

    NSString *attachedClass = _attachedClass;
    NSString *attachedKey = _attachedKey;
    _attachedClass = nil;
    _attachedKey = nil;
    if (!attachedClass) {
        return;
    }

    Class provider = NSClassFromString(attachedClass);
    SEL revoke = NSSelectorFromString(kRevokeSelector);
    if (provider && [provider respondsToSelector:revoke]) {
        using RevokeFn = void (*)(id, SEL, NSString *, id);
        ((RevokeFn)objc_msgSend)(provider, revoke, attachedKey, self);
    }
}

#pragma mark - VRTExternalVideoFrameConsumer

- (void)consumePixelBuffer:(CVPixelBufferRef)pixelBuffer
           rotationDegrees:(NSInteger)rotationDegrees
                  mirrored:(BOOL)mirrored {
    if (!pixelBuffer) {
        return;
    }
    bool expected = false;
    if (!_frameInFlight.compare_exchange_strong(expected, true)) {
        return;
    }

    const uint64_t generation = _generation.load();
    const uint64_t size = _pixelSize.load();
    const NSInteger width = PackedWidth(size);
    const NSInteger height = PackedHeight(size);
    const auto mode = (VRTExternalVideoResizeMode)_resizeModeValue.load();
    const BOOL mirror = (mirrored ? YES : NO) ^ (_mirrorValue.load() ? YES : NO);

    CVPixelBufferRetain(pixelBuffer);
    __weak VRTExternalVideo *weakSelf = self;
    dispatch_async(_frameQueue, ^{
        VRTExternalVideo *strongSelf = weakSelf;
        if (!strongSelf) {
            CVPixelBufferRelease(pixelBuffer);
            return;
        }
        CVPixelBufferRef output = [strongSelf _convert:pixelBuffer rotation:rotationDegrees
                                                mirror:mirror width:width height:height
                                                  mode:mode];
        CVPixelBufferRelease(pixelBuffer);
        // strongSelf moves into the main-queue block, so if it holds the last reference the
        // view is released, and deallocated, on the main thread rather than this queue.
        dispatch_async(dispatch_get_main_queue(), ^{
            if (output) {
                [strongSelf _present:output generation:generation];
                CVPixelBufferRelease(output);
            }
            strongSelf->_frameInFlight.store(false);
        });
    });
}

#pragma mark - Frame queue

- (CVPixelBufferRef)_convert:(CVPixelBufferRef)input
                    rotation:(NSInteger)rotation
                      mirror:(BOOL)mirror
                       width:(NSInteger)width
                      height:(NSInteger)height
                        mode:(VRTExternalVideoResizeMode)mode {
    if (!_ciContext) {
        _ciContext = [CIContext contextWithOptions:@{
            kCIContextWorkingColorSpace : (__bridge id)_colorSpace,
            kCIContextOutputColorSpace : (__bridge id)_colorSpace,
        }];
    }
    if (!_pool || _poolWidth != width || _poolHeight != height) {
        if (_pool) {
            CVPixelBufferPoolRelease(_pool);
        }
        _pool = CreateBGRAPool(width, height);
        _poolWidth = width;
        _poolHeight = height;
    }
    if (!_pool) {
        return nullptr;
    }

    CVPixelBufferRef output = nullptr;
    if (CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, _pool, &output) != kCVReturnSuccess ||
        !output) {
        return nullptr;
    }

    @autoreleasepool {
        CIImage *image = [CIImage imageWithCVPixelBuffer:input];
        image = [image imageByApplyingOrientation:OrientationForFrame(rotation, mirror)];
        image = FitImage(image, width, height, mode);
        [_ciContext render:image
           toCVPixelBuffer:output
                    bounds:CGRectMake(0, 0, width, height)
                colorSpace:_colorSpace];
    }
    return output;
}

#pragma mark - Main thread

- (void)_present:(CVPixelBufferRef)buffer generation:(uint64_t)generation {
    std::shared_ptr<VRODriver> driver = self.driver;
    if (generation != _generation.load() || !driver || !_boundMaterial) {
        return;
    }

    if (!_textureCache || _textureCacheDriver.lock() != driver) {
        _textureCache = driver->newVideoTextureCache();
        _textureCacheDriver = driver;
        _texture.reset();
    }
    if (!_textureCache) {
        [self _emitError:@"The renderer did not provide a video texture cache"];
        return;
    }

    const bool sRGB = driver->getColorRenderingMode() != VROColorRenderingMode::NonLinear;
    std::unique_ptr<VROTextureSubstrate> substrate =
        _textureCache->createTextureSubstrate(buffer, sRGB);
    if (!substrate) {
        return;
    }

    size_t slot = _nextRetainedOutput;
    _nextRetainedOutput = (slot + 1) % kRetainedOutputBuffers;
    if (_retainedOutputs[slot]) {
        CVPixelBufferRelease(_retainedOutputs[slot]);
    }
    _retainedOutputs[slot] = CVPixelBufferRetain(buffer);

    if (_texture) {
        _texture->setSubstrate(0, std::move(substrate));
    } else {
        _texture = std::make_shared<VROTexture>(VROTextureType::Texture2D,
                                                VROTextureInternalFormat::RGBA8,
                                                std::move(substrate));
        _boundMaterial->getDiffuse().setTexture(_texture);
    }

    if (!_readyFired) {
        _readyFired = YES;
        if (self.onCameraReadyViro) {
            self.onCameraReadyViro(@{});
        }
    }
}

- (void)_emitError:(NSString *)message {
    // A configuration error repeats on every prop pass; report each distinct one once.
    if ([_reportedError isEqualToString:message]) {
        return;
    }
    _reportedError = [message copy];
    NSLog(@"[VRTExternalVideo] %@", message);
    if (self.onErrorViro) {
        self.onErrorViro(@{ @"error" : message });
    }
}

@end
