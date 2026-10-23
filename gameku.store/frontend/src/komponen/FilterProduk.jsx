// Filter produk — search + pil kategori + sort (reusable store/kategori).
import Ikon from './Ikon.jsx'
import '../css/filter.css'

const opsiUrut = [
  { id: 'terbaru', nama: 'Terbaru' },
  { id: 'populer', nama: 'Populer' },
  { id: 'harga-rendah', nama: 'Harga Terendah' },
  { id: 'harga-tinggi', nama: 'Harga Tertinggi' },
]

export default function FilterProduk({ kataKunci, pilihKataKunci, kategoriAktif, pilihKategori, urutAktif, pilihUrut, daftarKategori, jumlah, tampilKategori = true }) {
  return (
    <div className="bilah-saring">
      <form className="cari-besar" role="search" onSubmit={(e) => e.preventDefault()}>
        <Ikon nama="cari" ukuran={16} />
        <input value={kataKunci} onChange={(e) => pilihKataKunci(e.target.value)} placeholder="Cari top-up, voucher, skin…" aria-label="Cari produk" />
      </form>
      {tampilKategori && <div className="pil-kategori" aria-label="Filter kategori">
        <button type="button" className={kategoriAktif === 'semua' ? 'pil pil-aktif' : 'pil'} onClick={() => pilihKategori('semua')}>Semua</button>
        {daftarKategori.map((k) => (
          <button key={k.id} type="button" className={kategoriAktif === k.id ? 'pil pil-aktif' : 'pil'} onClick={() => pilihKategori(k.id)}>{k.nama}</button>
        ))}
      </div>}
      <div className="baris-urut">
        <label className="label-isian" htmlFor="urut-produk" style={{ margin: 0 }}>Urutkan:</label>
        <select id="urut-produk" className="pilih pilih-urut" value={urutAktif} onChange={(e) => pilihUrut(e.target.value)}>
          {opsiUrut.map((o) => (<option key={o.id} value={o.id}>{o.nama}</option>))}
        </select>
        <span className="lencana lencana-abu">{jumlah} produk</span>
      </div>
    </div>
  )
}
