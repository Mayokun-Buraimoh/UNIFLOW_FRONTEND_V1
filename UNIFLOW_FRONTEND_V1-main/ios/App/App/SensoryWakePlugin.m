#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SensoryWakePlugin, "SensoryWake",
           CAP_PLUGIN_METHOD(getStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startListening, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopListening, CAPPluginReturnPromise);
)
