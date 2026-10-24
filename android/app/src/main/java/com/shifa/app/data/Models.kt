package com.shifa.app.data

import com.google.gson.annotations.SerializedName

// ---------------------------------------------------------------------------
// Auth (Supabase GoTrue REST)
// ---------------------------------------------------------------------------

data class AuthResponse(
    @SerializedName("access_token") val accessToken: String? = null,
    @SerializedName("refresh_token") val refreshToken: String? = null,
    val user: SupabaseUser? = null,
)

data class SupabaseUser(
    val id: String,
    val email: String? = null,
)

data class SignUpRequest(
    val email: String,
    val password: String,
    val data: Map<String, String>? = null,
)

// ---------------------------------------------------------------------------
// Pharmacies
// ---------------------------------------------------------------------------

data class Pharmacy(
    val id: String,
    val name: String,
    val slug: String,
    val address: String,
    val city: String? = null,
    @SerializedName("postal_code") val postalCode: String? = null,
    @SerializedName("country_code") val countryCode: String? = null,
    val phone: String? = null,
    val website: String? = null,
    @SerializedName("verification_status") val verificationStatus: String? = null,
    @SerializedName("is_active") val isActive: Boolean = true,
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
)

data class RegisterPharmacyRequest(
    val name: String,
    val slug: String,
    val address: String,
    val city: String? = null,
    @SerializedName("postal_code") val postalCode: String? = null,
    @SerializedName("country_code") val countryCode: String? = null,
    val latitude: Double,
    val longitude: Double,
    val phone: String? = null,
    val website: String? = null,
    @SerializedName("verification_status") val verificationStatus: String = "pending",
    @SerializedName("is_active") val isActive: Boolean = true,
    @SerializedName("is_demo") val isDemo: Boolean = false,
    @SerializedName("opening_hours") val openingHours: List<OpeningHour>? = null,
)

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

data class Product(
    val id: String,
    @SerializedName("canonical_name") val canonicalName: String? = null,
    @SerializedName("brand_name") val brandName: String? = null,
    val strength: String? = null,
    @SerializedName("dosage_form") val dosageForm: String? = null,
)

data class ProductRef(
    val id: String? = null,
    @SerializedName("canonical_name") val canonicalName: String? = null,
    @SerializedName("brand_name") val brandName: String? = null,
    val strength: String? = null,
)

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

data class InventoryItem(
    val id: String,
    @SerializedName("product_id") val productId: String? = null,
    @SerializedName("availability_status") val availabilityStatus: String? = null,
    val quantity: Int? = null,
    val price: Double? = null,
    val currency: String? = null,
    @SerializedName("last_verified_at") val lastVerifiedAt: String? = null,
    val products: ProductRef? = null,
    val pharmacies: Pharmacy? = null,
)

data class UpsertInventoryRequest(
    @SerializedName("pharmacy_id") val pharmacyId: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("availability_status") val availabilityStatus: String = "AVAILABLE",
    val quantity: Int? = null,
    val price: Double? = null,
    val currency: String? = null,
)

data class UpdateInventoryRequest(
    @SerializedName("availability_status") val availabilityStatus: String,
)

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

data class PharmacyMember(
    val id: String,
    @SerializedName("pharmacy_id") val pharmacyId: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("membership_role") val membershipRole: String? = null,
    val pharmacies: Pharmacy? = null,
)

// ---------------------------------------------------------------------------
// Purchase requests (B2B)
// ---------------------------------------------------------------------------

data class PurchaseRequest(
    val id: String,
    @SerializedName("buyer_pharmacy_id") val buyerPharmacyId: String,
    @SerializedName("seller_pharmacy_id") val sellerPharmacyId: String,
    @SerializedName("product_id") val productId: String,
    val quantity: Int,
    val status: String? = null,
    val notes: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    val products: ProductRef? = null,
)

data class CreatePurchaseRequest(
    @SerializedName("buyer_pharmacy_id") val buyerPharmacyId: String,
    @SerializedName("seller_pharmacy_id") val sellerPharmacyId: String,
    @SerializedName("product_id") val productId: String,
    val quantity: Int,
    val status: String = "REQUESTED",
    val notes: String? = null,
)

data class UpdatePurchaseRequest(
    val status: String,
)

// ---------------------------------------------------------------------------
// RPC request bodies
// ---------------------------------------------------------------------------

data class SearchProductsBody(
    @SerializedName("search_term") val searchTerm: String,
    @SerializedName("include_demo") val includeDemo: Boolean = false,
    @SerializedName("result_limit") val resultLimit: Int = 20,
)

data class OpeningHour(
    val day: Int,
    val open: String,
    val close: String,
    val closed: Boolean = false,
)

data class NearbyPharmaciesBody(
    @SerializedName("search_lat") val searchLat: Double,
    @SerializedName("search_lng") val searchLng: Double,
    @SerializedName("radius_m") val radiusM: Int = 10000,
    @SerializedName("include_demo") val includeDemo: Boolean = false,
    @SerializedName("result_limit") val resultLimit: Int = 10,
)
