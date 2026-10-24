# Shifa — Android app

Native Android client (Kotlin + Jetpack Compose) for the Shifa platform. It
shares the Supabase backend with the web app (`../`), so schema, auth and RLS
are the single source of truth — no duplicated business logic.

## Structure

```
android/
  app/src/main/java/com/shifa/app/
    MainActivity.kt          # entry point + screen navigation
    data/
      Models.kt              # DTOs (Pharmacy, AuthResponse, ...)
      Api.kt                 # Retrofit interfaces (Supabase Auth + PostgREST)
      Client.kt              # OkHttp/Retrofit setup + session holder
    ui/
      Theme.kt               # Shifa Material 3 theme
      AuthScreen.kt          # sign in / sign up (customer + pharmacy)
      PharmacyListScreen.kt  # pharmacy list
      PharmacyDetailScreen.kt# pharmacy details + reported stock
```

## Requirements

- Android Studio (or a JDK 17+ and the Android SDK)
- Android SDK platform 36, build-tools 36.x

## Configure the backend

The app talks to the same Supabase instance as the web app. Set these in
`gradle.properties`:

```
SUPABASE_URL=http://10.0.2.2:54321          # 10.0.2.2 = host loopback from emulator
SUPABASE_ANON_KEY=<your anon key>
```

For a physical device, replace `10.0.2.2` with your machine's LAN IP, or use
the production URL.

## Build

```bash
# from the android/ directory
./gradlew assembleDebug
# APK at: app/build/outputs/apk/debug/app-debug.apk
```

Or open `android/` in Android Studio and press Run (it uses the Gradle wrapper).

## Test on an emulator/device

1. Start the local Supabase stack (`supabase start` from the repo root).
2. Run the app in Android Studio, or `adb install app/build/outputs/apk/debug/app-debug.apk`.
3. Sign up / sign in (the app reaches the local backend via `10.0.2.2`).

## Current scope

- Sign in / sign up with a Customer / Business account-type choice.
- Session persisted in SharedPreferences with automatic GoTrue token refresh.
- Customer flow: pharmacy list + name search, pharmacy detail with reported
  stock and a Call action.
- Business flow: "set up your pharmacy" form (self-serve pending registration),
  then a dashboard with:
  - Inventory — search the global catalog to add products, filter your own
    inventory, set in-stock / out-of-stock.
  - Find suppliers — search a product to see which other pharmacies carry it,
    and send a bulk purchase request.
  - Requests — incoming (accept/reject) and outgoing (cancel) purchase requests.

## Building on this machine (Windows)

No JDK is on PATH. Use Android Studio's bundled JBR:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew assembleDebug
```

## Gotchas

- Product search goes through PostgREST's RPC endpoint:
  `POST /rest/v1/rpc/search_products` — the `/rest/v1` prefix is required.
- PostgREST INSERT (POST) returns the created row(s) as a JSON **array**, not
  a single object.
