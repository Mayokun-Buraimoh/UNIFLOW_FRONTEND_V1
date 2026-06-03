#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

bool SensoryWake_IsSdkLinked(void);
bool SensoryWake_Start(NSString *modelPath, void (^onWake)(void), void (^onError)(NSString *message));
void SensoryWake_Stop(void);
void SensoryWake_PushPCM(const void *samples, size_t byteCount);

NS_ASSUME_NONNULL_END
