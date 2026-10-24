package com.shifa.app.data

import kotlinx.coroutines.runBlocking
import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class AuthRequestTest {
    @Test fun passwordGrantIsInUrlNotFormBody() = runBlocking {
        var captured: Request? = null
        // Terminal interceptor: no socket, DNS, localhost server or backend API calls.
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            captured = chain.request()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("Local fixture")
                .body("{}".toResponseBody("application/json".toMediaType())).build()
        }.build()
        val api = Retrofit.Builder().baseUrl("https://example.invalid/")
            .client(client).addConverterFactory(GsonConverterFactory.create()).build()
            .create(SupabaseAuthApi::class.java)
        api.signIn("password", "customer@example.invalid", "test-password")
        val request = requireNotNull(captured)
        assertEquals("/auth/v1/token", request.url.encodedPath)
        assertEquals("password", request.url.queryParameter("grant_type"))
        val form = request.body as FormBody
        assertEquals(listOf("email", "password"), (0 until form.size).map(form::name))
        assertEquals("customer@example.invalid", form.value(0))
        assertEquals("test-password", form.value(1))
    }
}
