package com.shifa.app.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query

interface SupabaseAuthApi {
    @FormUrlEncoded
    @POST("auth/v1/token")
    suspend fun signIn(
        @Field("grant_type") grantType: String,
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

    // ---- inventory ----

    @GET("rest/v1/pharmacy_inventory")
    suspend fun inventoryForPharmacy(
        @Query("select") select: String = "id,product_id,availability_status,quantity,price,currency,last_verified_at,products(id,canonical_name,brand_name,strength)",
        @Query("pharmacy_id") pharmacyId: String,
        @Query("order") order: String = "last_updated_at.desc",
        @Query("limit") limit: Int = 200,
    ): List<InventoryItem>

    @POST("rest/v1/pharmacy_inventory")
    @Headers("Prefer: resolution=merge-duplicates")
    suspend fun upsertInventory(@Body body: UpsertInventoryRequest): Response<Unit>

    @PATCH("rest/v1/pharmacy_inventory")
    suspend fun updateInventory(
        @Query("id") id: String,
        @Body body: UpdateInventoryRequest,
    ): Response<Unit>

    @GET("rest/v1/pharmacy_inventory")
    suspend fun inventoryByProducts(
        @Query("select") select: String = "id,product_id,availability_status,quantity,pharmacies(id,name,slug,address,city,phone,latitude,longitude,verification_status,is_active),products(id,canonical_name,brand_name,strength)",
        @Query("product_id") productIdFilter: String,
        @Query("limit") limit: Int = 200,
    ): List<InventoryItem>

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

    // ---- purchase requests (B2B) ----

    @GET("rest/v1/purchase_requests")
    suspend fun purchaseRequests(
        @Query("select") select: String = "*,products(id,canonical_name,brand_name,strength)",
        @Query("seller_pharmacy_id") sellerPharmacyId: String? = null,
        @Query("buyer_pharmacy_id") buyerPharmacyId: String? = null,
        @Query("order") order: String = "created_at.desc",
        @Query("limit") limit: Int = 100,
    ): List<PurchaseRequest>

    @POST("rest/v1/purchase_requests")
    suspend fun createPurchaseRequest(@Body body: CreatePurchaseRequest): Response<Unit>

    @PATCH("rest/v1/purchase_requests")
    suspend fun updatePurchaseRequest(
        @Query("id") id: String,
        @Body body: UpdatePurchaseRequest,
    ): Response<Unit>
}
