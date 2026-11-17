import UIKit
import Capacitor

// The app's one screen: Capacitor's web view, plus
//  - NOT the iPhone's own swipe-back (on 2026-10-30, off 2026-11-17): it slid
//    a snapshot of the whole screen, bars included, and painted a flat colour
//    where it had none. The page does the swipe itself now (app.js
//    edgeSwipe), moving only what is between the bars; it runs only when the
//    user agent says "CHSwipe/1" (capacitor.config.json), which only a build
//    with this line has;
//  - a background that follows light/dark (2026-10-30): between two pages the
//    web view shows its own background for a moment, and a fixed dark one
//    flashed black between light pages. These are the site's --bg colours.
class ViewController: CAPBridgeViewController {
    static let pageBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x08 / 255.0, green: 0x0e / 255.0, blue: 0x20 / 255.0, alpha: 1)
            : UIColor(red: 0xf5 / 255.0, green: 0xf5 / 255.0, blue: 0xf3 / 255.0, alpha: 1)
    }

    override func capacitorDidLoad() {
        webView?.allowsBackForwardNavigationGestures = false
        view.backgroundColor = ViewController.pageBackground
        webView?.isOpaque = false
        webView?.backgroundColor = ViewController.pageBackground
        webView?.scrollView.backgroundColor = ViewController.pageBackground
        // Behind a swipe-back, where the web view has no picture of the page
        // you are going back to, it paints this — light grey by default, even
        // in dark mode (Carter, 2026-10-31).
        if #available(iOS 15.0, *) {
            webView?.underPageBackgroundColor = ViewController.pageBackground
        }
    }
}
