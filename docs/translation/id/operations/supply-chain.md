# Keamanan supply-chain

Semantix melakukan pin pada setiap base image Dockerfile dan service image Compose ke immutable multi-architecture manifest digest sambil mempertahankan tag yang mudah dibaca. Source of truth yang disetujui adalah
[`ops/supply-chain/approved-images.json`](../../../../ops/supply-chain/approved-images.json).

## Platform container yang didukung

Build container mendukung:

* `linux/amd64`
* `linux/arm64`

Quality workflow melakukan build pada setiap production dan development Dockerfile untuk kedua platform. `ops/ci/verify_image_pins.py` menolak reference yang mutable, image yang tidak dikenal, digest drift, dan approval yang tidak mencantumkan platform yang didukung.

## Update image

Dependabot memeriksa dependency Docker, GitHub Actions, Python, dan npm setiap Senin pukul 04:00 UTC. Dependabot membuka pull request yang dapat direview dan tidak pernah melakukan auto-merge. Update minor dan patch rutin dikelompokkan berdasarkan ecosystem dan dependency type. Antrean version-update dibatasi hingga satu pull request GitHub Actions dan dua pull request untuk setiap language package ecosystem.

Major upgrade ditangani secara manual agar runtime declaration, CI, dokumentasi, dan compatibility check dapat diperbarui secara bersamaan. Pull request Docker version rutin dinonaktifkan karena update image juga harus mengubah multi-platform digest yang telah direview dalam approved-image manifest. Security update Dependabot tetap diaktifkan dan direview segera setelah dipublikasikan.

Automatic Dependabot rebase dinonaktifkan untuk menghindari menjalankan ulang quality workflow secara penuh setelah setiap merge yang tidak terkait. Update dependency branch satu kali, setelah perubahan sebelumnya di-merge, dengan memberikan komentar `@dependabot rebase` pada pull request sebelum final review.

Untuk update image:

1. Baca release dan security notes dari publisher.
2. Pastikan manifest yang diusulkan berisi kedua platform yang didukung.
3. Perbarui readable tag, digest, dan approved-image manifest secara bersamaan.
4. Review setiap digest yang berubah, bukan menyetujui bot PR berdasarkan judulnya.
5. Wajibkan `Quality gate` lengkap, termasuk kedua platform build dan security scan.

Review routine digest update setiap minggu. Review security advisory dari publisher segera setelah dipublikasikan dan prioritaskan emergency digest update ketika issue yang actively exploitable memengaruhi Semantix. Digest-update pull request tidak pernah dikecualikan dari quality check normal.

## Security check

Quality workflow menambahkan check berikut tanpa mengubah permission default
`contents: read`:

| Check             | Kebijakan kegagalan                                                           |
| ----------------- | ----------------------------------------------------------------------------- |
| CodeQL            | Alert baru dengan severity Error, High, atau Critical pada baris yang berubah |
| TruffleHog        | Credential ter-commit yang terverifikasi                                      |
| Grype image scan  | Vulnerability High atau Critical dengan fix yang tersedia                     |
| Dependency review | Perubahan dependency High atau Critical                                       |

Exception advisory React Router yang sudah ada tetap terbatas pada
`GHSA-qwww-vcr4-c8h2`. Exception ini hanya berlaku untuk dependency review dan tidak mengubah CodeQL, secret scanning, image scanning, atau SBOM generation.

CodeQL menerima `security-events: write` hanya pada job-nya sehingga dapat mengunggah hasil. Job baru lainnya tetap read-only. GitHub menurunkan write permission untuk pull request dari fork; tidak ada scanner yang menggunakan `pull_request_target`, repository secrets, atau privileged registry credentials.

### Scoped scanner exception

Production backend menghapus installer/build package dan binary OpenSSL yang tidak digunakan dari resulting image dan hanya menekan `CVE-2026-15308` untuk versi binary
`python` yang tepat, yaitu `3.14.6`. Grype melaporkan fix pada Python 3.15, yang bukan maintenance update yang kompatibel untuk runtime Python 3.14 yang didukung. Mengubah Python patch version membuat exception berhenti cocok dan memerlukan fresh review.

Perubahan scanner harus diuji dalam throwaway fork atau non-default branch. Gunakan hanya synthetic fixture yang disediakan scanner, jangan pernah menggunakan credential aktif. Pastikan finding pada threshold yang didokumentasikan menyebabkan kegagalan, finding image dengan severity lebih rendah tidak menyebabkan kegagalan, dan fixture sudah tidak ada sebelum merge.

## Artifact SBOM dan provenance

Setelah image scanning berhasil, CI melakukan build pada kedua production image dan memublikasikan satu artifact bernama:

```text
semantix-supply-chain-<commit-sha>
```

Artifact tersebut berisi:

* `backend.spdx.json`
* `frontend.spdx.json`
* `backend.provenance.json`
* `frontend.provenance.json`

SBOM menggunakan SPDX JSON. File provenance berisi full Buildx build metadata dan materials. Workflow artifact kedaluwarsa setelah 14 hari. Artifact pull request ini meningkatkan visibilitas review, tetapi bukan release attestation yang ditandatangani.

## Keputusan mengenai release automation

Automated release sengaja belum dikonfigurasi. Repository belum mendefinisikan:

* release target atau container registry;
* versioning dan tag scheme;
* signing atau hosted-attestation requirement;
* rollback owner dan procedure.

Maintainer harus menyepakati keempat hal tersebut sebelum release workflow ditambahkan. Sampai saat itu, CI hanya melakukan build test artifact dan tidak memublikasikan image, package, tag, atau GitHub release.