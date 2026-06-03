import Foundation
import Capacitor
import MicrosoftCognitiveServicesSpeech

@objc(RubyWakePlugin)
public class RubyWakePlugin: CAPPlugin {
    private var keywordRecognizer: SPXKeywordRecognizer?

    @objc func startListening(_ call: CAPPluginCall) {
        guard let speechKey = call.getString("speechKey")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !speechKey.isEmpty else {
            call.reject("Missing speechKey")
            return
        }

        guard let region = call.getString("region")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !region.isEmpty else {
            call.reject("Missing region")
            return
        }

        guard let modelPath = Bundle.main.path(forResource: "hey_ruby", ofType: "table") else {
            call.reject("Missing bundled keyword model: hey_ruby.table")
            return
        }

        do {
            if let existing = keywordRecognizer {
                existing.stopRecognitionAsync()
                keywordRecognizer = nil
            }

            let speechConfig = try SPXSpeechConfiguration(subscription: speechKey, region: region)
            let keywordModel = try SPXKeywordRecognitionModel(fromFile: modelPath)
            let audioConfig = try SPXAudioConfiguration(microphoneInputWith: nil)
            let recognizer = try SPXKeywordRecognizer(audioConfig: audioConfig)

            recognizer.addRecognizedEventHandler { [weak self] _, _ in
                self?.notifyListeners("wakeDetected", data: [:])
            }

            keywordRecognizer = recognizer
            recognizer.startRecognition(keywordModel)
            call.resolve()
        } catch {
            keywordRecognizer = nil
            call.reject("Failed to start Azure wake listener: \(error.localizedDescription)")
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        if let recognizer = keywordRecognizer {
            recognizer.stopRecognitionAsync()
            keywordRecognizer = nil
        }
        call.resolve()
    }
}
