// Halaman bantuan multi-rute: /bantuan, /kreator, /syarat, /privasi,
// /komunitas, /event, /berita — konten menyesuaikan path (siap diganti CMS PHP).
import { Link, useLocation } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'

const faqBantuan = [
  { t: 'Bagaimana cara membeli produk?', j: 'Pilih produk → klik Beli → ikuti checkout. File produk bisa diunduh dari halaman pesanan setelah pembayaran berhasil.' },
  { t: 'File tidak bisa dibuka, kenapa?', j: 'Pastikan versi Minecraft sesuai deskripsi produk (Java/Bedrock). File .schem butuh WorldEdit, .mcaddon dibuka lewat Minecraft Bedrock.' },
  { t: 'Bisakah refund?', j: 'Konten digital yang sudah diunduh tidak bisa dikembalikan. Jika file rusak, hubungi kreator lewat halaman produk.' },
  { t: 'Bagaimana jadi kreator?', j: 'Hubungi tim RAK VIN lewat halamanhubungi. Tim kurasi meninjau maksimal 7 hari.' },
]

const kontenHalaman = {
  '/bantuan': {
    lencana: 'Support', judul: 'Pusat Bantuan',
    sub: 'Pertanyaan umum sebelum, sesudah, dan selama belanja.',
    bagian: faqBantuan.map((f) => ({ judul: f.t, isi: [f.j] })),
    cta: { teks: 'Gabung Discord', ke: 'https://discord.gg/rakvin' },
  },
  '/kreator': {
    lencana: 'Creator', judul: 'Jadi Kreator',
    sub: 'Publikasikan skin, map, atau build kamu di RAK VIN.',
    bagian: [
      { judul: 'Kenapa kreator di sini?', isi: ['Komisi kompetitif untuk konten Minecraft kurasi.', 'Dashboard kreator (riwayat) menyusul setelah tahap PHP.', 'Promosi ke komunitas RAK VIN tiap minggu.'] },
      { judul: 'Ketentuan unggah', isi: ['Konten original, bukan hasil repost.', 'Mendukung minimal satu versi Minecraft aktif (1.20+).', 'Gambar preview minimal 1280×720.'] },
    ],
    cta: { teks: 'Kirim Portofolio', ke: '/komunitas' },
  },
  '/syarat': {
    lencana: 'Legal', judul: 'Syarat & Ketentuan',
    sub: 'Berlaku untuk semua pembelian di RAK VIN.',
    bagian: [
      { judul: '1. Lisensi penggunaan', isi: ['Pembelian memberi lisensi pribadi, non-eksklusif untuk pemakaian di akun Minecraft sendiri.', 'Dilarang menjual ulang, membagikan publik, atau mememasukkan ke paket lain tanpa izin kreator.'] },
      { judul: '2. Transaksi', isi: ['Harga dapat berubah sewaktu-waktu tanpa pemberitahuan.', 'Pembayaran diproses lewat payment gateway setelah backend PHP terhubung.'] },
      { judul: '3. Pengembalian dana', isi: ['Konten digital yang sudah diunduh tidak dapat dikembalikan, kecuali file terbukti rusak saat pembelian pertama.'] },
    ],
  },
  '/privasi': {
    lencana: 'Legal', judul: 'Kebijakan Privasi',
    sub: 'Data yang dikumpulkan dan bagaimana kami memakainya.',
    bagian: [
      { judul: 'Data yang dikumpulkan', isi: ['Email, nama pemain, dan riwayat pembelian untuk keperluan akun dan pengiriman file.', 'Statistik anonim kunjungan untuk meningkatkan pengalaman toko.'] },
      { judul: 'Berapa lama disimpan', isi: ['Data transaksi disimpan selama masih diperlukan untuk dukungan pelanggan dan kepatuhan hukum.', 'Kamu bisa meminta penghapusan akun kapan saja lewat email dukungan.'] },
    ],
  },
  '/komunitas': {
    lencana: 'Community', judul: 'Komunitas RAK VIN',
    sub: 'Ngobrol, request konten, dan ikut giveaway bareng pemain lain.',
    bagian: [
      { judul: 'Discord', isi: ['Server utama untuk support, showcase build, dan announcement promo.', 'Kanal khusus bagi kreator yang ingin portofolionya direview.'] },
      { judul: 'Aturan singkat', isi: ['No spam, no promosi konten ilegal, dan tetap sopan.', 'Konten SFW saja di channel showcase.'] },
    ],
    cta: { teks: 'Buka Discord', ke: 'https://discord.gg/rakvin' },
  },
  '/event': {
    lencana: 'Event', judul: 'Event Minecraft',
    sub: 'Kompetisi build, giveaway skin pack, dan community play.',
    bagian: [
      { judul: 'Belum ada event terjadwal', isi: ['Informasi kompetisi dan giveaway akan diumumkan di halaman ini.'] },
    ],
    cta: { teks: 'Ikuti di Discord', ke: 'https://discord.gg/rakvin' },
  },
  '/berita': {
    lencana: 'News', judul: 'Berita & Update',
    sub: 'Konten baru, perubahan harga, dan pengumuman platform.',
    bagian: [
      { judul: 'Belum ada pengumuman', isi: ['Kabar terbaru RAK VIN akan tampil di sini setelah ada rilisan produk atau perubahan toko.'] },
    ],
  },
}

export default function HalamanBantuan() {
  const { pathname } = useLocation()
  const isi = kontenHalaman[pathname] || kontenHalaman['/bantuan']

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-hijau">{isi.lencana}</span>
        <h1 className="judul-halaman">{isi.judul}</h1>
        <p className="subjudul-halaman">{isi.sub}</p>
      </div></section>

      <section className="bagian"><div className="wadah" style={{ display: 'grid', gap: 12, maxWidth: 820 }}>
        {isi.bagian.map((b) => (
          <article key={b.judul} className="kartu"><div className="kartu-isi">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>{b.judul}</h3>
            {b.isi.map((p) => (<p key={p} className="subjudul-halaman" style={{ marginTop: 4 }}>{p}</p>))}
          </div></article>
        ))}
        {isi.cta && (
          isi.cta.ke.startsWith('http')
            ? <a className="tombol tombol-utama" style={{ justifySelf: 'start' }} href={isi.cta.ke} target="_blank" rel="noreferrer"><Ikon nama="kreator" ukuran={16} />{isi.cta.teks}</a>
            : <Link className="tombol tombol-utama" style={{ justifySelf: 'start' }} to={isi.cta.ke}><Ikon nama="kreator" ukuran={16} />{isi.cta.teks}</Link>
        )}
      </div></section>
    </>
  )
}
