package com.uniflow.app.sensorywake

/**
 * Default build when sensory.enabled=false.
 * Replace by enabling Sensory in android/gradle.properties and running npm run setup:sensory.
 */
class SensoryWakeRuntimeImpl : SensoryWakeRuntime {
    override fun isSdkLinked(): Boolean = false

    override fun resolveModelPath(assetName: String): String? = null

    override fun start(modelPath: String, onWake: () -> Unit, onError: (String) -> Unit) {
        onError(
            "Sensory SDK not linked. Set sensory.enabled=true in android/gradle.properties " +
                "and run: npm run setup:sensory"
        )
    }

    override fun stop() {
        /* noop */
    }
}
