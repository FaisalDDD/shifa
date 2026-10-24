package com.shifa.app.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface SupabaseAuthApi {
    @FormUrlEncoded
    @POST("auth/v1/token")
    suspend fun signIn(
        @Query("grant_type") grantType: String,
        @Field("email") email: String,
        @Field("password") password: String,
    ): AuthResponse

    @POST("auth/v1/signup")
    suspend fun signUp(@Body body: SignUpRequest): AuthResponse
}

interface SupabaseRestApi {
    // ---- pharmacies (PostgREST) ----

    @GET("rest/v1/pharmacies")
    suspend fun pharmacies(
        @Query("select") select: String = "*",
        @Query("is_active") isActive: String = "eq.true",
        @Query("order") order: String = "name.asc",
        @Query("limit") limit: Int = 100,
    ): List<Pharmacy>

    @GET("rest/v1/pharmacies")
    suspend fun searchPharmacies(
        @Query("select") select: String = "*",
        @Query("is_active") isActive: String = "eq.true",
        @Query("name") name: String,
        @Query("order") order: String = "name.asc",
        @Query("limit") limit: Int = 100,
    ): List<Pharmacy>

    @POST("rest/v1/pharmacies")
    suspend fun registerPharmacy(@Body body: RegisterPharmacyRequest): Response<Unit>

    // ---- memberships ----

    @GET("rest/v1/pharmacy_members")
    suspend fun memberships(
        @Query("select") select: String = "*,pharmacies(*)",
        @Query("user_id") userId: String,
    ): List<PharmacyMember>

    // ---- inventory (public availability only; stock management lives in Shifa Pro) ----

    @POST("rest/v1/rpc/product_availability_public")
    suspend fun inventoryByProducts(@Body body: ProductAvailabilityBody): List<PublicAvailabilityItem>

    // ---- product search (RPC) ----

    @POST("rest/v1/rpc/search_products")
    suspend fun searchProducts(@Body body: SearchProductsBody): List<Product>

    @GET("rest/v1/products")
    suspend fun suggestedProducts(
        @Query("select") select: String = "id,canonical_name,brand_name,strength,dosage_form",
        @Query("order") order: String = "canonical_name.asc",
        @Query("limit") limit: Int = 10,
    ): List<Product>

    @POST("rest/v1/rpc/nearby_pharmacies")
    suspend fun nearbyPharmacies(@Body body: NearbyPharmaciesBody): List<Pharmacy>

    // Customer discovery only; pharmacy-to-pharmacy purchasing belongs in Shifa Pro.

    // ---- Shifa Pro (admin) ----

    @GET("rest/v1/products")
    suspend fun adminProducts(
        @Query("select") select: String = "product_identifier,canonical_name,description",
        @Query("order") order: String = "canonical_name.asc",
        @Query("limit") limit: Int = 1000,
    ): List<ProductAdmin>

    @GET("rest/v1/pharmacy_financial_events")
    suspend fun financialEvents(
        @Query("select") select: String = "event_type,created_at,payload",
        @Query("pharmacy_id") pharmacyId: String,
        @Query("order") order: String = "created_at.desc",
        @Query("limit") limit: Int = 100,
    ): List<FinancialEvent>

    @GET("rest/v1/pharmacy_staff_settings")
    suspend fun staff(
        @Query("select") select: String = "display_name,job_title,employee_code,weekly_target_hours",
        @Query("pharmacy_id") pharmacyId: String,
    ): List<StaffMember>

    @GET("rest/v1/pharmacy_inventory")
    suspend fun inventory(
        @Query("select") select: String = "quantity,availability_status,expires_at,products(canonical_name,product_identifier,description)",
        @Query("pharmacy_id") pharmacyId: String,
        @Query("limit") limit: Int = 500,
    ): List<InventoryItem>

    @GET("rest/v1/profiles")
    suspend fun profile(
        @Query("select") select: String = "role",
        @Query("id") id: String,
    ): List<Profile>
}
