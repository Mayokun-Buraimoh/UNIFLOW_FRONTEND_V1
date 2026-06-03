package com.uniflow.app.sensorywake

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.uniflow.app.BuildConfig
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "SensoryWake")
class SensoryWakePlugin : Plugin() {
    private val runtime: SensoryWakeRuntime = SensoryWakeRuntimeImpl()
    private val defaultModel = "hey_ruby.snsr"

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val modelFile = call.getString("modelFile")?.trim().orEmpty().ifEmpty { defaultModel }
        val assetPath = "sensory/$modelFile"
        val modelPresent = try {
            context.assets.open(assetPath).close()
            true
        } catch (_: Exception) {
            false
        }

        val ret = JSObject()
        ret.put("sdkLinked", runtime.isSdkLinked())
        ret.put("modelPresent", modelPresent)
        ret.put("modelFile", modelFile)
        ret.put("sensoryBuildEnabled", BuildConfig.SENSORY_SDK_ENABLED)
        call.resolve(ret)
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        val modelFile = call.getString("modelFile")?.trim().orEmpty().ifEmpty { defaultModel }
        val assetPath = "sensory/$modelFile"

        try {
            context.assets.open(assetPath).use { /* exists */ }
        } catch (_: Exception) {
            call.reject("Missing Sensory model asset: $assetPath")
            return
        }

        if (!runtime.isSdkLinked()) {
            call.reject(
                "Sensory SDK not linked. Set sensory.enabled=true in android/gradle.properties " +
                    "and run: npm run setup:sensory"
            )
            return
        }

        try {
            val modelPath = copyAssetToCache(assetPath)
            stopInternal()

            var failed = false
            runtime.start(
                modelPath,
                onWake = {
                    bridge.execute(Runnable { notifyListeners("wakeDetected", JSObject()) })
                },
                onError = { msg ->
                    if (!failed) {
                        failed = true
                        call.reject(msg)
                    }
                }
            )
            if (!failed) {
                call.resolve()
            }
        } catch (err: Exception) {
            stopInternal()
            call.reject("Failed to start Sensory wake listener: ${err.message}")
        }
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        stopInternal()
        call.resolve()
    }

    private fun stopInternal() {
        runtime.stop()
    }

    private fun copyAssetToCache(assetPath: String): String {
        val name = assetPath.substringAfterLast('/')
        val outFile = File(context.cacheDir, name)
        context.assets.open(assetPath).use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        }
        return outFile.absolutePath
    }
}
