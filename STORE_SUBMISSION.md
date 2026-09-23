# Sports Syndicate Fantasy — Mobile Release Guide

Last updated: September 17, 2026

## Release status

- Public app name: `Sports Syndicate Fantasy`
- Bundle/application ID: `com.sportssyndicate.fantasy`
- Web production URL: `https://degens-sports-pools-iota.vercel.app`
- iOS project: `ios/App/App.xcodeproj`
- Android project: `android/`
- Apple Developer account: not created
- Google Play Console account: not created
- Signing and push credentials: intentionally not present

The generated Capacitor projects are suitable for local development and internal device testing. `npm run mobile:sync:live` loads the production website through a temporary `server.url`. Capacitor documents that option for live-reload use, not production distribution, and Apple can reject a thin website wrapper under App Review Guideline 4.2. The default `npm run mobile:sync` does not set a remote server, preventing an accidental hosted-shell submission. Before store review, replace `native-shell` with a bundled mobile frontend (or another architecture with meaningful native behavior), then retest offline/error states.

## Commands

```bash
npm install
npm run check
npm run mobile:sync
npm run mobile:sync:live # internal device testing only
npm run mobile:ios
npm run mobile:android
```

`mobile:ios` requires macOS and Xcode. Android builds require Android Studio/JDK and an installed Android SDK. The one-time asset generator is intentionally not retained as a dependency; reinstall the current `@capacitor/assets` temporarily only when replacing `assets/logo.png`, review its generated output, and remove it again afterward.

## Native behavior already prepared

- iOS and Android projects with the permanent app identifier
- App icon and launch assets generated from the accepted Sports Syndicate shield
- iOS camera and microphone permission descriptions
- Android camera, microphone, internet, and notification permissions
- Deep-link scheme: `sportssyndicate://app/...`
- Android back-button handling, keyboard resizing, status bar, and splash behavior
- PWA install prompts hidden inside native apps
- Native APNs/FCM token registration UI and protected database storage
- In-app permanent account deletion with `DELETE` confirmation

Native notification delivery still needs an APNs key, Firebase project, server-side sender, and real-device testing. Never commit `.p8`, `.p12`, `.jks`, `.keystore`, `google-services.json`, `GoogleService-Info.plist`, or provisioning profiles.

## Account and certificate setup

### Apple

1. Enroll the legal owner or company in the Apple Developer Program. Use an Organization account if a registered legal entity will publish the app; otherwise use an Individual account.
2. Register App ID `com.sportssyndicate.fantasy` and enable Push Notifications.
3. Create the app in App Store Connect with the name `Sports Syndicate Fantasy`.
4. In Xcode, select the publishing team, keep automatic signing enabled initially, and confirm the bundle ID.
5. Create an APNs Auth Key (`.p8`) and record its Key ID and Team ID in the secret manager used by the notification sender.
6. Archive with the current App Store-required Xcode/iOS SDK, upload to TestFlight, and test on a real iPhone before review.

### Google

1. Create the Play Console account under the intended legal owner or organization.
2. Create the app with package name `com.sportssyndicate.fantasy`.
3. Create a Firebase project, add the Android app, download `google-services.json` to `android/app/`, and enable Cloud Messaging.
4. Use Play App Signing. Generate an upload key locally and keep the keystore and passwords outside Git.
5. Build an Android App Bundle (`.aab`) targeting API 36 or newer and upload it to Internal testing first.
6. If this is a new personal Play account, plan for Google's required closed test before production access.

## Store listing draft

### Shared identity

- Name: Sports Syndicate Fantasy
- Category: Sports
- Support URL: `https://degens-sports-pools-iota.vercel.app/support`
- Privacy Policy URL: `https://degens-sports-pools-iota.vercel.app/privacy`
- Account deletion URL: `https://degens-sports-pools-iota.vercel.app/account/delete`
- Copyright: `[YEAR] [LEGAL OWNER NAME]`

### Apple subtitle

`Survivor, Pick'em & Pool Picks`

### Google short description

`Run sports pools, lock in picks, follow standings, and stay on deadline.`

### Full description draft

Sports Syndicate Fantasy gives commissioners and players one place to run private sports pools. Create or join Survivor, Pick'em, bracket, and playoff fantasy pools; make picks; track standings; receive optional deadline alerts; and follow verified prize draws.

Commissioners can manage league settings and members while players get a focused pick experience with clear confirmation. Optional live broadcasts let commissioners share a draw or league update with their members.

Sports Syndicate Fantasy does not sell picks or guarantee outcomes. Pool commissioners are responsible for their pool rules and compliance with applicable laws.

### Apple keywords draft

`sports pools,survivor,pickem,picks,standings,bracket,fantasy,league`

### Review notes draft

Provide two non-production review accounts: one player and one commissioner. Include credentials and these paths:

1. Sign in and open the sample pool.
2. Player: select a week, make a pick, and confirm it.
3. Commissioner: open Manage League and show settings/member controls.
4. Open Account to demonstrate notification controls and account deletion.
5. Explain that camera and microphone are requested only when a commissioner starts the optional live-broadcast feature.
6. Confirm whether paid pools are disabled for review. If enabled, provide rules, eligibility, payment, prize, and jurisdiction details.

## Privacy declaration working sheet

Store answers must match actual production behavior and every enabled third-party service. Recheck these immediately before submission.

| Data or permission | Purpose | Linked to user | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Email address and auth ID | Account management, security | Yes | No | Supabase Auth |
| Display name and username | App functionality, league identity | Yes | No | Visible to relevant league members |
| League memberships, entries, and picks | Core app functionality | Yes | No | Includes standings and results |
| Notification token and preferences | App functionality | Yes | No | Optional; APNs/FCM or web push |
| Camera and microphone | Optional live broadcast | During use | No | Permission requested only for broadcasting |
| Payment/prize verification records | Pool administration and fraud/security | Yes | No | Confirm exact launch behavior before filing |
| Diagnostics and usage data | Not declared yet | TBD | No | Add only if analytics/crash SDKs are enabled |

Current intended answers: no advertising, no cross-app tracking, no sale of personal data, and no precise-location collection. Verify network calls and SDK configuration before submitting Apple Privacy Details and Google Data Safety.

The public privacy policy must name the legal operator, monitored privacy/support email, retention practices, subprocessors, and launch regions before review. Account deletion is available in the app, but league owners must first delete or transfer leagues they own to protect other members.

## Screenshot plan

Capture production-like sample data with no real names, emails, access codes, payment details, or other private information. Keep the same league and visual story across both platforms.

1. Home/dashboard — “All your pools in one place”
2. Pool overview — “Make every week count”
3. Pick screen with week selector — “Fast, focused picks”
4. Confirmed pick state — “Know your pick is locked”
5. Standings — “Follow the race live”
6. Commissioner tools — “Run your league with confidence”
7. Alerts/account — “Never miss a deadline”

For Apple, capture the largest required iPhone display size in App Store Connect and let Apple scale it for smaller classes when allowed. Keep an additional iPad set only if the iPad destination remains enabled. For Google Play, capture portrait phone screenshots at a consistent high-resolution 9:16 size such as 1080×1920 and prepare a 1024×500 feature graphic.

## Submission blockers

- Create and verify both developer accounts.
- Choose the legal publisher name and monitored support/privacy email.
- Replace the hosted `server.url` shell with a store-safe bundled/native architecture.
- Configure APNs and Firebase Cloud Messaging, then implement and test native delivery.
- Produce a dedicated 1024×1024 master icon; the current native icon was generated from a 512×512 source.
- Complete real-device testing for auth, deep links, picks, broadcasts, deletion, safe areas, keyboard, interruption, and poor/offline network states.
- Resolve contest, payment, prize, age, geography, refund, and gambling-law requirements before enabling paid pools.
- Prepare demo accounts and privacy-safe sample leagues for reviewers and screenshots.
- Fill Apple Privacy Details and Google Data Safety from the final production build, not this draft alone.

## Release checklist

- [ ] `npm run check` passes
- [ ] `npm run mobile:sync` passes
- [ ] iOS archive passes in current Xcode
- [ ] Android release AAB targets API 36+
- [ ] No signing keys or service credentials appear in Git
- [ ] TestFlight and Play internal tests pass on real devices
- [ ] Store screenshots and listing text approved
- [ ] Privacy policy and support contact finalized
- [ ] Account deletion verified end to end
- [ ] Review accounts verified immediately before submission
- [ ] Paid-pool compliance decision documented
