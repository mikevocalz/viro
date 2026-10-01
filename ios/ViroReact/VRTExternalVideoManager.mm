//
//  VRTExternalVideoManager.mm
//  ViroReact
//

#import <React/RCTUIManager.h>
#import "ViroViewManager.h"
#import "VRTExternalVideo.h"

@interface VRTExternalVideoManager : ViroViewManager
@end

@implementation VRTExternalVideoManager

RCT_EXPORT_MODULE()

RCT_EXPORT_VIEW_PROPERTY(material, NSString)
RCT_EXPORT_VIEW_PROPERTY(sourceKey, NSString)
RCT_EXPORT_VIEW_PROPERTY(sourceClass, NSString)
RCT_EXPORT_VIEW_PROPERTY(resizeMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(mirror, BOOL)
RCT_EXPORT_VIEW_PROPERTY(flipY, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onCameraReadyViro, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onErrorViro, RCTDirectEventBlock)

RCT_CUSTOM_VIEW_PROPERTY(pixelSize, NSDictionary *, VRTExternalVideo) {
    if (![json isKindOfClass:[NSDictionary class]]) {
        return;
    }
    NSNumber *width = json[@"width"];
    NSNumber *height = json[@"height"];
    if (width && height) {
        [view setPixelSizeWidth:width.integerValue
                         height:height.integerValue];
    }
}

- (VRTView *)view {
    return [[VRTExternalVideo alloc] initWithBridge:self.bridge];
}

@end
