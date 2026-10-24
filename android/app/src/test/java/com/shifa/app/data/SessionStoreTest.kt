package com.shifa.app.data

import android.content.SharedPreferences
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.snapshots.SnapshotStateObserver
import java.lang.reflect.Proxy
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class SessionStoreTest {
    @After fun cleanup() {
        Session.clear()
        prefsField.set(SessionStore, null)
    }

    @Test fun clearingSessionRemovesCredentialsButPreservesLanguageAndOtherPreferences() {
        val values = mutableMapOf<String, String?>(
            "language" to "ar", "other_preference" to "keep",
            "access_token" to "old-access", "refresh_token" to "old-refresh",
            "user_id" to "old-id", "email" to "customer@example.invalid", "account_type" to "pharmacy",
        )
        val editor = Proxy.newProxyInstance(javaClass.classLoader, arrayOf(SharedPreferences.Editor::class.java)) { proxy, method, args ->
            when (method.name) {
                "clear" -> { values.clear(); proxy }
                "remove" -> { values.remove(args!![0]); proxy }
                "putString" -> { values[args!![0] as String] = args[1] as String?; proxy }
                "apply" -> null
                "commit" -> true
                else -> error("Unexpected editor call: ${method.name}")
            }
        } as SharedPreferences.Editor
        val prefs = Proxy.newProxyInstance(javaClass.classLoader, arrayOf(SharedPreferences::class.java)) { _, method, args ->
            when (method.name) {
                "edit" -> editor
                "getString" -> values[args!![0]] ?: args[1]
                else -> error("Unexpected preferences call: ${method.name}")
            }
        } as SharedPreferences
        prefsField.set(SessionStore, prefs)
        SessionStore.load()
        Session.clear()
        SessionStore.clear()
        SessionStore.load()
        assertEquals(mapOf("language" to "ar", "other_preference" to "keep"), values)
        assertNull(Session.accessToken)
        assertNull(Session.refreshToken)
        assertNull(Session.userId)
        assertNull(Session.email)
    }

    @Test fun tokenExpiryNotifiesComposeSoPublicHomeShowsSignInAgain() {
        Session.accessToken = "old-access"
        Snapshot.sendApplyNotifications()
        var invalidated = false
        val observer = SnapshotStateObserver { it() }
        observer.start()
        try {
            observer.observeReads(Unit, { invalidated = true }) { Session.accessToken }
            Session.clear()
            Snapshot.sendApplyNotifications()
            assertTrue("Session changes must invalidate the customer auth action", invalidated)
        } finally {
            observer.stop()
            observer.clear()
        }
    }

    companion object {
        private val prefsField = SessionStore::class.java.getDeclaredField("prefs").apply { isAccessible = true }
    }
}
