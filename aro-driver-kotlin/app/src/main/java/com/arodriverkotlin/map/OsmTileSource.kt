package com.arodriverkotlin.map

import android.content.Context
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.XYTileSource

/**
 * FASE 3 — TileSource OSM gratis (mode tanpa billing GCP).
 *
 * Memakai CARTO dark_matter (cocok tema gelap aplikasi, free tier 75rb/bulan —
 * cukup untuk skala Blitar) agar tidak menghantam tile.openstreetmap.org
 * langsung (melanggar kebijakan pemakaian untuk app production).
 * Wajib tampilkan [COPYRIGHT_TEXT] di sudut peta (lisensi ODbL).
 */
object OsmTileSource {
    const val COPYRIGHT_TEXT = "© OpenStreetMap contributors © CARTO"

    private val CARTO_DARK_URLS = arrayOf(
        "https://a.basemaps.cartocdn.com/dark_all/",
        "https://b.basemaps.cartocdn.com/dark_all/",
        "https://c.basemaps.cartocdn.com/dark_all/",
        "https://d.basemaps.cartocdn.com/dark_all/",
    )

    // NOTE osmdroid >= 6.1: konstruktor tanpa resourceId
    // (name, zoomMin, zoomMax, tileSize, ending, baseUrls).
    val DARK = XYTileSource("CartoDark", 0, 20, 256, ".png", CARTO_DARK_URLS)

    private val OSM_STANDARD_URLS = arrayOf(
        "https://tile.openstreetmap.org/",
    )

    val STANDARD = XYTileSource("OSMStandard", 0, 20, 256, ".png", OSM_STANDARD_URLS)

    /**
     * Pilih tile source by name (diatur via Remote Config `map_tiles` tanpa
     * perlu update APK — berguna jika salah satu provider bermasalah).
     * Nilai: "carto_dark" (default) | "osm_standard".
     */
    fun forName(name: String) = when (name.trim().lowercase()) {
        "osm_standard", "standard", "mapnik" -> STANDARD
        else -> DARK
    }

    /** Wajib dipanggil sekali (mis. di MapScreen) sebelum MapView dipakai. */
    fun init(context: Context) {
        Configuration.getInstance().apply {
            // Kebijakan tile OSM mewajibkan User-Agent valid berisi identitas app.
            userAgentValue = context.packageName
        }
    }
}
