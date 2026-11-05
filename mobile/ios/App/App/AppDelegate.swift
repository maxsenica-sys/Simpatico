import UIKit
import AVFoundation
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Simpatico is a video-call app: play the other person through the loudspeaker (not the
        // earpiece), allow Bluetooth headsets, and use the voice-chat mode, which is what makes
        // iOS offer microphone modes such as Voice Isolation for this app.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .videoChat, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Simpatico native additions
// Kept in this file so they are part of the app target without editing the Xcode project.

/// The app's main screen: Capacitor's web view (loading the Simpatico web app) plus our plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VoiceFocusPlugin())
    }
}

/// "Voice focus" on iPhone: opens the system microphone-mode picker, where people choose
/// Voice Isolation so only the voice nearest the phone is picked up (and captioned).
/// Web: `Capacitor.Plugins.VoiceFocus.showMicModes()` / `.status()` (see lib/native.ts).
@objc(VoiceFocusPlugin)
public class VoiceFocusPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VoiceFocusPlugin"
    public let jsName = "VoiceFocus"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showMicModes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    @objc func showMicModes(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 15.0, *) {
                AVCaptureDevice.showSystemUserInterface(.microphoneModes)
                call.resolve(["shown": true])
            } else {
                call.resolve(["shown": false])
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            let mode: String
            switch AVCaptureDevice.preferredMicrophoneMode {
            case .voiceIsolation: mode = "voiceIsolation"
            case .wideSpectrum: mode = "wideSpectrum"
            default: mode = "standard"
            }
            call.resolve(["mode": mode, "available": true])
        } else {
            call.resolve(["mode": "standard", "available": false])
        }
    }
}
