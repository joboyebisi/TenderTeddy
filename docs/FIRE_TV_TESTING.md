# Fire TV test handoff

TenderTeddy is available as a hosted alpha. The Fire TV Stick does not need to be on
the developer computer's Wi-Fi and the computer does not need to remain running.

## Fastest repeatable install (recommended)

This path preserves TenderTeddy's saved server address and app data; it does not
uninstall the current build or change other Fire TV apps.

1. On the Fire TV, open **Settings → My Fire TV → About** and press Select seven times
   if **Developer Options** is hidden.
2. Open **Developer Options**, enable **ADB Debugging**, then note the device IP under
   **About → Network**.
3. On the computer, install **Android SDK Platform-Tools** from Android Studio's SDK
   Manager if `adb version` does not work.
4. Build the current source and install it, replacing `192.168.1.50` with the TV IP:

```powershell
cd .\android
.\gradlew.bat assembleDebug
cd ..
.\scripts\install-fire-tv.ps1 -FireTvIp 192.168.1.50 -ApkPath android/app/build/outputs/apk/debug/app-debug.apk
```

5. Accept the one-time debugging prompt on the TV. If the first command reports that
   the device is unauthorised, run it once more after accepting.

The debug build defaults to the hosted HTTPS app, so the computer can be turned off
after installation. Press the Fire TV remote's Menu button to change the server URL.

## Install without developer tools

1. Download `TenderTeddy-firetv-debug.apk` from the hosted app:
   `https://kb03uya0w8.execute-api.eu-west-2.amazonaws.com/downloads/TenderTeddy-firetv-debug.apk`
2. Transfer the APK with a sideloading method the tester trusts, such as Downloader or
   Send Files to TV. Downloader can use the URL above directly.
3. Enable installation for that sideloading app in Fire TV developer options, install
   the APK, then launch **TenderTeddy**.
4. The app opens the hosted device lab automatically. Use the D-pad and Select button.
   Press the remote's Menu button only if the server address ever needs changing.

## Test route

Use fictional data only in this public alpha:

1. Create a test child profile in the web family app.
2. Add a parent-reviewed content link and generate a Gemini lesson candidate.
3. Review and approve the exact checkpoint.
4. Open TenderTeddy on Fire TV, start the approved lesson and answer once incorrectly
   to see a hint, then correctly to complete it.
5. Confirm the parent progress view records attempts without raw audio.
6. Export the test child's data, then delete the test profile and verify its lessons,
   sessions and progress disappear.

## Automated pre-demo smoke test

Run the hosted family journey from profile creation through live Gemini generation,
remote/Alexa answer sharing, progress persistence, and cleanup:

```powershell
$env:E2E_BASE_URL='https://kb03uya0w8.execute-api.eu-west-2.amazonaws.com'
$env:E2E_REQUIRE_AI='true'
npm run test:e2e
Remove-Item Env:E2E_BASE_URL,Env:E2E_REQUIRE_AI
```

The script creates a uniquely named temporary child and deletes that child's lessons,
sessions, and progress in `finally`, even when an assertion fails. It reuses existing
eligible content where possible. Do not run it against a production family account;
the current hosted alpha has no tenant authentication.

`aiConfigured: true` only means a key was resolved. A passing line reading
`PASS live Gemini candidate (...)` is the proof that generation worked. The hosted
check on 23 October 2026 returned HTTP 503 during generation; deploy the current
bounded-timeout code and repeat this command before the demo.

## Physical-TV acceptance checks

- TenderTeddy appears in the Apps library and launches without the computer running.
- All primary buttons show a visible focus state with D-pad navigation.
- Select activates the focused answer; Back behaves predictably; Menu opens the server
  address dialog.
- A wrong answer shows a supportive hint and a later correct answer records progress.
- Text fits inside the TV safe area and remains readable from normal viewing distance.
- Disabling Wi-Fi shows the retry screen; reconnecting and pressing Select recovers.
- Re-running `install-fire-tv.ps1` upgrades the APK without deleting its saved URL.

Gemini generation is unavailable until a rotated API key is saved in the stack's
Secrets Manager secret. Parent authentication and separate household tenancy are the
release gates before testing with real family information.
