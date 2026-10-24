package com.shifa.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.gson.Gson
import com.shifa.app.BuildConfig
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/** In-memory session state (mirrors SessionStore's persisted copy). */
object Session {
    var accessToken: String? by mutableStateOf(null)
    var refreshToken: String? = null
    var userId: String? = null
    var email: String? = null
    var accountType: String = "customer"

    fun clear() {
        accessToken = null
        refreshToken = null
        userId = null
        email = null
        accountType = "customer"
    }
}

/** Persists the session across app restarts using SharedPreferences. */
object SessionStore {
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences("shifa_session", Context.MODE_PRIVATE)
        load()
    }

    fun load() {
        val p = prefs ?: return
        Session.accessToken = p.getString("access_token", null)
        Session.refreshToken = p.getString("refresh_token", null)
        Session.userId = p.getString("user_id", null)
        Session.email = p.getString("email", null)
        Session.accountType = p.getString("account_type", "customer") ?: "customer"
    }

    fun save() {
        val p = prefs ?: return
        p.edit()
            .putString("access_token", Session.accessToken)
            .putString("refresh_token", Session.refreshToken)
            .putString("user_id", Session.userId)
            .putString("email", Session.email)
            .putString("account_type", Session.accountType)
            .apply()
    }

    fun clear() {
        // Language and other preferences share this file; remove only auth data.
        prefs?.edit()
            ?.remove("access_token")
            ?.remove("refresh_token")
            ?.remove("user_id")
            ?.remove("email")
            ?.remove("account_type")
            ?.apply()
    }
}

object Client {
    private val gson = Gson()

    private val headerInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
        Session.accessToken?.let { request.header("Authorization", "Bearer $it") }
        chain.proceed(request.build())
    }

    // On a 401, try one token refresh (GoTrue refresh_token grant) and retry the
    // request once. On failure, drop the session; public discovery stays accessible.
    private val refreshInterceptor = Interceptor { chain ->
        val request = chain.request()
        val response = chain.proceed(request)
        if (response.code == 401 && !Session.refreshToken.isNullOrBlank()) {
            if (tryRefresh()) {
                response.close()
                val retry = request.newBuilder()
                    .header("Authorization", "Bearer ${Session.accessToken}")
                    .build()
                return@Interceptor chain.proceed(retry)
            } else {
                Session.clear()
                SessionStore.clear()
            }
        }
        response
    }

    private val refreshClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private fun tryRefresh(): Boolean {
        return try {
            val body = gson.toJson(
                mapOf("refresh_token" to Session.refreshToken),
            ).toRequestBody("application/json".toMediaType())
            val req = Request.Builder()
                .url(BuildConfig.SUPABASE_URL.trimEnd('/') + "/auth/v1/token?grant_type=refresh_token")
                .post(body)
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .build()
            refreshClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val parsed = gson.fromJson(resp.body?.string(), AuthResponse::class.java)
                    Session.accessToken = parsed.accessToken
                    parsed.refreshToken?.let { Session.refreshToken = it }
                    SessionStore.save()
                    true
                } else {
                    false
                }
            }
        } catch (_: Exception) {
            false
        }
    }

    private val http = OkHttpClient.Builder()
        .addInterceptor(headerInterceptor)
        .addInterceptor(refreshInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.SUPABASE_URL.trimEnd('/') + "/")
        .client(http)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val auth: SupabaseAuthApi = retrofit.create(SupabaseAuthApi::class.java)
    val rest: SupabaseRestApi = retrofit.create(SupabaseRestApi::class.java)
}
