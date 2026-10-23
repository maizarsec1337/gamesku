// Lencana status universal untuk tabel, kartu, dan detail admin.
const petaKelas = {
  Berhasil: 's-berhasil',
  Aktif: 's-berhasil',
  Disetujui: 's-berhasil',
  Diproses: 's-proses',
  Review: 's-proses',
  Menunggu: 's-menunggu',
  'Menunggu Review': 's-menunggu',
  Terjadwal: 's-menunggu',
  Gagal: 's-gagal',
  Nonaktif: 's-gagal',
  Ditangguhkan: 's-gagal',
  Draft: 's-netral',
  Berakhir: 's-netral',
  Disembunyikan: 's-netral',
}

export default function LencanaStatus({ status }) {
  const kelas = petaKelas[status] || 's-netral'
  return <span className={`lencana-status ${kelas}`}>{status || '-'}</span>
}
