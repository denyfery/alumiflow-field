# AlumiFlow Field 0.4 Release Configuration

## Build profiles

| Profile | App variant | API | Distribution |
| --- | --- | --- | --- |
| `development` | Development | `http://10.0.2.2:8000/api/mobile/v1` | Internal dev client |
| `preview` | Pilot | `https://app.alumiflow.com/api/mobile/v1` | Internal APK |
| `production` | Production | `https://app.alumiflow.com/api/mobile/v1` | Store build |

Commands:

```bash
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

## Release guard

`app.config.js` refuses Pilot/Production builds when:

- `EXPO_PUBLIC_API_BASE_URL` is missing;
- the API URL is not HTTPS;
- the API host is `localhost`, `127.0.0.1`, `0.0.0.0`, `10.0.2.2`, or `::1`;
- Production does not point exactly to `https://app.alumiflow.com/api/mobile/v1`.

This prevents a release build from accidentally shipping with the local development backend.

## Version

Field 0.4 Pilot Release Hardening starts at:

- Version: `0.4.0`
- Android `versionCode`: `10`
- iOS `buildNumber`: `10`

Bump the build number for every distributed binary.

## Branding status

The runtime names are now environment aware:

- Development: `AlumiFlow Field Dev`
- Pilot/Production: `AlumiFlow Field`

The current source archive does not contain final icon/adaptive-icon/splash assets, so release config intentionally does not reference missing image files. Add the approved final brand assets before Pilot APK freeze.

## Package identifiers and Firebase

The package identifiers remain `com.alumiflow.field` for this hardening pass because the current Firebase/FCM configuration has already been validated with that application id. Splitting Dev/Pilot/Production into separate application ids requires matching Firebase Android/iOS app registrations and corresponding service configuration files first.

## Branding assets

Field 0.4 uses the existing AlumiFlow teal identity (`#0F766E`) and the `ALF` mark that was already used by the web favicon.

Release assets:

- `assets/branding/icon.png` — pilot/production app icon.
- `assets/branding/icon-dev.png` — development icon with a visible `DEV` marker.
- `assets/branding/adaptive-icon.png` — Android adaptive foreground for pilot/production.
- `assets/branding/adaptive-icon-dev.png` — Android adaptive foreground for development.
- `assets/branding/adaptive-monochrome.png` — Android themed/monochrome icon.
- `assets/branding/splash-icon.png` — minimal launch mark on the Field background color.
- `assets/branding/notification-icon.png` — Android notification small-icon asset.

Development keeps the validated `com.alumiflow.field` application id for now, so FCM remains attached to the already-tested Firebase app. The app name and icon make development builds visually distinct, but development and pilot builds still cannot be installed side-by-side until a separate Firebase application id/config is provisioned.
