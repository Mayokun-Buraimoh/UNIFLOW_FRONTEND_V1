package com.uniflow.app.sensorywake

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.sensory.snsr.Snsr
import com.sensory.snsr.SnsrRC
import com.sensory.snsr.SnsrSession
import java.util.concurrent.atomic.AtomicBoolean

/**
 * TrulyNatural / TrulyHandsfree phrase spotter (PHRASESPOT task).
 * @see https://doc.sensory.com/tnl/latest/api/inference/
 */
class SensoryWakeRuntimeImpl : SensoryWakeRuntime {
    private var session: SnsrSession? = null
    private var audioRecord: AudioRecord? = null
    private var worker: Thread? = null
    private val running = AtomicBoolean(false)

    override fun isSdkLinked(): Boolean = true

    override fun resolveModelPath(assetName: String): String? = null

    override fun start(modelPath: String, onWake: () -> Unit, onError: (String) -> Unit) {
        stop()

        try {
            val s =
                SnsrSession()
                    .load(modelPath)
                    .require(Snsr.TASK_TYPE, Snsr.PHRASESPOT)

            s.setHandler(Snsr.RESULT_EVENT) { _, _ ->
                onWake()
                SnsrRC.OK
            }

            val sampleRate = 16_000
            val channel = AudioFormat.CHANNEL_IN_MONO
            val encoding = AudioFormat.ENCODING_PCM_16BIT
            val minBuf = AudioRecord.getMinBufferSize(sampleRate, channel, encoding)
            if (minBuf <= 0) {
                onError("AudioRecord buffer size invalid")
                return
            }

            val recorder =
                AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    sampleRate,
                    channel,
                    encoding,
                    minBuf * 2
                )
            if (recorder.state != AudioRecord.STATE_INITIALIZED) {
                onError("Failed to initialize microphone for Sensory wake word")
                recorder.release()
                return
            }

            session = s
            audioRecord = recorder
            running.set(true)
            recorder.startRecording()

            worker =
                Thread(
                    {
                        val buffer = ByteArray(minBuf)
                        while (running.get()) {
                            val read = recorder.read(buffer, 0, buffer.size)
                            if (read <= 0) continue
                            val rc = s.push(Snsr.SOURCE_AUDIO_PCM, buffer, read)
                            if (rc == SnsrRC.STOP) {
                                onWake()
                                s.clearRC()
                            } else if (rc != SnsrRC.OK) {
                                onError("Sensory push error: $rc")
                                break
                            }
                        }
                    },
                    "SensoryWakeAudio"
                ).also { it.start() }
        } catch (err: Exception) {
            stop()
            onError(err.message ?: "Sensory wake start failed")
        }
    }

    override fun stop() {
        running.set(false)
        try {
            worker?.interrupt()
            worker?.join(1500)
        } catch (_: Exception) {
        }
        worker = null

        try {
            audioRecord?.stop()
        } catch (_: Exception) {
        }
        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }
        audioRecord = null

        try {
            session?.release()
        } catch (_: Exception) {
        }
        session = null
    }
}
