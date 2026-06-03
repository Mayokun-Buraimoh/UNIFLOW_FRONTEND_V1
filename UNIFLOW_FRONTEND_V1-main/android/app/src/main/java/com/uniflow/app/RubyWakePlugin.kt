package com.uniflow.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.microsoft.cognitiveservices.speech.KeywordRecognitionModel
import com.microsoft.cognitiveservices.speech.KeywordRecognizer
import com.microsoft.cognitiveservices.speech.ResultReason
import com.microsoft.cognitiveservices.speech.audio.AudioConfig
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "RubyWake")
class RubyWakePlugin : Plugin() {
    private var keywordRecognizer: KeywordRecognizer? = null
    private var audioConfig: AudioConfig? = null
    private var model: KeywordRecognitionModel? = null

    @PluginMethod
    fun startListening(call: PluginCall) {
        try {
            val modelPath = copyAssetToCacheAndGetPath("hey_ruby.table")

            stopRecognizerInternal()

            model = KeywordRecognitionModel.fromFile(modelPath)
            audioConfig = AudioConfig.fromDefaultMicrophoneInput()
            val recognizer = KeywordRecognizer(audioConfig)

            recognizer.recognized.addEventListener { _, e ->
                if (e.result.reason == ResultReason.RecognizedKeyword) {
                    notifyListeners("wakeDetected", JSObject())
                }
            }

            keywordRecognizer = recognizer
            recognizer.startKeywordRecognitionAsync(model).get()
            call.resolve()
        } catch (err: Exception) {
            stopRecognizerInternal()
            call.reject("Failed to start Azure wake listener: ${err.message}")
        }
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        stopRecognizerInternal()
        call.resolve()
    }

    private fun stopRecognizerInternal() {
        try {
            keywordRecognizer?.stopRecognitionAsync()?.get()
        } catch (_: Exception) {
        }
        try {
            keywordRecognizer?.close()
        } catch (_: Exception) {
        }
        try {
            audioConfig?.close()
        } catch (_: Exception) {
        }
        try {
            model?.close()
        } catch (_: Exception) {
        }

        keywordRecognizer = null
        audioConfig = null
        model = null
    }

    private fun copyAssetToCacheAndGetPath(assetName: String): String {
        val outFile = File(context.cacheDir, assetName)
        context.assets.open(assetName).use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        }
        return outFile.absolutePath
    }
}
