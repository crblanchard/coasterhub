import UIKit
import Capacitor

// The app's one screen: Capacitor's web view, plus the iPhone's swipe from the
// left edge to go back (2026-10-30), which a plain web view leaves off.
class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        webView?.allowsBackForwardNavigationGestures = true
    }
}
