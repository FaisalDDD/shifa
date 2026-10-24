package com.shifa.app.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/** Bounded customer discovery cache. Cached stock is never treated as current. */
object DiscoveryCache {
    private const val PREFS = "shifa_customer_discovery"
    private const val MAX_RECENT = 12
    private val gson = Gson()
    private var prefs: android.content.SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    fun saveSearch(query: String, products: List<Product>, pharmacies: List<Pharmacy>) {
        val key = query.trim().lowercase()
        if (key.isBlank()) return
        val current = recentQueries().filterNot { it == key }.toMutableList()
        current.add(0, key)
        val bounded = current.take(MAX_RECENT)
        prefs?.edit()
            ?.putString("search:$key:products", gson.toJson(products))
            ?.putString("search:$key:pharmacies", gson.toJson(pharmacies))
            ?.putString("recent", gson.toJson(bounded))
            ?.apply()
    }

    fun loadProducts(query: String): List<Product> = load("search:${query.trim().lowercase()}:products")
    fun loadPharmacies(query: String): List<Pharmacy> = load("search:${query.trim().lowercase()}:pharmacies")

    fun recentQueries(): List<String> {
        val raw = prefs?.getString("recent", null) ?: return emptyList()
        return runCatching { gson.fromJson<List<String>>(raw, object : TypeToken<List<String>>() {}.type) ?: emptyList() }.getOrDefault(emptyList())
    }

    fun savePharmacy(pharmacy: Pharmacy) {
        val saved = savedPharmacies().filterNot { it.id == pharmacy.id }.toMutableList()
        saved.add(0, pharmacy)
        prefs?.edit()?.putString("saved_pharmacies", gson.toJson(saved.take(MAX_RECENT)))?.apply()
    }

    fun removePharmacy(pharmacyId: String) {
        prefs?.edit()?.putString("saved_pharmacies", gson.toJson(savedPharmacies().filterNot { it.id == pharmacyId }))?.apply()
    }

    fun savedPharmacies(): List<Pharmacy> = load("saved_pharmacies")

    fun addShoppingItem(product: Product) {
        val items = shoppingList().filterNot { it.id == product.id }.toMutableList()
        items.add(0, product)
        prefs?.edit()?.putString("shopping_list", gson.toJson(items.take(50)))?.apply()
    }

    fun removeShoppingItem(productId: String) {
        prefs?.edit()?.putString("shopping_list", gson.toJson(shoppingList().filterNot { it.id == productId }))?.apply()
    }

    fun shoppingList(): List<Product> = load("shopping_list")

    private inline fun <reified T> load(key: String): List<T> {
        val raw = prefs?.getString(key, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<T>>(raw, object : TypeToken<List<T>>() {}.type) ?: emptyList() }.getOrDefault(emptyList())
    }
}
