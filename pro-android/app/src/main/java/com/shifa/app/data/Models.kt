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

// ---------------------------------------------------------------------------
// Shifa Pro (admin) models
// ---------------------------------------------------------------------------

data class Profile(
    val id: String,
    val role: String? = null,
)

data class ProductAdmin(
    @SerializedName("product_identifier") val productIdentifier: String? = null,
    @SerializedName("canonical_name") val canonicalName: String? = null,
    val description: String? = null,
)

data class FinancialEvent(
    @SerializedName("event_type") val eventType: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    val payload: Map<String, Any?>? = null,
)

data class StaffMember(
    @SerializedName("display_name") val displayName: String? = null,
    @SerializedName("job_title") val jobTitle: String? = null,
    @SerializedName("employee_code") val employeeCode: String? = null,
    @SerializedName("weekly_target_hours") val weeklyTargetHours: Double? = null,
)

data class InventoryItem(
    val quantity: Int? = null,
    @SerializedName("availability_status") val availabilityStatus: String? = null,
    @SerializedName("expires_at") val expiresAt: String? = null,
    val products: ProductAdmin? = null,
)
