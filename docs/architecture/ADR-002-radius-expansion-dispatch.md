# ADR-002: Radius Expansion Dispatch Algorithm

**Status:** Accepted

**Context:**
Saat order baru dibuat, sistem harus memilih driver yang tepat. Dua pendekatan utama: broadcast semua driver vs mencari incremental.

**Opsi yang dipertimbangkan:**

1. **Broadcast ke semua driver** — Notifikasi dikirim ke semua driver online, siapa cepat dia dapat
2. **Radius Expansion** — Cari driver dalam radius kecil (3km), expand bertahap (2km tiap 60 detik)

**Decision:**
Gunakan **Radius Expansion Algorithm**:

- Mulai dari radius kecil (2-4km tergantung service type)
- Sortir kandidat berdasarkan rating/distance/lastJobAt
- Offer ke satu driver terbaik dulu
- Jika ditolak/timeout, tawarkan ke driver terbaik berikutnya
- Jika semua driver di radius habis, expand radius + area

Konfigurasi per service type:

| Service      | Initial Radius | Max Radius | Offer Timeout |
| ------------ | -------------- | ---------- | ------------- |
| Food/Shop    | 2km            | 8km        | 45 detik      |
| Transport    | 3km            | 15km       | 60 detik      |
| Send/Express | 3-4km          | 15-20km    | 60 detik      |

**Consequences:**

Positive:

- Driver tidak kewalahan dengan notifikasi yang tidak relevan
- Fair distribution — driver dengan rating tinggi dan terdekat diprioritaskan
- Biaya FCM lebih hemat (kirim ke 1 driver per attempt, bukan broadcast)
- Pengguna dapat driver yang benar-benar dekat

Negative:

- Latency lebih tinggi di daerah sepi driver (perlu nunggu expansion)
- Kompleksitas state management (offer timeout, rejected list, expansion scheduling)
- Perlu scheduled function (`expansionTrigger`) tiap 1 menit untuk cleanup + expansion
