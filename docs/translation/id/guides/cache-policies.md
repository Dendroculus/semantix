# Cache Policies

Semantix mengekspos perilaku cache secara eksplisit sehingga caller dapat mengevaluasi trade-off reuse, privasi, lifetime, isolasi, dan threshold.

## Semantic Lookup

Untuk sebuah read dengan cache diaktifkan:

1. normalizer yang telah dikonfigurasi menyiapkan matching text;
2. embedding provider membuat sebuah vektor;
3. `EmbeddingService` memvalidasi dimensions dan nilai finite, lalu menormalisasi vektor tersebut;
4. backend yang dipilih menghapus entri yang sudah expired;
5. backend mencari vektor yang kompatibel dalam namespace request;
6. respons terdekat hanya dikembalikan ketika cosine similarity-nya memenuhi threshold yang aktif.

Generation provider hanya menerima prompt asli pada saat cache miss. Prompt asli tetap disimpan dan ditampilkan meskipun normalisasi typo opsional mengubah matching text-nya.

## Similarity Threshold

`SIMILARITY_THRESHOLD` menetapkan nilai startup antara `0` dan `1`. Threshold aktif dapat dipratinjau (preview) di workspace Monitor dan diterapkan melalui cache threshold API.

- Threshold yang lebih tinggi mengurangi reuse dan umumnya menurunkan risiko false-positive.
- Threshold yang lebih rendah meningkatkan reuse dan umumnya menaikkan risiko false-positive.

Tidak ada nilai universal yang aman untuk semua model atau dataset. Gunakan workspace [Benchmark](benchmarking.md) yang terkontrol sebelum mengubah threshold untuk model embedding atau workload yang baru.

Similarity trace menempatkan kueri yang telah diberi skor pada domain cosine-similarity penuh dari `-1.0` hingga `1.0`. Posisi vertikal hanya berfungsi memisahkan titik yang saling tumpang tindih. Cache threshold tetap berada di antara `0.0` dan `1.0`, sehingga skor negatif selalu menjadi cache miss yang diproyeksikan. Mempratinjau sebuah threshold mengubah warna yang diproyeksikan; hal ini tidak mengubah keputusan backend hingga diterapkan.

## TTL dan LRU

`CACHE_TTL_SECONDS` mengontrol lifetime entri. Entri yang expired dihapus sebelum operasi cache dan hasil inspector.

`MAX_CACHE_SIZE` membatasi entri dalam embedding space yang aktif. Ketika insertion akan melampaui batas tersebut, entri yang paling lama tidak digunakan (least recently used) akan di-evict. Read akan memperbarui hit count dan recency.

Memory backend akan mereset seluruh entri dan counter saat proses-nya di-restart. pgvector backend menyimpan entri, counter, hit count, dan access time secara persisten. Lihat [pgvector](pgvector.md).

## Namespace

Setiap entri dan cache key dimiliki oleh satu namespace. Request tanpa namespace eksplisit menggunakan `default`. Lookup tidak pernah membandingkan entri lintas namespace.

Nilai namespace:

- berisi 1 hingga 64 karakter;
- mengizinkan huruf, angka, `.`, `_`, `:`, dan `-`.

Statistik dan pembersihan dapat menyasar satu namespace. Kapasitas tetap bersifat global terhadap embedding space yang aktif, sehingga write yang berat pada satu namespace dapat meng-evict entri LRU dari namespace lain.

## Kebijakan Read, Write, dan Private

Request kueri mendukung:

| Input | Efek |
|---|---|
| `cache_enabled=false` | Menonaktifkan read dan write |
| `cache_read_enabled=false` | Melewati (skip) lookup |
| `cache_write_enabled=false` | Tidak menyimpan output yang di-generate |
| `private=true` | Menonaktifkan read dan write |

`cache_enabled=false` menimpa (override) flag granular. `private=true` juga memaksa kedua operasi menjadi nonaktif. Semantix tidak mencoba melakukan deteksi secret otomatis; caller harus menandai prompt yang sensitif sebagai private.

Kombinasi yang berguna:

- read dinonaktifkan, write diaktifkan: memaksa generation provider dan me-refresh penyimpanan;
- read diaktifkan, write dinonaktifkan: menggunakan kembali jawaban yang sudah ada tanpa menyimpan jawaban baru;
- keduanya dinonaktifkan: melewati semantic cache sepenuhnya.

Kegagalan provider dan respons provider yang kosong tidak pernah di-cache.

## Request Coalescing

Request bersamaan (concurrent) dengan namespace, prompt, dan cache policy efektif yang sama akan berbagi satu resolusi yang sedang berjalan (in-flight). Sebuah leader melakukan lookup, generation, dan penyimpanan; follower menunggu (await) hasilnya.

Lock pada registry in-flight hanya melindungi registrasi dan penghapusan task. Lock tersebut tidak dipegang selama I/O embedding, cache, atau provider berlangsung. Baik keberhasilan maupun kegagalan sama-sama menghapus task tersebut sehingga request berikutnya dapat menggunakan cache atau mencoba lagi (retry).

Coalescing bersifat process-local. Beberapa replica backend memerlukan desain koordinasi eksternal apabila panggilan provider yang duplikat lintas replica juga harus dicegah.

## Kompatibilitas Embedding

Provider, model, dan dimensions mendefinisikan sebuah embedding space. Vektor dari space yang berbeda tidak boleh pernah dibandingkan.

- Memory storage secara alami memulai space baru setelah restart.
- Pgvector mempartisi baris yang tersimpan berdasarkan embedding provider, model, dan dimensions.

Mengubah normalisasi prompt juga mengubah perilaku matching. Bersihkan entri cache yang aktif ketika mengaktifkan, menonaktifkan, atau mengubah jarak koreksi typo sehingga embedding yang tersimpan dan yang masuk menggunakan satu kebijakan yang sama. Lihat
[Prompt typo normalization](prompt-typo-normalization.md).

## Inspector dan Counter Agregat

Workspace Cache mengekspos metadata yang aman:

- namespace dan cache key;
- prompt asli dan pratinjau respons yang dipotong;
- waktu pembuatan dan expiry;
- sisa TTL;
- hit entri dan akses terakhir;
- LRU recency rank.

Menghapus satu entri tidak menulis ulang counter hit/miss agregat historis. Membersihkan cache akan menghapus entri dan mereset counter tersebut. Embedding dan respons lengkap tidak dikembalikan oleh endpoint inspector.
