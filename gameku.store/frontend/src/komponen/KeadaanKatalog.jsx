import { muatUlangProduk } from '../layanan/layananProduk.js'

// Status berasal dari cache katalog yang sama dengan daftar produk.
export default function KeadaanKatalog({ status }) {
  if (status.memuat) return <div className="keadaan-kosong keadaan-katalog" role="status">Memuat produk…</div>
  if (!status.galat) return null
  return (
    <div className="keadaan-kosong keadaan-katalog" role="alert">
      <h3>Katalog belum dapat dimuat</h3>
      <p>Periksa koneksi lalu coba lagi.</p>
      <button type="button" className="tombol tombol-utama" onClick={muatUlangProduk}>Coba lagi</button>
    </div>
  )
}
