# Degens Sports Pools — Store Submission Plan

## Current release direction

The production app is a Next.js web app deployed on Vercel. It is already installable as a PWA on iPhone, iPad, and Android. The next release track is a native Capacitor shell around the same production web app so the app can be submitted to Apple App Store and Google Play without creating a second product.

Native-only work that must be tested before submission:

- camera, microphone, and screen sharing in the LiveKit broadcast room;
- sign-in, session persistence, and sign-out;
- pool selection, pick locking, and confirmation;
- standings and commissioner controls;
- prize draw flow and viewer access;
- external links, privacy, terms, and account deletion;
- iPhone safe areas, Android back navigation, keyboard behavior, and rotation.

## Native wrapper setup

Run locally after installing Node and the Capacitor CLI:

1. npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
2. npx cap init "Degens Sports Pools" "com.degens.sportspools" --web-dir=out
3. Configure the production Vercel URL as the Capacitor server URL for the first hosted-shell build, or export a fully static/native web bundle when the app is ready for that architecture.
4. npx cap add ios
5. npx cap add android
6. Open ios/App/App.xcworkspace in Xcode and android/ in Android Studio.
7. Set the production bundle identifier, signing accounts, app icons, launch screen, privacy strings, and release versions.
8. npx cap sync, then archive/upload each release.

The production app must remain usable in Safari/Chrome as well; the native wrapper is an additional distribution channel.

## Apple App Store information

- App name: Degens Sports Pools
- Subtitle: Survivor, Pick'em & Pool Picks
- Primary category: Sports
- Privacy Policy URL: https://degens-sports-pools-iota.vercel.app/privacy
- Account deletion URL: https://degens-sports-pools-iota.vercel.app/account/delete
- App purpose: manage sports pools, make picks, view standings, and watch commissioner-hosted draws/broadcasts
- Required review notes: provide a demo account, explain the commissioner/player roles, explain how a reviewer can join a sample pool, and explain that camera/microphone are used only for the optional live-broadcast feature

## Google Play information

- App name: Degens Sports Pools
- Category: Sports
- Privacy Policy URL: https://degens-sports-pools-iota.vercel.app/privacy
- Account deletion URL: https://degens-sports-pools-iota.vercel.app/account/delete
- Prepare a Data Safety declaration for account data, pool activity, device permissions, and optional camera/microphone use.
- Provide a reviewer account and a short test path for player and commissioner features.
- Complete the closed-test requirement if it applies to the selected Play Console account.

## Before submission

- Replace placeholder support/contact language with a monitored support email.
- Complete contest rules, prize terms, refund terms, and jurisdiction review for every paid pool.
- Confirm the legal entity, age requirements, and contest/gambling compliance for each launch region.
- Create App Store Connect and Play Console developer accounts.
- Generate final screenshots for current iPhone and Android phone sizes.
- Add production native projects and signing credentials outside the web repository secrets.
- Build, install, and test release candidates on real devices.
