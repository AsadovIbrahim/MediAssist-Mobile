#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

@interface LocalNotificationModule : NSObject <RCTBridgeModule>
@end

@implementation LocalNotificationModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(scheduleNotification:(double)id
                  title:(NSString *)title
                  message:(NSString *)message
                  triggerTimeMillis:(double)triggerTimeMillis
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                          completionHandler:^(BOOL granted, NSError * _Nullable error) {
        if (error) {
            reject(@"AUTH_ERROR", error.localizedDescription, error);
            return;
        }
        
        UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
        content.title = title;
        content.body = message;
        content.sound = [UNNotificationSound defaultSound];
        
        NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
        NSTimeInterval target = triggerTimeMillis / 1000.0;
        NSTimeInterval interval = target - now;
        if (interval < 1.0) {
            interval = 1.0;
        }
        
        UNTimeIntervalNotificationTrigger *trigger = [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:interval repeats:NO];
        NSString *identifier = [NSString stringWithFormat:@"%.0f", id];
        UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger];
        
        [center addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable addError) {
            if (addError) {
                reject(@"SCHEDULE_ERROR", addError.localizedDescription, addError);
            } else {
                resolve(@(YES));
            }
        }];
    }];
}

RCT_EXPORT_METHOD(cancelNotification:(double)id
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *identifier = [NSString stringWithFormat:@"%.0f", id];
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    [center removePendingNotificationRequestsWithIdentifiers:@[identifier]];
    [center removeDeliveredNotificationsWithIdentifiers:@[identifier]];
    resolve(@(YES));
}

@end

