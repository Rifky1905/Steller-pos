import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from './supabaseClient'
import { buildDynamicQris, DEFAULT_PLATFORM_QRIS_PAYLOAD } from './qris'
import { notifyAdminPayment } from './otp'

// Steller Logo — identik dengan logo di landing page (App.jsx)
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Main Star with glow effect */}
    <g filter="url(#glow)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradient)" />
    </g>
    {/* Inner diamond */}
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    {/* Small sparkle accent */}
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradient)" opacity="0.85" />
    {/* Text Steller */}
    <text x="64" y="41" fontFamily="Georgia, serif" fontSize="30" fontWeight="bold" fill="url(#blueGradient)" letterSpacing="0.5">Steller</text>
  </svg>
)

const PACKAGES = {
  '1bulan': { name: 'Paket Device + Langganan 1 Bulan', price: 1800000, planName: '1 Bulan', planDays: 30 },
  '3bulan': { name: 'Paket Device + Langganan 3 Bulan', price: 2000000, planName: '3 Bulan', planDays: 90 },
}
const COLORS = ['Putih', 'Biru', 'Hitam']

function HardwareOrder() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState('form') // form | pay | done
  const [pkg, setPkg] = useState(searchParams.get('paket') === '1bulan' ? '1bulan' : '3bulan')
  const [form, setForm] = useState({
    color: 'Putih', customerName: '', whatsapp: '', email: '',
    recipientName: '', address: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [proofPreview, setProofPreview] = useState('')
  const [proofUploading, setProofUploading] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [platformPay, setPlatformPay] = useState({ qrisImage: '', qrisPayload: '' })
  const [qrisSrc, setQrisSrc] = useState('')
  const [staticQrisSrc, setStaticQrisSrc] = useState('')

  const pkgInfo = PACKAGES[pkg]
  const upd = (k, v) => { setForm(p => ({ ...p, [k]: v })); setError('') }

  // Pengaturan pembayaran platform (QRIS milik admin)
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('platform_settings').select('value').eq('key', 'payment').maybeSingle()
        if (data?.value) setPlatformPay(p => ({ ...p, ...data.value }))
      } catch { /* fallback: instruksi manual */ }
      try {
        const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
        if (local) setPlatformPay(p => ({ ...p, ...local }))
      } catch { /* ignore */ }
    }
    load()
  }, [])

  // QRIS dinamis dengan nominal paket — pakai payload admin, fallback ke QRIS resmi platform
  useEffect(() => {
    const payload = platformPay.qrisPayload || DEFAULT_PLATFORM_QRIS_PAYLOAD
    const dyn = buildDynamicQris(payload, pkgInfo.price)
    QRCode.toDataURL(payload, { width: 300, margin: 1 }).then(setStaticQrisSrc).catch(() => setStaticQrisSrc(''))
    if (!dyn) { setQrisSrc(''); return }
    QRCode.toDataURL(dyn, { width: 420, margin: 1 }).then(setQrisSrc).catch(() => setQrisSrc(''))
  }, [platformPay.qrisPayload, pkg])

  useEffect(() => { setPaidAmount(String(pkgInfo.price)) }, [pkg])

  const goToPay = () => {
    if (!form.customerName.trim() || !form.whatsapp.trim()) {
      setError('Lengkapi Nama Pemesan dan Nomor WhatsApp.')
      return
    }
    if (!form.recipientName.trim() || !form.address.trim()) {
      setError('Lengkapi Nama Penerima dan Alamat Pengiriman.')
      return
    }
    setStep('pay')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('File bukti harus berupa gambar!'); return }
    setError('')
    setProofUploading(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `proofs/hardware-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('platform-assets')
      .upload(path, file, { contentType: file.type })
    if (!upErr) {
      const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
      setProofUrl(data.publicUrl)
      setProofPreview(data.publicUrl)
    } else {
      const reader = new FileReader()
      reader.onloadend = () => { setProofPreview(reader.result); setProofUrl(reader.result) }
      reader.readAsDataURL(file)
    }
    setProofUploading(false)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!proofUrl) { setError('⚠️ Upload bukti transfer terlebih dahulu — pesanan baru diproses setelah bukti diverifikasi.'); return }
    setIsSubmitting(true)
    // Tautkan ke merchant bila nomor WA cocok (untuk aktivasi langganan otomatis)
    const digits = form.whatsapp.replace(/\D/g, '')
    const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('62') ? digits : '62' + digits
    const waCandidates = [...new Set([form.whatsapp.trim(), intl, '+' + intl, '0' + intl.slice(2)])]
    const { data: merchant } = await supabase.from('merchants')
      .select('id').in('whatsapp', waCandidates).limit(1).maybeSingle()

    const { error: insErr } = await supabase.from('hardware_orders').insert({
      merchant_id: merchant?.id || null,
      customer_name: form.customerName.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim() || null,
      package_name: pkgInfo.name,
      package_price: pkgInfo.price,
      color: form.color,
      recipient_name: form.recipientName.trim(),
      shipping_address: form.address.trim(),
      paid_amount: parseInt(paidAmount) || pkgInfo.price,
      payment_proof: proofUrl,
      status: 'pending_confirmation',
    })
    setIsSubmitting(false)
    if (insErr) {
      const schemaFix = ' — jalankan blok SQL hardware_orders terbaru di supabase/schema.sql (berisi alter table ... add column if not exists) lewat SQL Editor Supabase'
      setError('Gagal mengirim pesanan: ' + insErr.message + (insErr.message.includes('schema cache') ? schemaFix : ''))
      return
    }
    setStep('done')
    // Notifikasi WA ke admin — fire-and-forget
    notifyAdminPayment({
      type: 'Pesanan Hardware Bundle',
      name: form.customerName,
      contact: form.whatsapp,
      detail: `${pkgInfo.name} · Warna ${form.color}`,
      amount: parseInt(paidAmount) || pkgInfo.price,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const downloadQr = async () => {
    try {
      const src = qrisSrc || platformPay.qrisImage
      if (!src) return
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qris-hardware-${pkgInfo.price}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(qrisSrc || platformPay.qrisImage, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-6 relative">
        <Link
          to="/"
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-navy-700 transition"
        >
          ← Kembali
        </Link>
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center">
          <Link to="/"><StellerLogo className="w-40 h-12" /></Link>
          <p className="text-xs text-gray-500 mt-2">Pemesanan Paket Siap Pakai Kasir</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {step === 'done' ? (
          /* ===== Pesanan terkirim ===== */
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-10 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pesanan Diterima!</h1>
            <p className="text-gray-600 mb-6">
              Bukti pembayaran untuk <span className="font-semibold">{pkgInfo.name}</span> sudah kami terima.
              Admin akan memverifikasi, lalu pesanan diproses & dikirim (estimasi 5–10 hari, bisa lebih cepat sesuai kurir).
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="px-6 py-3 bg-navy-600 text-white rounded-lg font-semibold hover:bg-navy-700 transition">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : step === 'form' ? (
          /* ===== Tahap 1: Data pesanan ===== */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-navy-700 font-medium mb-4 transition">
              ← Kembali ke Beranda
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Form Pemesanan Hardware</h1>
            <p className="text-sm text-gray-500 mb-6">Lengkapi data pemesan, pilihan warna, dan alamat pengiriman.</p>

            {/* Pilih paket */}
            <h3 className="font-bold text-gray-900 mb-3">Pilih Paket</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {Object.entries(PACKAGES).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setPkg(key)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    pkg === key ? 'border-navy-600 bg-navy-50' : 'border-slate-200 hover:border-navy-300'
                  }`}
                >
                  <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                  <p className="text-navy-600 font-bold mt-1">Rp {p.price.toLocaleString('id-ID')}</p>
                </button>
              ))}
            </div>

            {/* Pilihan warna */}
            <h3 className="font-bold text-gray-900 mb-3">Warna Perangkat *</h3>
            <div className="flex gap-2 mb-5">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => upd('color', c)}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition ${
                    form.color === c ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-slate-200 text-gray-600 hover:border-navy-300'
                  }`}
                >
                  {c === 'Putih' ? '⚪' : c === 'Biru' ? '🔵' : '⚫'} {c}
                </button>
              ))}
            </div>

            {/* Data pemesan */}
            <h3 className="font-bold text-gray-900 mb-3">Data Pemesan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Pemesan *</label>
                <input type="text" value={form.customerName} onChange={(e) => upd('customerName', e.target.value)}
                  placeholder="Nama lengkap" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">No. WhatsApp Aktif *</label>
                <input type="tel" value={form.whatsapp} onChange={(e) => upd('whatsapp', e.target.value)}
                  placeholder="08xx-xxxx-xxxx" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500" />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-gray-400 font-normal">(opsional — jika sudah punya akun toko)</span></label>
              <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)}
                placeholder="email@tokoanda.com" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500" />
            </div>

            {/* Alamat pengiriman */}
            <h3 className="font-bold text-gray-900 mb-3">Alamat Pengiriman</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Penerima *</label>
              <input type="text" value={form.recipientName} onChange={(e) => upd('recipientName', e.target.value)}
                placeholder="Nama penerima paket" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500" />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Alamat Lengkap *</label>
              <textarea rows={3} value={form.address} onChange={(e) => upd('address', e.target.value)}
                placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi, Kode Pos"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none" />
            </div>

            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

            <button onClick={goToPay}
              className="w-full py-4 bg-navy-600 text-white rounded-lg font-semibold text-lg hover:bg-navy-700 transition shadow-lg">
              Lanjut ke Pembayaran →
            </button>
          </div>
        ) : (
          /* ===== Tahap 2: Pembayaran ===== */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Pembayaran Pesanan</h1>

            {/* Ringkasan pesanan */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Paket</span><span className="font-semibold text-gray-900 text-right">{pkgInfo.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Warna</span><span className="font-semibold text-gray-900">{form.color}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pemesan</span><span className="font-semibold text-gray-900 text-right">{form.customerName} · {form.whatsapp}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Dikirim ke</span><span className="font-semibold text-gray-900 text-right max-w-[60%]">{form.recipientName} — {form.address}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between"><span className="text-gray-900 font-semibold">Total Tagihan</span><span className="text-xl font-bold text-navy-700">Rp {pkgInfo.price.toLocaleString('id-ID')}</span></div>
            </div>

            {/* QRIS / instruksi pembayaran */}
            <div className="border border-slate-200 rounded-xl p-5 mb-5 text-center">
              {(qrisSrc || platformPay.qrisImage) ? (
                <>
                  <img src={qrisSrc || platformPay.qrisImage} alt="QRIS" className="w-56 h-56 mx-auto object-contain" />
                  <p className={`text-xs mt-2 font-semibold ${qrisSrc ? 'text-green-600' : 'text-amber-600'}`}>
                    {qrisSrc
                      ? `✅ QRIS dinamis — nominal Rp ${pkgInfo.price.toLocaleString('id-ID')} sudah tertanam otomatis.`
                      : `⚠️ QRIS statis — masukkan nominal Rp ${pkgInfo.price.toLocaleString('id-ID')} secara manual.`}
                  </p>
                  {!qrisSrc && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Admin: isi "Kode QRIS (payload)" di Super Admin → Pengaturan Pembayaran agar QR ini otomatis ber-nominal (dinamis).
                    </p>
                  )}
                  <button
                    onClick={downloadQr}
                    className="mt-3 px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-xs font-semibold border border-slate-300"
                  >
                    ⬇️ Unduh QRIS
                  </button>
                  {qrisSrc && staticQrisSrc && (
                    <details className="mt-3 text-left">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-navy-600">
                        QR tidak bisa di-scan / ditolak aplikasi? Gunakan QR statis
                      </summary>
                      <img src={staticQrisSrc} alt="QRIS Statis" className="w-36 h-36 mx-auto mt-3 object-contain border border-slate-200 rounded-lg bg-white" />
                      <p className="text-xs text-amber-600 mt-2 text-center">Scan QR ini lalu masukkan nominal Rp {pkgInfo.price.toLocaleString('id-ID')} secara manual.</p>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">QRIS belum tersedia — transfer manual / e-Wallet ke:</p>
                  <p className="text-xl font-bold text-gray-900 tracking-widest">0858-9317-4442</p>
                  <p className="text-xs text-gray-500 mt-1">a.n. PT Steller Indonesia — sertakan nama pemesan di catatan</p>
                </>
              )}
            </div>

            {/* Nominal dibayar */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Nominal yang Dibayar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">Rp</span>
                <input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 font-bold text-lg" />
              </div>
            </div>

            {/* Upload bukti — wajib */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Bukti Transfer <span className="text-red-500">*</span></label>
              <label className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-navy-400 transition">
                <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                {proofPreview ? (
                  <img src={proofPreview} alt="Bukti Transfer" className="w-32 h-32 mx-auto object-contain rounded-lg" />
                ) : (
                  <>
                    <span className="text-3xl">📤</span>
                    <p className="text-sm text-gray-500 mt-2">{proofUploading ? 'Mengupload...' : 'Klik untuk upload screenshot/bukti transfer'}</p>
                  </>
                )}
              </label>
            </div>

            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

            <div className="flex space-x-3">
              <button onClick={() => { setStep('form'); setError('') }}
                className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium">
                ← Kembali
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50">
                {isSubmitting ? '⏳ Mengirim...' : `✅ Konfirmasi Pesanan — Rp ${pkgInfo.price.toLocaleString('id-ID')}`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default HardwareOrder
