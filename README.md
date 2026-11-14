# i-Study

App belajar (PWA) dwibahasa **BM + English** untuk pelbagai subjek: nota, kad ingatan (ulangan berjarak), kuiz MCQ, soalan esei, mod exam bermasa dan alat khas. Berfungsi **tanpa internet** selepas dibuka sekali. Tiada pelayan, tiada akaun; kemajuan disimpan dalam pelayar.

Subjek: **SBSC2093** Perakaunan Kewangan dan Pelaporan 2 (FAR2), **SBSC3153** Komunikasi Perniagaan dan **SBSC3183** Percukaian 2 (dua yang terakhir belum ada chapter; tambah melalui Pustaka).

Kandungan sedia ada: **FAR2** (Financial Reporting 2): Bab 1 *PPE*, Bab 3 *Intangible Assets*, Bab 4 *Investment Property*, Bab 5 *Biological Assets* dan Bab 7 *Leases*, serta pelan kursus 15 minggu dan pecahan penilaian.

## Hoskan di GitHub Pages

1. Di GitHub: **Settings → Pages**.
2. *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** → Folder: **/ (root)** → Save.
3. Tunggu ±1 minit. Alamat app: `https://<nama-github-anda>.github.io/i-study/`
4. Buka di telefon → **Add to Home Screen** / **Install app**.

## Tambah subjek / chapter baru (tanpa coding)

1. Buka app → ikon 📚 (Pustaka) → isi ID/kod/nama subjek → **Salin prompt AI**.
2. Tampal prompt dalam Claude (atau AI lain) bersama slide/nota chapter itu. Ia pulangkan satu fail `.json`.
3. Di Pustaka → **Pilih fail .json** → Import. Kalau ada ralat, tekan **Salin ralat**, tampal kepada AI dan minta betulkan.

Chapter import disimpan dalam pelayar anda (tidak masuk repo). Guna **Eksport chapter saya** / **Eksport kemajuan** untuk sandaran atau pindah ke peranti lain.

## Jadikan kandungan rasmi (dalam repo)

Letak fail JSON dalam `content/<id-subjek>/` dan daftarkan dalam `content/index.json`:

```json
{ "subjects": [ { "id": "far2", "code": "FAR2",
    "name": { "en": "Financial Reporting 2", "ms": "Pelaporan Kewangan 2" },
    "chapters": ["far2/ch1.json", "far2/ch3.json", "far2/ch4.json"],
    "info": { "assessment": [], "plan": [] } } ] }
```

Kemudian naikkan nombor `CACHE` dalam `sw.js` (cth `istudy-v4`) supaya peranti ambil versi baru. Format penuh: [docs/CONTENT-FORMAT.md](docs/CONTENT-FORMAT.md).

## Jalankan setempat

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

(Jangan buka `index.html` terus; PWA dan `fetch` perlukan alamat web.)

## Ubah rupa (Tailwind)

UI guna [Tailwind CSS](https://tailwindcss.com) v3. Selepas mengubah kelas dalam `index.html`/`app.js` atau komponen dalam `src/input.css`, bina semula CSS:

```bash
npm install
npm run build:css
```

Commit `tailwind.css` yang dihasilkan dan naikkan nombor `CACHE` dalam `sw.js`.

## Struktur

| Fail | Fungsi |
|---|---|
| `index.html`, `app.js` | App generik (sidebar, dashboard, pengesahan format, import, SRS, kuiz) |
| `tailwind.css` | CSS Tailwind yang sudah dikompil (dicommit; tiada langkah build semasa deploy) |
| `src/input.css`, `tailwind.config.js`, `package.json` | Sumber Tailwind untuk membina semula `tailwind.css` |
| `tools-far2.js` | Alat khas FAR2 (kalkulator, pembantu pemindahan) |
| `content/index.json` | Senarai subjek & chapter rasmi |
| `content/<subjek>/<chapter>.json` | Kandungan chapter |
| `content/ai-prompt.txt`, `content/template.json` | Prompt AI & templat untuk chapter baru |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, install) |

---

**English:** i-Study is a bilingual (Malay + English) study PWA for multiple subjects. Add chapters in-app by importing a JSON file (generate it with the built-in AI prompt) or commit files under `content/`. Host it on GitHub Pages (Settings → Pages → `main` / root).
