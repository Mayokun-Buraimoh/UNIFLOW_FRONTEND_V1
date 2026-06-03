#import "SensoryWakeBridge.h"

#if __has_include(<snsr.h>)
#import <snsr.h>
#define SENSORY_HAS_SDK 1
#endif

static void (^g_onWake)(void);
static void (^g_onError)(NSString *);
#ifdef SENSORY_HAS_SDK
static SnsrSession g_session = NULL;
static dispatch_queue_t g_sensoryQueue;
#endif

bool SensoryWake_IsSdkLinked(void) {
#ifdef SENSORY_HAS_SDK
  return true;
#else
  return false;
#endif
}

#ifdef SENSORY_HAS_SDK
static SnsrRC resultEvent(SnsrSession s, const char *key, void *privateData) {
  (void)key;
  (void)privateData;
  if (g_onWake) {
    dispatch_async(dispatch_get_main_queue(), ^{
      g_onWake();
    });
  }
  return SNSR_RC_OK;
}
#endif

bool SensoryWake_Start(NSString *modelPath, void (^onWake)(void), void (^onError)(NSString *message)) {
  g_onWake = [onWake copy];
  g_onError = [onError copy];

#ifndef SENSORY_HAS_SDK
  if (g_onError) {
    g_onError(@"Sensory SDK not linked. Set SNSR_ROOT in ios/App/sensory.xcconfig and run: npm run setup:sensory");
  }
  return false;
#else
  SensoryWake_Stop();

  if (!g_sensoryQueue) {
    g_sensoryQueue = dispatch_queue_create("com.uniflow.sensorywake", DISPATCH_QUEUE_SERIAL);
  }

  __block BOOL ok = YES;
  dispatch_sync(g_sensoryQueue, ^{
    SnsrRC rc = snsrNew(&g_session);
    if (rc != SNSR_RC_OK) {
      ok = NO;
      return;
    }

    rc = snsrLoad(g_session, snsrStreamFromFileName(modelPath.UTF8String, "rb"));
    if (rc != SNSR_RC_OK) {
      ok = NO;
      return;
    }

    rc = snsrRequire(g_session, SNSR_TASK_TYPE, SNSR_PHRASESPOT);
    if (rc != SNSR_RC_OK) {
      ok = NO;
      return;
    }

    snsrSetHandler(g_session, SNSR_RESULT_EVENT, snsrCallback(resultEvent, NULL, NULL));
  });

  if (!ok) {
    if (g_onError) {
      g_onError(@"Failed to load Sensory phrase-spot model");
    }
    SensoryWake_Stop();
    return false;
  }
  return true;
#endif
}

void SensoryWake_PushPCM(const void *samples, size_t byteCount) {
#ifdef SENSORY_HAS_SDK
  if (!g_session || !samples || byteCount == 0) {
    return;
  }
  dispatch_async(g_sensoryQueue, ^{
    SnsrRC rc = snsrPush(g_session, SNSR_SOURCE_AUDIO_PCM, samples, byteCount);
    if (rc == SNSR_RC_STOP) {
      if (g_onWake) {
        dispatch_async(dispatch_get_main_queue(), ^{
          g_onWake();
        });
      }
      snsrClearRC(g_session);
    }
  });
#endif
}

void SensoryWake_Stop(void) {
#ifdef SENSORY_HAS_SDK
  if (g_sensoryQueue) {
    dispatch_sync(g_sensoryQueue, ^{
      if (g_session) {
        snsrRelease(g_session);
        g_session = NULL;
      }
    });
  }
#endif
  g_onWake = nil;
  g_onError = nil;
}
