import Foundation
import Capacitor
import AVFoundation

@objc(SensoryWakePlugin)
public class SensoryWakePlugin: CAPPlugin {
    private let defaultModel = "hey_ruby.snsr"
    private var audioEngine: AVAudioEngine?
    private var isListening = false

    @objc func getStatus(_ call: CAPPluginCall) {
        let modelFile = (call.getString("modelFile") ?? defaultModel).trimmingCharacters(in: .whitespacesAndNewlines)
        let modelUrl = Bundle.main.url(forResource: modelFile.replacingOccurrences(of: ".snsr", with: ""), withExtension: "snsr")
            ?? Bundle.main.url(forResource: "sensory/\(modelFile)", withExtension: nil)

        call.resolve([
            "sdkLinked": SensoryWake_IsSdkLinked(),
            "modelPresent": modelUrl != nil,
            "modelFile": modelFile,
        ])
    }

    @objc func startListening(_ call: CAPPluginCall) {
        let modelFile = (call.getString("modelFile") ?? defaultModel).trimmingCharacters(in: .whitespacesAndNewlines)
        let baseName = (modelFile as NSString).deletingPathExtension

        guard let modelPath = Bundle.main.path(forResource: baseName, ofType: "snsr") else {
            call.reject("Missing bundled Sensory model: \(modelFile)")
            return
        }

        guard SensoryWake_IsSdkLinked() else {
            call.reject(
                "Sensory SDK not linked. Set SNSR_ROOT in ios/App/sensory.xcconfig and run: npm run setup:sensory"
            )
            return
        }

        stopAudio()

        let started = SensoryWake_Start(modelPath, {
            self.notifyListeners("wakeDetected", data: [:])
        }, { message in
            NSLog("SensoryWake error: %@", message)
        })

        if !started {
            call.reject("Failed to start Sensory wake listener")
            return
        }

        do {
            try startMicrophoneTap()
            isListening = true
            call.resolve()
        } catch {
            SensoryWake_Stop()
            stopAudio()
            call.reject("Failed to start microphone for Sensory: \(error.localizedDescription)")
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        stopAudio()
        SensoryWake_Stop()
        isListening = false
        call.resolve()
    }

    private func stopAudio() {
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
    }

    private func startMicrophoneTap() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true)

        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!

        input.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, _ in
            guard let channelData = buffer.int16ChannelData else { return }
            let frameCount = Int(buffer.frameLength)
            let byteCount = frameCount * MemoryLayout<Int16>.size
            SensoryWake_PushPCM(channelData[0], byteCount)
        }

        engine.prepare()
        try engine.start()
        audioEngine = engine
    }
}
