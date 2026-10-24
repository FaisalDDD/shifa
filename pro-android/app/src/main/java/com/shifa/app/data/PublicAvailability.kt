package com.shifa.app.data

import com.google.gson.annotations.SerializedName

data class ProductAvailabilityBody(
    @SerializedName("p_product_id") val productId: String,
)

data class PublicAvailabilityItem(
    val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("availability_status") val availabilityStatus: String? = null,
    val price: Double? = null,
    val currency: String? = null,
    @SerializedName("last_verified_at") val lastVerifiedAt: String? = null,
    @SerializedName("pharmacy_id") val pharmacyId: String,
    @SerializedName("pharmacy_name") val pharmacyName: String,
    @SerializedName("pharmacy_slug") val pharmacySlug: String,
    @SerializedName("pharmacy_address") val pharmacyAddress: String,
    @SerializedName("pharmacy_city") val pharmacyCity: String? = null,
    @SerializedName("pharmacy_phone") val pharmacyPhone: String? = null,
    @SerializedName("pharmacy_latitude") val pharmacyLatitude: Double = 0.0,
    @SerializedName("pharmacy_longitude") val pharmacyLongitude: Double = 0.0,
    @SerializedName("pharmacy_verification_status") val pharmacyVerificationStatus: String? = null,
    @SerializedName("pharmacy_is_active") val pharmacyIsActive: Boolean = true,
)
