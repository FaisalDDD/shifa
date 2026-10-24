"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "ar";

const messages = {
  en: {
    // --- navigation ---
    "nav.search": "Search",
    "nav.about": "About",
    "nav.help": "Help",
    "nav.dashboard": "Dashboard",
    "nav.pharmacy": "Pharmacy",
    "nav.signIn": "Sign in",
    "nav.signUp": "Sign up",
    "nav.signOut": "Sign out",

    // --- footer ---
    "footer.tagline": "Find your pharmacy. Know before you go.",
    "footer.disclaimer":
      "Reported availability is not a guarantee of stock — always call ahead.",
    "footer.product": "Product",
    "footer.forPharmacies": "For pharmacies",
    "footer.listPharmacy": "List your pharmacy",
    "footer.contact": "Contact us",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.copyright":
      "Shifa. Demonstration project. Legal pages are drafts pending review for the launch jurisdiction.",

    // --- auth ---
    "auth.signIn": "Sign in",
    "auth.signUp": "Sign up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.name": "Name",
    "auth.forgotPassword": "Forgot your password?",
    "auth.noAccount": "No account?",
    "auth.haveAccount": "Already have an account?",
    "auth.signingIn": "Signing in…",
    "auth.creatingAccount": "Creating account…",
    "auth.checkEmail":
      "Check your email to confirm your account, then sign in.",
    "auth.accountType": "Account type",
    "auth.customer": "Customer",
    "auth.business": "Pharmacy",
    "auth.passwordHint": "At least 8 characters.",
    "auth.goToSignIn": "Go to sign in",
    "auth.resetTitle": "Reset your password",
    "auth.resetSent":
      "If that email is registered, a password reset link has been sent.",
    "auth.sending": "Sending…",
    "auth.sendResetLink": "Send reset link",
    "auth.backToSignIn": "Back to sign in",
    "auth.signInFailed": "Sign-in failed",
    "auth.invalidLink": "Your sign-in link is invalid or has expired.",
    "auth.wentWrong": "Something went wrong during authentication.",
    "auth.tryAgain": "Try again",

    // --- common ---
    "common.loading": "Loading…",
    "common.error": "Something went wrong",
    "common.search": "Search",
    "common.call": "Call",
    "common.directions": "Directions",
    "common.cancel": "Cancel",
    "common.refresh": "Refresh",
    "common.add": "Add",
    "common.accept": "Accept",
    "common.reject": "Reject",

    // --- home ---
    "home.hero.title": "Find the medicine you need, near you.",
    "home.hero.subtitle":
      "Search nearby pharmacies, check reported availability, and contact the pharmacy before you travel.",
    "home.hero.searchPlaceholder":
      "Search a medicine, brand, or active ingredient…",
    "home.hero.searchButton": "Search",
    "home.hero.ariaSearch": "Search medicines",
    "home.hero.disclaimer":
      "Reported availability is not a guarantee of stock. Always call ahead.",
    "home.how.title": "How Shifa works",
    "home.how.search.title": "Search",
    "home.how.search.text":
      "Find medicines by name, brand, active ingredient, or barcode.",
    "home.how.locate.title": "Locate",
    "home.how.locate.text":
      "See nearby pharmacies on a map, with distance and opening hours.",
    "home.how.confirm.title": "Confirm",
    "home.how.confirm.text":
      "Check reported availability and its last verification time, then call or navigate.",
    "home.transparency.title": "Availability transparency",
    "home.transparency.body":
      "Shifa never invents stock. Every availability record shows its source and how recently it was verified, so you can tell the difference between a fresh report and one that may have changed.",
    "home.transparency.recent":
      "Recently confirmed available — updated within the last few hours.",
    "home.transparency.older":
      "Older reports show “last updated X hours ago” and ask you to call to confirm.",
    "home.transparency.unknown":
      "Unknown availability is clearly labeled — never presented as a guarantee.",
    "home.transparency.exampleLabel": "Example result",
    "home.transparency.exampleAvailable": "Recently confirmed available · 1.2 km",
    "home.transparency.exampleUpdated": "Updated 30 minutes ago",
    "home.pharmacies.title": "For pharmacies",
    "home.pharmacies.body":
      "List your pharmacy, keep stock information fresh, and accept reservation requests — all in one place.",
    "home.pharmacies.reach.title": "Reach customers who need you",
    "home.pharmacies.reach.body":
      "Manage your profile, opening hours, and reported stock from a simple dashboard. Fewer phone calls about items you don't carry, more customers arriving prepared.",
    "home.pharmacies.cta": "List your pharmacy",
    "home.faq.title": "Frequently asked questions",
    "home.faq.q1": "Is reported availability a guarantee?",
    "home.faq.a1":
      "No. Availability is reported by pharmacies or other sources and is always shown with its last verification time. Stock can change at any time — call ahead to confirm.",
    "home.faq.q2": "Does Shifa provide medical advice?",
    "home.faq.a2":
      "No. Shifa is a pharmacy discovery service. It does not diagnose conditions, recommend treatments, or substitute medicines.",
    "home.faq.q3": "How fresh is the stock information?",
    "home.faq.a3":
      "Each record shows when it was last updated or verified. Older reports are clearly marked so you know when information may have changed.",

    // --- about ---
    "about.title": "About Shifa",
    "about.intro":
      "Shifa helps people find nearby pharmacies, check reported availability, and contact a pharmacy before they travel.",
    "about.problem.title": "The problem",
    "about.problem.body":
      "Finding out whether a specific medicine is in stock often means calling several pharmacies. Shifa collects pharmacy-reported availability in one place, along with each report's verification time, so you can see at a glance which pharmacy to contact.",
    "about.not.title": "What Shifa is not",
    "about.not.body":
      "Shifa is a discovery service, not a medical service. It does not diagnose conditions, recommend treatments, or substitute medicines, and reported availability is never a guarantee that a pharmacy can dispense a product.",
    "about.transparency.title": "Availability transparency",
    "about.transparency.body":
      "Every availability record carries its source and last verification time. We clearly distinguish recently confirmed availability from older reports and unknown inventory, and we never fabricate stock information.",

    // --- help ---
    "help.title": "Help",
    "help.intro": "Common questions about using Shifa.",
    "help.q1": "How do I search for a medicine?",
    "help.a1":
      "Type a product name, brand, or active ingredient in the search bar. Optionally set your location to see nearby pharmacies and reported availability.",
    "help.q2": "What does “recently confirmed available” mean?",
    "help.a2":
      "A pharmacy reported the product as available within the last few hours. It is still not a guarantee — call ahead.",
    "help.q3": "Why is a pharmacy marked “availability unknown”?",
    "help.a3":
      "That pharmacy has not reported usable stock information for the product. You can still contact them directly.",
    "help.q4": "My location is not working. What can I do?",
    "help.a4":
      "If you deny location permission, use the “Set location” option on the search page and click the map to choose your location.",

    // --- contact ---
    "contact.title": "Contact Shifa",
    "contact.intro": "For support, feedback, or to list your pharmacy.",
    "contact.body":
      "This is a demonstration project. Configure your own contact channel (support email, contact form) before launch.",
    "contact.pharmacies.title": "For pharmacies",
    "contact.pharmacies.body":
      "To list your pharmacy and manage stock information, an administrator can create your pharmacy record and invite you as a pharmacy staff member. See the setup documentation for details.",

    // --- privacy ---
    "privacy.title": "Privacy Policy",
    "privacy.intro": "DRAFT — pending legal review for the launch jurisdiction.",
    "privacy.collect.title": "What we collect",
    "privacy.collect.body":
      "Shifa collects only what is needed to provide the service: account details (email, display name), optional saved favorites and searches, reservation requests, and the location you choose to share when finding nearby pharmacies.",
    "privacy.location.title": "Location",
    "privacy.location.body":
      "Location is optional and used only to find nearby pharmacies. We do not track continuous background location.",
    "privacy.health.title": "Health-related searches",
    "privacy.health.body":
      "Medicine searches are kept private to your account and are not exposed to pharmacies or used for advertising personalization.",
    "privacy.delete.title": "Deleting your data",
    "privacy.delete.body":
      "You can delete your account from the dashboard, which removes your personal data in line with applicable law.",

    // --- terms ---
    "terms.title": "Terms of Service",
    "terms.intro": "DRAFT — pending legal review for the launch jurisdiction.",
    "terms.nomedical.title": "No medical advice",
    "terms.nomedical.body":
      "Shifa is a pharmacy discovery service. It does not provide medical advice, diagnoses, or treatment recommendations.",
    "terms.guarantee.title": "Availability is not a guarantee",
    "terms.guarantee.body":
      "Reported stock availability is provided for convenience and may be out of date or incorrect. Always contact the pharmacy to confirm before travelling. A reservation request does not guarantee availability or dispensing.",
    "terms.prescription.title": "Prescription medicines",
    "terms.prescription.body":
      "A reservation never replaces a legally required prescription or a pharmacist's assessment. Pharmacies must comply with applicable law when dispensing.",

    // --- not found ---
    "notFound.title": "Page not found",
    "notFound.body": "The page you were looking for does not exist or has moved.",
    "notFound.back": "Back to home",

    // --- search ---
    "search.placeholder": "Search a medicine, brand, or active ingredient…",
    "search.ariaSearch": "Search medicines",
    "search.toggleFilters": "Toggle filters",
    "search.map": "Map",
    "search.list": "List",
    "search.showMapView": "Show map view",
    "search.showListView": "Show list view",
    "search.strength": "Strength",
    "search.strengthPlaceholder": "e.g. 500 mg",
    "search.dosageForm": "Dosage form",
    "search.dosagePlaceholder": "e.g. tablet",
    "search.radius": "Radius (km)",
    "search.sortBy": "Sort by",
    "search.sort.relevance": "Relevance",
    "search.sort.distance": "Distance",
    "search.sort.freshness": "Verification freshness",
    "search.near": "Near {coords}",
    "search.clearLocation": "Clear location",
    "search.setLocation": "Set location",
    "search.searching": "Searching…",
    "search.pharmacyCount": "{count} pharmacies",
    "search.pharmacyCountOne": "1 pharmacy",
    "search.failed": "Search failed",
    "search.couldNotReach":
      "Could not reach the server. Check your connection and try again.",
    "search.empty.title": "Search for a medicine",
    "search.empty.desc":
      "Try a product name, brand, or active ingredient (e.g. “paracetamol”, “ibuprofen”).",
    "search.noResults.title": "No matching products",
    "search.noResults.desc":
      "Try a different spelling, an active-ingredient name, or widen your search radius.",
    "search.mapCaption":
      "Pharmacies near your location with reported stock for your search.",

    // --- product ---
    "product.dosageFormFallback": "Product",
    "product.prescription": "Prescription only",
    "product.prescriptionShort": "Prescription",
    "product.otc": "Over the counter",
    "product.notifyMe": "Notify me when back in stock",
    "product.notifyDone": "We'll notify you when it's back in stock.",
    "product.notifySignIn": "Sign in to get notified",
    "product.activeIngredients": "Active ingredient(s)",
    "product.productIdentifier": "Product identifier",
    "product.barcode": "Barcode",
    "product.disclaimer":
      "Shifa provides pharmacy discovery only. It does not diagnose conditions, recommend treatments, or substitute medicines. Always follow your prescriber's or pharmacist's advice.",
    "product.nearbyAvailability": "Nearby availability",
    "product.nearbyIntro":
      "Reported stock and its last verification time for pharmacies near you.",
    "product.noLocation": "Set a location to see availability",
    "product.nearest": "Nearest: {dist}",
    "product.pharmacyReporting": "1 pharmacy reporting",
    "product.pharmaciesReporting": "{count} pharmacies reporting",
    "product.pharmacyCountNone": "No pharmacies have reported this product yet",
    "product.pharmacyCountOne": "1 pharmacy has this product",
    "product.pharmacyCount": "{count} pharmacies have this product",

    // --- pharmacy detail ---
    "pharmacy.notListed":
      "This pharmacy is currently not listed in search results.",
    "pharmacy.verified": "Verified",
    "pharmacy.pendingVerification": "Pending verification",
    "pharmacy.openNow": "Open now",
    "pharmacy.closed": "Closed",
    "pharmacy.away": "{dist} away",
    "pharmacy.openingHours": "Opening hours",
    "pharmacy.today": "Today",
    "pharmacy.closedToday": "Closed today",
    "pharmacy.hoursUnavailable": "Opening hours not available.",
    "pharmacy.closedDay": "Closed",
    "pharmacy.services": "Services",
    "pharmacy.reportedStock": "Reported stock",
    "pharmacy.noStockReported":
      "This pharmacy has not reported stock information.",
    "pharmacy.stockDisclaimer":
      "Reported availability is not a guarantee of stock. Call to confirm.",
    "pharmacy.notAvailable": "This pharmacy is currently not available.",
    "pharmacy.openDirections": "Open directions to {name}",

    // --- day names ---
    "days.0": "Sunday",
    "days.1": "Monday",
    "days.2": "Tuesday",
    "days.3": "Wednesday",
    "days.4": "Thursday",
    "days.5": "Friday",
    "days.6": "Saturday",

    // --- stock ---
    "stock.unknown": "Availability unknown",
    "stock.inStock": "In stock",
    "stock.lowStock": "Low stock",
    "stock.outOfStock": "Out of stock",
    "stock.low.recent": "Recently confirmed low stock",
    "stock.low.older": "Pharmacy-reported low stock",
    "stock.low.stale": "Reported low stock — may have changed",
    "stock.available.recent": "Recently confirmed available",
    "stock.available.older": "Pharmacy-reported available",
    "stock.available.stale": "Reported available — may have changed",
    "stock.out.recent": "Reported out of stock",
    "stock.out.stale": "Reported out of stock — may have changed",
    "stock.callToConfirm": "Call to confirm",
    "stock.hint.none": "No usable stock information",
    "stock.hint.recently": "Recently updated",
    "stock.hint.notVerified": "Not recently verified",
    "stock.hint.updated": "Updated {age}",
    "stock.hint.lastUpdated": "Last updated {age}",
    "stock.hint.lastVerified": "Last verified {age}",

    // --- map ---
    "map.unavailable":
      "Map tiles are not configured. Set NEXT_PUBLIC_MAP_TILE_URL to a licensed provider (e.g. MapTiler) to enable the map view.",
    "map.pharmacies": "{count} pharmacies",

    // --- availability panel ---
    "avail.setLocationPrompt":
      "Set your location to see nearby pharmacies that carry this product.",
    "avail.useMyLocation": "Use my location",
    "avail.finding": "Finding nearby pharmacies…",
    "avail.loadError": "Could not load availability",
    "avail.loadErrorMsg": "Could not load availability. Try again.",
    "avail.empty.title": "No nearby pharmacies reporting this product",
    "avail.empty.desc":
      "This does not mean it is unavailable — call a nearby pharmacy to ask.",
    "avail.pendingVerification": "Pending verification",
    "avail.geoUnsupported": "Geolocation is not supported by this browser.",
    "avail.requesting": "Requesting location…",
    "avail.geoDenied":
      "Location permission denied. Enable location to see nearby pharmacies.",
    "avail.geoError": "Could not determine your location.",

    // --- location picker ---
    "lp.useMyLocation": "Use my location",
    "lp.geoUnsupported":
      "Geolocation is not supported by this browser. Click the map to set your location.",
    "lp.requesting": "Requesting location…",
    "lp.geoDenied":
      "Location permission denied. Click the map to set your location instead.",
    "lp.geoError":
      "Could not determine location. Click the map to set your location.",
    "lp.mapUnavailable":
      "Map unavailable — click “Use my location” or set coordinates.",
    "lp.selected": "Selected: {coords}",

    // --- dashboard ---
    "dash.title": "Your dashboard",
    "dash.signedInAs": "Signed in as {user}",
    "dash.find.title": "Find a medicine",
    "dash.find.desc":
      "Search nearby pharmacies and check reported availability.",
    "dash.pharmacy.title": "Pharmacy dashboard",
    "dash.pharmacy.desc":
      "Manage inventory, find suppliers, and handle purchase requests.",
    "dash.register.title": "Register a pharmacy",
    "dash.register.desc": "List your pharmacy to sell and buy in bulk.",
    "dash.role": "Role",
    "dash.notifications": "Notifications",
    "dash.noNotifications": "No notifications yet.",

    // --- pharmacy dashboard ---
    "pd.yourPharmacy": "Your pharmacy",
    "pd.noPharmacyDesc":
      "You don't have a pharmacy yet. Register one to manage inventory and buy in bulk from other pharmacies.",
    "pd.registerCta": "Register your pharmacy",
    "pd.title": "Pharmacy dashboard",
    "pd.selectPharmacy": "Select pharmacy",
    "pd.tab.overview": "Overview",
    "pd.tab.inventory": "Inventory",
    "pd.tab.suppliers": "Find suppliers",
    "pd.tab.requests": "Purchase requests",
    "pd.verified": "Verified",
    "pd.pending": "Pending verification",
    "pd.viewPublic": "View public page",
    "pd.available": "Available",
    "pd.notAvailable": "Not available",
    "pd.setUnavailable": "Mark not available",
    "pd.setAvailable": "Mark available",
    "pd.searchProductPlaceholder":
      "Search a product to add to your inventory…",
    "pd.yourInventory": "Your inventory",
    "pd.searchInventory": "Search within your inventory…",
    "pd.noInventory.title": "No inventory yet",
    "pd.noInventory.desc": "Add products and report their availability.",
    "pd.inStock": "In stock",
    "pd.outOfStock": "Out of stock",
    "pd.searchSupplierPlaceholder":
      "Search a product to buy in bulk from another pharmacy…",
    "pd.findSuppliers": "Find suppliers",
    "pd.findSuppliersDesc":
      "Search a product to see which other pharmacies carry it.",
    "pd.noSuppliers": "No suppliers found",
    "pd.noOtherPharmacy": "No other pharmacy is reporting this product.",
    "pd.requestBulk": "Request bulk",
    "pd.quantityPrompt": "Quantity to request?",
    "pd.incomingTitle": "Incoming requests (you sell)",
    "pd.outgoingTitle": "Outgoing requests (you buy)",
    "pd.noIncoming": "No incoming requests",
    "pd.noOutgoing": "No outgoing requests",
    "pd.product": "Product",
    "pd.fromBuyer": "From buyer ({id}…)",
    "pd.toSeller": "To seller ({id}…)",

    // --- pharmacy register ---
    "pr.title": "Set up your pharmacy",
    "pr.introPending": "pending",
    "pr.introBefore": "Your listing starts as",
    "pr.introAfter":
      "and becomes visible after an administrator verifies it.",
    "pr.name": "Pharmacy name",
    "pr.address": "Address",
    "pr.city": "City",
    "pr.postalCode": "Postal code",
    "pr.latitude": "Latitude",
    "pr.longitude": "Longitude",
    "pr.phone": "Phone",
    "pr.website": "Website",
    "pr.submitting": "Submitting…",
    "pr.submit": "Submit for review",
    "pr.errorFallback": "Could not register your pharmacy.",

    // --- offline ---
    "offline.banner":
      "You are offline — some features may be unavailable.",

    // --- landing ---
    "landing.hero.overline": "Sudan's pharmacy finder",
    "landing.hero.titleA": "Find the medicine",
    "landing.hero.titleB": "you need, near you.",
    "landing.hero.subtitle":
      "Search nearby pharmacies, check reported availability, and know before you go.",
    "landing.hero.ctaPrimary": "Search medicines",
    "landing.hero.ctaSecondary": "See how it works",
    "landing.hero.scroll": "Scroll to explore",
    "landing.hero.badge": "Reported stock · Verified · Near you",
    "landing.marquee":
      "Reported availability · Verified pharmacies · Opening hours · Reservations · Directions · Fresh stock data",
    "landing.problem.eyebrow": "The problem",
    "landing.problem.title":
      "Finding a medicine shouldn't mean calling every pharmacy.",
    "landing.problem.body":
      "Pharmacies don't publish live stock. Patients call one by one, wait on hold, and still arrive unsure. Shifa turns that into a single search.",
    "landing.problem.point1": "See reported stock before you travel",
    "landing.problem.point2": "Know when it was last verified",
    "landing.problem.point3": "Call or navigate from one screen",
    "landing.how.eyebrow": "How it works",
    "landing.how.title": "Three steps. One search.",
    "landing.how.step1.title": "Search",
    "landing.how.step1.body": "Type a medicine, brand, or active ingredient.",
    "landing.how.step2.title": "Locate",
    "landing.how.step2.body":
      "See nearby pharmacies on a map with distance and hours.",
    "landing.how.step3.title": "Confirm",
    "landing.how.step3.body":
      "Check reported availability and its last verification time.",
    "landing.transparency.eyebrow": "Transparency",
    "landing.transparency.title": "We never invent stock.",
    "landing.transparency.body":
      "Shifa shows only what pharmacies report — in stock or out of stock. Reported availability is never a guarantee.",
    "landing.transparency.recent": "Recently confirmed available",
    "landing.transparency.recentHint": "Updated within the last few hours",
    "landing.transparency.older": "Older report",
    "landing.transparency.olderHint": "Shows last updated time — call to confirm",
    "landing.transparency.unknown": "Availability unknown",
    "landing.transparency.unknownHint": "Clearly labeled, never a guarantee",
    "landing.features.eyebrow": "Built for Sudan",
    "landing.features.title": "Everything you need, in one place.",
    "landing.features.map.title": "Pharmacy map",
    "landing.features.map.body": "Clustered map with distance and opening hours.",
    "landing.features.stock.title": "Live stock reports",
    "landing.features.stock.body": "Reported availability with freshness states.",
    "landing.features.call.title": "Call & navigate",
    "landing.features.call.body": "One tap to call or get directions.",
    "landing.features.reserve.title": "Reservations",
    "landing.features.reserve.body": "Request a medicine hold before you arrive.",
    "landing.download.eyebrow": "Get the app",
    "landing.download.title": "Shifa, in your pocket.",
    "landing.download.body":
      "Download the Android app for the fastest way to find pharmacies and check reported stock.",
    "landing.download.cta": "Download for Android",
    "landing.download.note": "APK · Android",
    "landing.download.web": "or use the web app",
    "landing.download.ios": "iOS — coming soon",
    "landing.download.pro.cta": "Download Shifa Pro",
    "landing.download.pro.note": "APK · Android · pharmacy admins",
    "landing.download.pro.for": "For pharmacies",
    "landing.download.pro.desc": "Financial, employees and stock dashboards — for pharmacy admins only.",
  },
  ar: {
    "nav.search": "بحث",
    "nav.about": "حول",
    "nav.help": "مساعدة",
    "nav.dashboard": "لوحة التحكم",
    "nav.pharmacy": "الصيدلية",
    "nav.signIn": "تسجيل الدخول",
    "nav.signUp": "إنشاء حساب",
    "nav.signOut": "تسجيل الخروج",

    "footer.tagline": "ابحث عن صيدليتك. اعرف قبل أن تذهب.",
    "footer.disclaimer": "التوفر المُبلّغ ليس ضمانًا للمخزون — اتصل دائمًا قبل الذهاب.",
    "footer.product": "المنتج",
    "footer.forPharmacies": "للصيدليات",
    "footer.listPharmacy": "أدرج صيدليتك",
    "footer.contact": "اتصل بنا",
    "footer.legal": "قانوني",
    "footer.privacy": "الخصوصية",
    "footer.terms": "الشروط",
    "footer.copyright": "شفاء. مشروع تجريبي. الصفحات القانونية مسودات بانتظار المراجعة.",

    "auth.signIn": "تسجيل الدخول",
    "auth.signUp": "إنشاء حساب",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.name": "الاسم",
    "auth.forgotPassword": "نسيت كلمة المرور؟",
    "auth.noAccount": "لا تملك حسابًا؟",
    "auth.haveAccount": "لديك حساب بالفعل؟",
    "auth.signingIn": "جارٍ تسجيل الدخول…",
    "auth.creatingAccount": "جارٍ إنشاء الحساب…",
    "auth.checkEmail": "تحقق من بريدك الإلكتروني لتأكيد حسابك، ثم سجّل الدخول.",
    "auth.accountType": "نوع الحساب",
    "auth.customer": "عميل",
    "auth.business": "صيدلية",
    "auth.passwordHint": "8 أحرف على الأقل.",
    "auth.goToSignIn": "الانتقال إلى تسجيل الدخول",
    "auth.resetTitle": "إعادة تعيين كلمة المرور",
    "auth.resetSent": "إذا كان هذا البريد مسجلاً، فقد أُرسل رابط إعادة تعيين كلمة المرور.",
    "auth.sending": "جارٍ الإرسال…",
    "auth.sendResetLink": "إرسال رابط إعادة التعيين",
    "auth.backToSignIn": "العودة إلى تسجيل الدخول",
    "auth.signInFailed": "فشل تسجيل الدخول",
    "auth.invalidLink": "رابط تسجيل الدخول غير صالح أو انتهت صلاحيته.",
    "auth.wentWrong": "حدث خطأ أثناء المصادقة.",
    "auth.tryAgain": "حاول مرة أخرى",

    "common.loading": "جارٍ التحميل…",
    "common.error": "حدث خطأ ما",
    "common.search": "بحث",
    "common.call": "اتصال",
    "common.directions": "الاتجاهات",
    "common.cancel": "إلغاء",
    "common.refresh": "تحديث",
    "common.add": "إضافة",
    "common.accept": "قبول",
    "common.reject": "رفض",

    "home.hero.title": "ابحث عن الدواء الذي تحتاجه بالقرب منك.",
    "home.hero.subtitle":
      "ابحث في الصيدليات القريبة، وتحقق من التوفر المُبلّغ، واتصل بالصيدلية قبل أن تتحرك.",
    "home.hero.searchPlaceholder": "ابحث عن دواء أو علامة تجارية أو مادة فعّالة…",
    "home.hero.searchButton": "بحث",
    "home.hero.ariaSearch": "البحث عن الأدوية",
    "home.hero.disclaimer": "التوفر المُبلّغ ليس ضمانًا للمخزون. اتصل دائمًا قبل الذهاب.",

    "home.how.title": "كيف تعمل شفاء",
    "home.how.search.title": "بحث",
    "home.how.search.text":
      "اعثر على الأدوية بالاسم أو العلامة التجارية أو المادة الفعّالة أو الرمز الشريطي.",
    "home.how.locate.title": "تحديد الموقع",
    "home.how.locate.text":
      "شاهد الصيدليات القريبة على الخريطة مع المسافة وساعات العمل.",
    "home.how.confirm.title": "تأكيد",
    "home.how.confirm.text":
      "تحقق من التوفر المُبلّغ ووقت آخر تحقق، ثم اتصل أو اتجه إلى الصيدلية.",

    "home.transparency.title": "شفافية التوفر",
    "home.transparency.body":
      "لا تختلق شفاء المخزون أبدًا. يُظهر كل سجل توفر مصدره ومدى حداثة التحقق منه، لتتمكن من التمييز بين تقرير حديث وآخر ربما تغيّر.",
    "home.transparency.recent":
      "متوفر ومؤكد حديثًا — حُدّث خلال الساعات القليلة الماضية.",
    "home.transparency.older":
      "تُظهر التقارير الأقدم «آخر تحديث منذ X ساعة» وتطلب منك الاتصال للتأكيد.",
    "home.transparency.unknown":
      "يُشار بوضوح إلى التوفر غير المعروف — ولا يُقدَّم أبدًا كضمان.",
    "home.transparency.exampleLabel": "مثال على النتيجة",
    "home.transparency.exampleAvailable": "متوفر ومؤكد حديثًا · 1.2 كم",
    "home.transparency.exampleUpdated": "حُدّث منذ 30 دقيقة",

    "home.pharmacies.title": "للصيدليات",
    "home.pharmacies.body":
      "أدرج صيدليتك، وحافظ على تحديث معلومات المخزون، واستقبل طلبات الحجز — كل ذلك في مكان واحد.",
    "home.pharmacies.reach.title": "تواصل مع العملاء الذين يحتاجون إليك",
    "home.pharmacies.reach.body":
      "أدر ملفك الشخصي وساعات العمل والمخزون المُبلّغ من لوحة تحكم بسيطة. مكالمات أقل بشأن منتجات لا توفرها، وعملاء أكثر يصلون وهم مستعدون.",
    "home.pharmacies.cta": "أدرج صيدليتك",

    "home.faq.title": "الأسئلة الشائعة",
    "home.faq.q1": "هل التوفر المُبلّغ ضمان؟",
    "home.faq.a1":
      "لا. يُبلّغ التوفر من الصيدليات أو مصادر أخرى ويُعرض دائمًا مع وقت آخر تحقق. قد يتغير المخزون في أي وقت — اتصل للتأكيد.",
    "home.faq.q2": "هل تقدم شفاء استشارات طبية؟",
    "home.faq.a2":
      "لا. شفاء خدمة للعثور على الصيدليات. لا تشخّص الحالات ولا توصي بعلاجات ولا تستبدل الأدوية.",
    "home.faq.q3": "ما مدى حداثة معلومات المخزون؟",
    "home.faq.a3":
      "يُظهر كل سجل وقت آخر تحديث أو تحقق. تُعلَّم التقارير الأقدم بوضوح لتعرف متى قد تكون المعلومات قد تغيّرت.",

    "about.title": "حول شفاء",
    "about.intro":
      "تساعد شفاء الأشخاص في العثور على الصيدليات القريبة والتحقق من التوفر المُبلّغ والاتصال بالصيدلية قبل التنقل.",
    "about.problem.title": "المشكلة",
    "about.problem.body":
      "معرفة ما إذا كان دواء معين متوفرًا غالبًا ما تتطلب الاتصال بعدة صيدليات. تجمع شفاء التوفر المُبلّغ من الصيدليات في مكان واحد مع وقت التحقق من كل بلاغ، لترى في لمحة أي صيدلية يجب الاتصال بها.",
    "about.not.title": "ما ليست عليه شفاء",
    "about.not.body":
      "شفاء خدمة اكتشاف وليست خدمة طبية. لا تشخّص الحالات ولا توصي بعلاجات ولا تستبدل الأدوية، والتوفر المُبلّغ ليس أبدًا ضمانًا بأن الصيدلية يمكنها صرف المنتج.",
    "about.transparency.title": "شفافية التوفر",
    "about.transparency.body":
      "يحمل كل سجل توفر مصدره ووقت آخر تحقق. نميّز بوضوح بين التوفر المؤكد حديثًا والتقارير الأقدم والمخزون غير المعروف، ولا نختلق معلومات المخزون أبدًا.",

    "help.title": "مساعدة",
    "help.intro": "أسئلة شائعة حول استخدام شفاء.",
    "help.q1": "كيف أبحث عن دواء؟",
    "help.a1":
      "اكتب اسم المنتج أو العلامة التجارية أو المادة الفعّالة في شريط البحث. يمكنك اختياريًا تحديد موقعك لرؤية الصيدليات القريبة والتوفر المُبلّغ.",
    "help.q2": "ماذا يعني «متوفر ومؤكد حديثًا»؟",
    "help.a2":
      "أبلغت صيدلية عن توفر المنتج خلال الساعات القليلة الماضية. هذا لا يزال غير مضمون — اتصل مسبقًا.",
    "help.q3": "لماذا تُعلَّم صيدلية بـ«التوفر غير معروف»؟",
    "help.a3":
      "لم تُبلغ تلك الصيدلية بمعلومات مخزون صالحة لهذا المنتج. لا يزال بإمكانك الاتصال بها مباشرة.",
    "help.q4": "موقعي لا يعمل. ماذا يمكنني أن أفعل؟",
    "help.a4":
      "إذا رفضت إذن الموقع، استخدم خيار «تحديد الموقع» في صفحة البحث وانقر على الخريطة لاختيار موقعك.",

    "contact.title": "اتصل بشفاء",
    "contact.intro": "للدعم أو الملاحظات أو لإدراج صيدليتك.",
    "contact.body":
      "هذا مشروع تجريبي. قم بإعداد قناة الاتصال الخاصة بك (بريد الدعم أو نموذج الاتصال) قبل الإطلاق.",
    "contact.pharmacies.title": "للصيدليات",
    "contact.pharmacies.body":
      "لإدراج صيدليتك وإدارة معلومات المخزون، يمكن للمسؤول إنشاء سجل صيدليتك ودعوتك كموظف في الصيدلية. راجع وثائق الإعداد للتفاصيل.",

    "privacy.title": "سياسة الخصوصية",
    "privacy.intro": "مسودة — بانتظار المراجعة القانونية لجهة الإطلاق.",
    "privacy.collect.title": "ما نجمعه",
    "privacy.collect.body":
      "تجمع شفاء فقط ما يلزم لتقديم الخدمة: تفاصيل الحساب (البريد الإلكتروني واسم العرض) والمفضلات وعمليات البحث المحفوظة الاختيارية وطلبات الحجز والموقع الذي تختار مشاركته عند البحث عن الصيدليات القريبة.",
    "privacy.location.title": "الموقع",
    "privacy.location.body":
      "الموقع اختياري ويُستخدم فقط للعثور على الصيدليات القريبة. لا نتتبع الموقع في الخلفية بشكل مستمر.",
    "privacy.health.title": "عمليات البحث المتعلقة بالصحة",
    "privacy.health.body":
      "تبقى عمليات البحث عن الأدوية خاصة بحسابك ولا تُعرض على الصيدليات ولا تُستخدم لتخصيص الإعلانات.",
    "privacy.delete.title": "حذف بياناتك",
    "privacy.delete.body":
      "يمكنك حذف حسابك من لوحة التحكم، مما يزيل بياناتك الشخصية وفقًا للقانون المعمول به.",

    "terms.title": "شروط الخدمة",
    "terms.intro": "مسودة — بانتظار المراجعة القانونية لجهة الإطلاق.",
    "terms.nomedical.title": "لا استشارات طبية",
    "terms.nomedical.body":
      "شفاء خدمة للعثور على الصيدليات. لا تقدم استشارات طبية أو تشخيصات أو توصيات علاجية.",
    "terms.guarantee.title": "التوفر ليس ضمانًا",
    "terms.guarantee.body":
      "يُقدَّم التوفر المُبلّغ للمخزون للراحة وقد يكون قديمًا أو غير صحيح. اتصل دائمًا بالصيدلية للتأكيد قبل التنقل. طلب الحجز لا يضمن التوفر أو الصرف.",
    "terms.prescription.title": "الأدوية التي تستلزم وصفة",
    "terms.prescription.body":
      "لا يحل الحجز أبدًا محل الوصفة الطبية المطلوبة قانونًا أو تقييم الصيدلي. يجب أن تلتزم الصيدليات بالقانون المعمول به عند الصرف.",

    "notFound.title": "الصفحة غير موجودة",
    "notFound.body": "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    "notFound.back": "العودة إلى الرئيسية",

    "search.placeholder": "ابحث عن دواء أو علامة تجارية أو مادة فعّالة…",
    "search.ariaSearch": "البحث عن الأدوية",
    "search.toggleFilters": "تبديل عوامل التصفية",
    "search.map": "الخريطة",
    "search.list": "القائمة",
    "search.showMapView": "عرض الخريطة",
    "search.showListView": "عرض القائمة",
    "search.strength": "التركيز",
    "search.strengthPlaceholder": "مثال: 500 مغ",
    "search.dosageForm": "الشكل الصيدلاني",
    "search.dosagePlaceholder": "مثال: أقراص",
    "search.radius": "نصف القطر (كم)",
    "search.sortBy": "ترتيب حسب",
    "search.sort.relevance": "الصلة",
    "search.sort.distance": "المسافة",
    "search.sort.freshness": "حداثة التحقق",
    "search.near": "بالقرب من {coords}",
    "search.clearLocation": "مسح الموقع",
    "search.setLocation": "تحديد الموقع",
    "search.searching": "جارٍ البحث…",
    "search.pharmacyCount": "{count} صيدليات",
    "search.pharmacyCountOne": "صيدلية واحدة",
    "search.failed": "فشل البحث",
    "search.couldNotReach": "تعذر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.",
    "search.empty.title": "ابحث عن دواء",
    "search.empty.desc":
      "جرّب اسم منتج أو علامة تجارية أو مادة فعّالة (مثل «باراسيتامول» أو «إيبوبروفين»).",
    "search.noResults.title": "لا توجد منتجات مطابقة",
    "search.noResults.desc":
      "جرّب تهجئة مختلفة أو اسم مادة فعّالة أو وسّع نطاق البحث.",
    "search.mapCaption":
      "الصيدليات القريبة من موقعك والتي لديها مخزون مُبلّغ لبحثك.",

    "product.dosageFormFallback": "منتج",
    "product.prescription": "بوصفة طبية فقط",
    "product.prescriptionShort": "بوصفة طبية",
    "product.otc": "دون وصفة طبية",
    "product.notifyMe": "أعلمني عند توفره",
    "product.notifyDone": "سنعلمك عندما يتوفر مرة أخرى.",
    "product.notifySignIn": "سجّل الدخول ليصلك التنبيه",
    "product.activeIngredients": "المادة (المواد) الفعّالة",
    "product.productIdentifier": "معرّف المنتج",
    "product.barcode": "الرمز الشريطي",
    "product.disclaimer":
      "تقدم شفاء خدمة العثور على الصيدليات فقط. لا تشخّص الحالات ولا توصي بعلاجات ولا تستبدل الأدوية. اتبع دائمًا نصيحة طبيبك أو الصيدلي.",
    "product.nearbyAvailability": "التوفر القريب",
    "product.nearbyIntro":
      "المخزون المُبلّغ ووقت آخر تحقق له للصيدليات القريبة منك.",
    "product.noLocation": "حدد موقعًا لرؤية التوفر",
    "product.nearest": "الأقرب: {dist}",
    "product.pharmacyReporting": "صيدلية واحدة تُبلغ",
    "product.pharmaciesReporting": "{count} صيدليات تُبلغ",
    "product.pharmacyCountNone": "لا توجد صيدليات أبلغت عن هذا المنتج بعد",
    "product.pharmacyCountOne": "صيدلية واحدة لديها هذا المنتج",
    "product.pharmacyCount": "{count} صيدليات لديها هذا المنتج",

    "pharmacy.notListed": "هذه الصيدلية غير مدرجة حاليًا في نتائج البحث.",
    "pharmacy.verified": "موثَّقة",
    "pharmacy.pendingVerification": "بانتظار التحقق",
    "pharmacy.openNow": "مفتوحة الآن",
    "pharmacy.closed": "مغلقة",
    "pharmacy.away": "على بعد {dist}",
    "pharmacy.openingHours": "ساعات العمل",
    "pharmacy.today": "اليوم",
    "pharmacy.closedToday": "مغلقة اليوم",
    "pharmacy.hoursUnavailable": "ساعات العمل غير متوفرة.",
    "pharmacy.closedDay": "مغلقة",
    "pharmacy.services": "الخدمات",
    "pharmacy.reportedStock": "المخزون المُبلّغ",
    "pharmacy.noStockReported": "لم تُبلغ هذه الصيدلية بمعلومات المخزون.",
    "pharmacy.stockDisclaimer": "التوفر المُبلّغ ليس ضمانًا للمخزون. اتصل للتأكيد.",
    "pharmacy.notAvailable": "هذه الصيدلية غير متاحة حاليًا.",
    "pharmacy.openDirections": "فتح الاتجاهات إلى {name}",

    "days.0": "الأحد",
    "days.1": "الاثنين",
    "days.2": "الثلاثاء",
    "days.3": "الأربعاء",
    "days.4": "الخميس",
    "days.5": "الجمعة",
    "days.6": "السبت",

    "stock.unknown": "التوفر غير معروف",
    "stock.inStock": "متوفر",
    "stock.lowStock": "مخزون منخفض",
    "stock.outOfStock": "غير متوفر",
    "stock.low.recent": "تم تأكيد انخفاض المخزون مؤخراً",
    "stock.low.older": "أفادت الصيدلية بانخفاض المخزون",
    "stock.low.stale": "أُفيد بانخفاض المخزون — قد يكون تغيّر",
    "stock.available.recent": "متوفر ومؤكد حديثًا",
    "stock.available.older": "متوفر حسب إبلاغ الصيدلية",
    "stock.available.stale": "مُبلّغ عنه متوفر — ربما تغيّر",
    "stock.out.recent": "مُبلّغ عنه غير متوفر",
    "stock.out.stale": "مُبلّغ عنه غير متوفر — ربما تغيّر",
    "stock.callToConfirm": "اتصل للتأكيد",
    "stock.hint.none": "لا توجد معلومات مخزون صالحة",
    "stock.hint.recently": "حُدّث مؤخرًا",
    "stock.hint.notVerified": "لم يُتحقق منه مؤخرًا",
    "stock.hint.updated": "حُدّث {age}",
    "stock.hint.lastUpdated": "آخر تحديث {age}",
    "stock.hint.lastVerified": "آخر تحقق {age}",

    "map.unavailable":
      "لم يتم إعداد مربعات الخريطة. عيّن NEXT_PUBLIC_MAP_TILE_URL لمزود مرخّص (مثل MapTiler) لتفعيل عرض الخريطة.",
    "map.pharmacies": "{count} صيدليات",

    "avail.setLocationPrompt":
      "حدد موقعك لرؤية الصيدليات القريبة التي توفر هذا المنتج.",
    "avail.useMyLocation": "استخدم موقعي",
    "avail.finding": "جارٍ البحث عن الصيدليات القريبة…",
    "avail.loadError": "تعذر تحميل التوفر",
    "avail.loadErrorMsg": "تعذر تحميل التوفر. حاول مرة أخرى.",
    "avail.empty.title": "لا توجد صيدليات قريبة تبلغ عن هذا المنتج",
    "avail.empty.desc": "هذا لا يعني أنه غير متوفر — اتصل بصيدلية قريبة للسؤال.",
    "avail.pendingVerification": "بانتظار التحقق",
    "avail.geoUnsupported": "تحديد الموقع الجغرافي غير مدعوم في هذا المتصفح.",
    "avail.requesting": "جارٍ طلب الموقع…",
    "avail.geoDenied": "تم رفض إذن الموقع. فعّل الموقع لرؤية الصيدليات القريبة.",
    "avail.geoError": "تعذر تحديد موقعك.",

    "lp.useMyLocation": "استخدم موقعي",
    "lp.geoUnsupported":
      "تحديد الموقع الجغرافي غير مدعوم في هذا المتصفح. انقر على الخريطة لتحديد موقعك.",
    "lp.requesting": "جارٍ طلب الموقع…",
    "lp.geoDenied": "تم رفض إذن الموقع. انقر على الخريطة لتحديد موقعك بدلاً من ذلك.",
    "lp.geoError": "تعذر تحديد الموقع. انقر على الخريطة لتحديد موقعك.",
    "lp.mapUnavailable": "الخريطة غير متاحة — انقر على «استخدم موقعي» أو عيّن الإحداثيات.",
    "lp.selected": "المحدد: {coords}",

    "dash.title": "لوحة التحكم الخاصة بك",
    "dash.signedInAs": "مسجّل الدخول باسم {user}",
    "dash.find.title": "ابحث عن دواء",
    "dash.find.desc": "ابحث في الصيدليات القريبة وتحقق من التوفر المُبلّغ.",
    "dash.pharmacy.title": "لوحة تحكم الصيدلية",
    "dash.pharmacy.desc": "أدر المخزون وابحث عن الموردين وتعامل مع طلبات الشراء.",
    "dash.register.title": "سجّل صيدلية",
    "dash.register.desc": "أدرج صيدليتك للبيع والشراء بالجملة.",
    "dash.role": "الدور",
    "dash.notifications": "الإشعارات",
    "dash.noNotifications": "لا توجد إشعارات بعد.",

    "pd.yourPharmacy": "صيدليتك",
    "pd.noPharmacyDesc":
      "ليس لديك صيدلية بعد. سجّل واحدة لإدارة المخزون والشراء بالجملة من صيدليات أخرى.",
    "pd.registerCta": "سجّل صيدليتك",
    "pd.title": "لوحة تحكم الصيدلية",
    "pd.selectPharmacy": "اختر صيدلية",
    "pd.tab.overview": "نظرة عامة",
    "pd.tab.inventory": "المخزون",
    "pd.tab.suppliers": "ابحث عن موردين",
    "pd.tab.requests": "طلبات الشراء",
    "pd.verified": "موثَّقة",
    "pd.pending": "بانتظار التحقق",
    "pd.viewPublic": "عرض الصفحة العامة",
    "pd.available": "متاحة",
    "pd.notAvailable": "غير متاحة",
    "pd.setUnavailable": "وضع علامة غير متاحة",
    "pd.setAvailable": "وضع علامة متاحة",
    "pd.searchProductPlaceholder": "ابحث عن منتج لإضافته إلى مخزونك…",
    "pd.yourInventory": "مخزونك",
    "pd.searchInventory": "ابحث داخل مخزونك…",
    "pd.noInventory.title": "لا يوجد مخزون بعد",
    "pd.noInventory.desc": "أضف منتجات وأبلغ عن توفرها.",
    "pd.inStock": "متوفر",
    "pd.outOfStock": "غير متوفر",
    "pd.searchSupplierPlaceholder":
      "ابحث عن منتج لشرائه بالجملة من صيدلية أخرى…",
    "pd.findSuppliers": "ابحث عن موردين",
    "pd.findSuppliersDesc": "ابحث عن منتج لمعرفة أي الصيدليات الأخرى توفره.",
    "pd.noSuppliers": "لم يتم العثور على موردين",
    "pd.noOtherPharmacy": "لا توجد صيدلية أخرى تبلغ عن هذا المنتج.",
    "pd.requestBulk": "طلب بالجملة",
    "pd.quantityPrompt": "الكمية المطلوبة؟",
    "pd.incomingTitle": "الطلبات الواردة (أنت تبيع)",
    "pd.outgoingTitle": "الطلبات الصادرة (أنت تشتري)",
    "pd.noIncoming": "لا توجد طلبات واردة",
    "pd.noOutgoing": "لا توجد طلبات صادرة",
    "pd.product": "منتج",
    "pd.fromBuyer": "من المشتري ({id}…)",
    "pd.toSeller": "إلى البائع ({id}…)",

    "pr.title": "أعد إعداد صيدليتك",
    "pr.introPending": "قيد المراجعة",
    "pr.introBefore": "تبدأ قائمتك كـ",
    "pr.introAfter": "وتصبح مرئية بعد أن يتحقق منها المسؤول.",
    "pr.name": "اسم الصيدلية",
    "pr.address": "العنوان",
    "pr.city": "المدينة",
    "pr.postalCode": "الرمز البريدي",
    "pr.latitude": "خط العرض",
    "pr.longitude": "خط الطول",
    "pr.phone": "الهاتف",
    "pr.website": "الموقع الإلكتروني",
    "pr.submitting": "جارٍ الإرسال…",
    "pr.submit": "إرسال للمراجعة",
    "pr.errorFallback": "تعذر تسجيل صيدليتك.",

    "offline.banner": "أنت غير متصل بالإنترنت — قد تكون بعض الميزات غير متاحة.",

    "landing.hero.overline": "صيدليتك في جيبك",
    "landing.hero.titleA": "القى دواك",
    "landing.hero.titleB": "قبل ما تتحرك",
    "landing.hero.subtitle":
      "ابحث في الصيدليات القريبة، و اتأكد من توفر الدواء",
    "landing.hero.ctaPrimary": "ابحث",
    "landing.hero.ctaSecondary": "شاهد كيف يعمل",
    "landing.hero.scroll": "مرّر للاستكشاف",
    "landing.hero.badge": "تحديث مباشر · موثّق · جمبك",
    "landing.marquee":
      "توفر مُبلّغ · صيدليات موثّقة · ساعات عمل · حجوزات · اتجاهات · بيانات مخزون حديثة",
    "landing.problem.eyebrow": "المشكلة",
    "landing.problem.title": "العثور على دواء يجب ألا يعني الاتصال بكل صيدلية.",
    "landing.problem.body":
      "الصيدليات لا تنشر مخزونها مباشرة. يتصل المرضى واحدة تلو الأخرى، ينتظرون على الخط، ثم يصلون غير متأكدين. تحوّل شفاء ذلك إلى بحث واحد.",
    "landing.problem.point1": "اطّلع على المخزون المُبلّغ قبل أن تتحرك",
    "landing.problem.point2": "اعرف متى تم التحقق منه آخر مرة",
    "landing.problem.point3": "اتصل أو اتجه من شاشة واحدة",
    "landing.how.eyebrow": "كيف يعمل",
    "landing.how.title": "ثلاث خطوات. بحث واحد.",
    "landing.how.step1.title": "بحث",
    "landing.how.step1.body": "اكتب اسم الدواء أو العلامة التجارية أو المادة الفعّالة.",
    "landing.how.step2.title": "تحديد الموقع",
    "landing.how.step2.body": "شاهد الصيدليات القريبة على الخريطة مع المسافة وساعات العمل.",
    "landing.how.step3.title": "تأكيد",
    "landing.how.step3.body": "تحقق من التوفر المُبلّغ ووقت آخر تحقق منه.",
    "landing.transparency.eyebrow": "الشفافية",
    "landing.transparency.title": "لا نختلق المخزون أبدًا.",
    "landing.transparency.body":
      "يعرض شفاء فقط ما تبلغه الصيدليات — متوفر أو غير متوفر. التوفر المُبلّغ ليس ضمانًا أبدًا.",
    "landing.transparency.recent": "متوفر ومؤكد حديثًا",
    "landing.transparency.recentHint": "حُدّث خلال الساعات القليلة الماضية",
    "landing.transparency.older": "تقرير أقدم",
    "landing.transparency.olderHint": "يعرض وقت آخر تحديث — اتصل للتأكيد",
    "landing.transparency.unknown": "التوفر غير معروف",
    "landing.transparency.unknownHint": "مُعلَّم بوضوح، وليس ضمانًا أبدًا",
    "landing.features.eyebrow": "مصمّم للسودان",
    "landing.features.title": "كل ما تحتاجه، في مكان واحد.",
    "landing.features.map.title": "خريطة الصيدليات",
    "landing.features.map.body": "خريطة مجمّعة مع المسافة وساعات العمل.",
    "landing.features.stock.title": "تقارير مخزون حيّة",
    "landing.features.stock.body": "توفر مُبلّغ مع حالات الحداثة.",
    "landing.features.call.title": "اتصال واتجاهات",
    "landing.features.call.body": "نقرة واحدة للاتصال أو الحصول على الاتجاهات.",
    "landing.features.reserve.title": "حجوزات",
    "landing.features.reserve.body": "اطلب حجز دواء قبل وصولك.",
    "landing.download.eyebrow": "احصل على التطبيق",
    "landing.download.title": "شفاء، في جيبك.",
    "landing.download.body":
      "حمّل تطبيق أندرويد لأسرع طريقة للعثور على الصيدليات والتحقق من المخزون المُبلّغ.",
    "landing.download.cta": "حمّل لنظام أندرويد",
    "landing.download.note": "APK · أندرويد",
    "landing.download.web": "أو استخدم نسخة الويب",
    "landing.download.ios": "iOS — قريباً",
    "landing.download.pro.cta": "حمّل شفاء برو",
    "landing.download.pro.note": "APK · أندرويد · مديرو الصيدليات",
    "landing.download.pro.for": "للصيدليات",
    "landing.download.pro.desc": "لوحات المالية والموظفين والمخزون — لمديري الصيدليات فقط.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];
type Params = Record<string, string | number>;

const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: (k: MessageKey, params?: Params) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    let initial: Language = "en";
    try {
      const stored = localStorage.getItem("shifa-lang");
      if (stored === "ar" || stored === "en") initial = stored;
      else if ((navigator.language || "").toLowerCase().startsWith("ar"))
        initial = "ar";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resolve language from device/localStorage after mount
    setLangState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  function setLang(l: Language) {
    setLangState(l);
    try {
      localStorage.setItem("shifa-lang", l);
    } catch {
      /* ignore */
    }
  }

  function t(k: MessageKey, params?: Params): string {
    let s: string = messages[lang][k] ?? messages.en[k];
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        s = s.replaceAll(`{${key}}`, String(value));
      }
    }
    return s;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Translate a single message key. Renders as a client component so it can be
 * used inside server components (about/help/terms pages, etc.).
 */
export function T({ k, params }: { k: MessageKey; params?: Params }) {
  const { t } = useLanguage();
  return <>{t(k, params)}</>;
}

/** Localized relative time, e.g. "3 hours ago" / "منذ 3 ساعات". */
export function relativeTimeLocalized(
  fromIso: string | Date,
  lang: Language,
  now: Date = new Date(),
): string {
  const diffMs = Math.max(0, now.getTime() - new Date(fromIso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  const ar = lang === "ar";
  if (minutes < 1) return ar ? "الآن" : "just now";
  if (minutes < 60)
    return ar
      ? `منذ ${minutes} دقيقة`
      : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return ar ? `منذ ${hours} ساعة` : `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)
    return ar ? `منذ ${days} يوم` : `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return ar
    ? `منذ ${months} شهر`
    : `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Localized distance, e.g. "500 m" / "1.2 km" / "٥٠٠ م" / "١٫٢ كم". */
export function distanceLocalized(
  m: number | null | undefined,
  lang: Language,
): string {
  if (m == null) return "";
  if (m < 1000)
    return lang === "ar" ? `${Math.round(m)} م` : `${Math.round(m)} m`;
  return lang === "ar"
    ? `${(m / 1000).toFixed(1)} كم`
    : `${(m / 1000).toFixed(1)} km`;
}
