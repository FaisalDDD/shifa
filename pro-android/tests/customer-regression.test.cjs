// Source guards, not device/UI behavioral tests. Run with node --test tests/*.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const src = p => read(`app/src/main/java/com/shifa/app/${p}`);

test('launch and logout stay in public customer discovery, without business routing', () => {
  const main = src('MainActivity.kt');
  assert.match(main, /mutableStateOf<Screen>\(Screen.CustomerHome\)/);
  assert.doesNotMatch(main, /Dashboard|PharmacySetup|memberships|accountType|resolving/);
  assert.match(main, /Screen.Auth -> AuthScreen/);
  assert.match(main, /onSignIn\s*=\s*\{\s*screen = Screen.Auth/);
  assert.match(main, /onAuthenticated\s*=\s*\{\s*screen = Screen.CustomerHome/);
  assert.match(main, /onBrowse\s*=\s*\{\s*screen = Screen.CustomerHome/);
  assert.match(main, /fun signOut\(\)\s*\{[\s\S]*?screen = Screen.CustomerHome/);
  assert.match(main, /BackHandler/);
});

test('optional auth offers only customer signup and a localized return to browsing', () => {
  const auth = src('ui/AuthScreen.kt');
  assert.doesNotMatch(auth, /FilterChip|accountType|registerBusinessTagline|strings.business/);
  assert.match(auth, /onBrowse/);
  assert.match(auth, /strings.continueBrowsing/);
  const search = src('ui/SearchScreen.kt');
  assert.match(search, /isSignedIn/);
  assert.match(search, /if \(isSignedIn\).*strings.signOut.*strings.signIn/);
});

test('public discovery loads even when location permission is denied', () => {
  const search = src('ui/SearchScreen.kt');
  assert.match(search, /RequestPermission\(\),\s*\)\s*\{\s*loadTopPharmacies\(\)\s*\}/);
  assert.match(search, /LaunchedEffect\(Unit\)\s*\{\s*loadTopPharmacies\(\)/);
  assert.doesNotMatch(search, /mutableStateOf\(strings.topPharmacies\)/);
});

test('refresh grant belongs in token URL, not JSON body', () => {
  const client = src('data/Client.kt');
  assert.match(client, /\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.doesNotMatch(client, /"grant_type" to "refresh_token"/);
});

test('customer stock distinguishes unknown from explicitly unavailable without inventing API fields', () => {
  const detail = src('ui/ProductPharmaciesScreen.kt');
  assert.match(detail, /when \(row.availabilityStatus\)/);
  assert.match(detail, /"AVAILABLE" -> strings.inStock/);
  assert.match(detail, /"OUT_OF_STOCK" -> strings.outOfStock/);
  assert.match(detail, /else -> strings.unknownAvailability/);
  const i18n = src('ui/I18n.kt');
  assert.match(i18n, /unknownAvailability = "Availability unknown"/);
  assert.match(i18n, /unknownAvailability = "التوفر غير معروف"/);
  assert.ok(!/low_stock|lowStock|stock_threshold/.test(src('data/Api.kt') + src('data/Models.kt')));
});

test('unconfigured maps shows localized fallback while external Maps remains available', () => {
  const detail = src('ui/PharmacyDetailScreen.kt');
  assert.match(detail, /if \(BuildConfig.MAPS_API_KEY.isNotBlank\(\)\)/);
  assert.match(detail, /Text\(strings.mapUnavailable/);
  assert.match(detail, /Text\(strings.openInMaps\)/);
});

test('maps configuration contains no literal credential fallback', () => {
  const gradle = read('app/build.gradle.kts');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(gradle), 'Do not commit literal Google credentials');
  assert.match(gradle, /gradleProperty\("MAPS_API_KEY"\)[\s\S]*?getOrElse\(""\)/);
  assert.match(read('.gitignore'), /!\/app\/build.gradle.kts/);
});
