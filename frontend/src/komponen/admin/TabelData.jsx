import Ikon from '../Ikon.jsx'

// Tabel generik admin.
// prop "kolom": [{ kunci, label, rata ('sel-kanan'|'sel-tengah'), render(baris) }]
// prop "baris": array data; "padaKlikBaris" opsional.
export default function TabelData({
  kolom = [],
  baris = [],
  padaKlikBaris,
  pesanKosong = 'Belum ada data untuk ditampilkan.',
}) {
  if (baris.length === 0) {
    return (
      <div className="panel-badan">
        <div className="keadaan-kosong" style={{ padding: '36px 16px' }}>
          <div className="keadaan-kosong-ikon">
            <Ikon nama="cari" ukuran={30} />
          </div>
          <h3>Data tidak ditemukan</h3>
          <p>{pesanKosong}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bungkus-tabel">
      <table className="tabel-data">
        <thead>
          <tr>
            {kolom.map((k) => (
              <th key={k.kunci} className={k.rata || ''}>
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => (
            <tr
              key={b.id ?? b.kunci ?? `${b.nama ?? i}-${i}`}
              className={padaKlikBaris ? 'baris-klik' : ''}
              onClick={padaKlikBaris ? () => padaKlikBaris(b) : undefined}
            >
              {kolom.map((k) => (
                <td
                  key={k.kunci}
                  data-label={k.label}
                  className={k.rata || ''}
                >
                  {k.render ? k.render(b, i) : (b[k.kunci] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
