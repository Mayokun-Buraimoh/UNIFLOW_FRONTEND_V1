package com.uniflow.app.sensorywake

interface SensoryWakeRuntime {
    fun isSdkLinked(): Boolean
    fun resolveModelPath(assetName: String): String?
    fun start(modelPath: String, onWake: () -> Unit, onError: (String) -> Unit)
    fun stop()
}
