# ADR-001: RTDB untuk Driver Presence

**Status:** Accepted

**Context:**
ARO DRIVE membutuhkan sistem real-time untuk melacak status online/offline driver dan lokasi mereka. Dua opsi utama: Firestore (yang sudah digunakan untuk data transaksional) atau Realtime Database (RTDB).

Firestore cocok untuk data dokumen kompleks (order, merchant, user), namun untuk presence/lokasi driver ada kendala:

- Firestore real-time listener mahal (setiap update lokasi driver = 1 read per listener per dokumen)
- Driver mengirim lokasi setiap 5-10 detik — dengan 1000 driver online, biaya read di Firestore sangat tinggi
- Latency Firestore untuk update data high-frequency lebih besar dari RTDB

**Decision:**
Gunakan **RTDB** untuk semua data real-time driver presence:

- Status online/offline
- Koordinat lokasi (lat, lng, heading, speed)
- Timestamp aktivitas terakhir
- todayOnlineMs (durasi online harian)
- Incoming order offer

Firestore tetap digunakan untuk data driver yang jarang berubah dan butuh query kompleks:

- Profil driver, rating, balance
- Riwayat order

Data digabung di layer repository (`DriverRepository`) dengan merge RTDB + Firestore.

**Consequences:**

Positive:

- Biaya real-time lebih murah (RTDB billing per bandwidth, bukan per read)
- Latency lebih rendah untuk update frekuensi tinggi
- Firestore query tetap optimal untuk data non-real-time

Negative:

- Kompleksitas tambahan: dua data source perlu di-merge di kode
- RTDB tidak support query multi-kriteria (filter + sort sekaligus)
- Inconsistency window kecil antara RTDB dan Firestore saat update
