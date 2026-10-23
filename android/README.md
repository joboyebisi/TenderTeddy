# TenderTeddy Fire TV shell

This is the first sideloadable Fire OS/Android TV client. It opens the existing
TenderTeddy device lab in a television-focused WebView and sends D-pad/Select input
to the same local lesson API.

## Build

From this directory:

```powershell
.\gradlew.bat assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.
The repository build also copies a testable artifact to
`public/downloads/TenderTeddy-firetv-debug.apk` so a Fire TV on the same network
can download it directly from the running TenderTeddy server.

## Connect to the lesson server

1. On the TenderTeddy computer, run `npm start` from the repository root.
2. Connect the computer and Fire TV Stick to the same Wi-Fi network.
3. Install and launch the APK.
4. A normal debug build defaults to the hosted HTTPS device lab, so the computer does
   not need to stay on after installation.
5. For local-server testing, press the Fire TV remote's **Menu** button and enter the
   computer's full address, such as `http://192.168.1.144:4201/test-lab.html`.

The AWS deployment script rebuilds this APK with the hosted HTTPS device-lab URL and
publishes it from the hosted app. You can also set the URL manually at build time with
`-PtenderTeddyServerUrl=https://example.test/test-lab.html`.

This shell is suitable for local or hosted alpha testing. Real Alexa account linking
and production parent authentication remain release gates.

For the least disruptive physical-device workflow, use
`scripts/install-fire-tv.ps1` from the repository root. It installs with `adb -r`,
preserving existing TenderTeddy app data and the saved server URL.
