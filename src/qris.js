// Utilitas QRIS dinamis — menyisipkan nominal (tag EMV "54") ke payload QRIS statis
// lalu menghitung ulang checksum CRC16-CCITT (XModem) agar QR valid saat di-scan.

// Payload QRIS statis resmi platform StellerPOS
// NMID: ID1026610571477 · Merchant: "Steller, Service" · Acquirer: DANA (93600915)
// Dipakai sebagai default bila admin belum mengisi payload di Pengaturan Pembayaran
export const DEFAULT_PLATFORM_QRIS_PAYLOAD =
  '00020101021126570011ID.DANA.WWW011893600915303579861802090357986180303UMI51440014ID.CO.QRIS.WWW0215ID10266105714770303UMI5204899953033605802ID5916Steller, Service6010Kab. Bogor610516831630457D3'

const crc16ccitt = (str) => {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Hapus satu tag TLV dari payload root
const stripTag = (s, tagId) => {
  let out = ''
  let i = 0
  while (i + 4 <= s.length) {
    const tag = s.substr(i, 2)
    const len = parseInt(s.substr(i + 2, 2), 10)
    if (Number.isNaN(len) || i + 4 + len > s.length) break
    if (tag !== tagId) out += s.substr(i, 4 + len)
    i += 4 + len
  }
  return out + s.slice(i)
}

/**
 * Ubah payload QRIS statis menjadi dinamis dengan nominal tertanam.
 * @param {string} payload - string QRIS EMV mentah (diawali "000201...")
 * @param {number} amount - nominal tagihan rupiah (bilangan bulat)
 * @returns {string|null} payload QRIS dinamis, atau null jika payload tidak valid
 */
export const buildDynamicQris = (payload, amount) => {
  if (!payload || typeof payload !== 'string') return null
  // Hanya buang spasi di tepi — spasi DI DALAM nilai (nama merchant/kota) harus dipertahankan
  // agar panjang field TLV tetap valid, mis. "Steller, Service" (5916) atau "Kab. Bogor" (6010)
  let q = payload.trim()
  if (!q.startsWith('000201')) return null

  // Lepas CRC lama (tag "63" panjang "04" + 4 hex digit di ujung)
  if (/6304[0-9A-Fa-f]{4}$/.test(q)) q = q.slice(0, -4)

  // QRIS statis (010211) -> dinamis (010212)
  q = q.replace('010211', '010212')

  // Buang nominal lama (tag 54) jika ada, lalu sisipkan nominal baru sebelum tag CRC (63)
  q = stripTag(q, '54')
  const amt = String(Math.round(amount))
  const tag54 = `54${String(amt.length).padStart(2, '0')}${amt}`
  const crcIdx = q.lastIndexOf('6304')
  const body = crcIdx >= 0 ? q.slice(0, crcIdx) + tag54 : q + tag54

  return body + '6304' + crc16ccitt(body + '6304')
}
