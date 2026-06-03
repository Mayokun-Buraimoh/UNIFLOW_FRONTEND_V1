#import <Capacitor/Capacitor.h>

CAP_PLUGIN(RubyWakePlugin, "RubyWake",
           CAP_PLUGIN_METHOD(startListening, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopListening, CAPPluginReturnPromise);
)
