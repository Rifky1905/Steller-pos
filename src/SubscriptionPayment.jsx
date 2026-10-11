import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from './supabaseClient'
import { buildDynamicQris, DEFAULT_PLATFORM_QRIS_PAYLOAD } from './qris'
import { notifyAdminPayment } from './otp'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientSubPay" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientSubPay" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowSubPay">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowSubPay)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientSubPay)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientSubPay)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientSubPay)" letter-spacing="0.5">Steller</text>
  </svg>
)

const PLAN_PRICES = {
  '1 Bulan': { price: 100000, days: 30 },
  '3 Bulan': { price: 280000, days: 90 },
  '6 Bulan': { price: 550000, days: 180 },
  '1 Tahun': { price: 1000000, days: 365 },
}

function SubscriptionPayment() {
  const navigate = useNavigate()
  const [merchant, setMerchant] = useState(null)
  const [platformPay, setPlatformPay] = useState({ transfer: true, qris: true, ewallet: false, qrisImage: '' })
  const [payMethod, setPayMethod] = useState('qris')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [proofPreview, setProofPreview] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [dynamicQrisUrl, setDynamicQrisUrl] = useState('')
  const [staticQrisUrl, setStaticQrisUrl] = useState('')
  const [paidAmount, setPaidAmount] = useState('')

  const refreshMerchant = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!error && data) {
      setMerchant(data)
      sessionStorage.setItem('merchantSession', JSON.stringify({
        id: data.id, email: data.email, ownerName: data.owner_name,
        storeName: data.store_name, plan: data.plan, status: data.status,
        startDate: data.start_date, endDate: data.end_date,
      }))
    }
    return data
  }, [])

  useEffect(() => {
    const init = async () => {
      let session = null
      try { session = JSON.parse(sessionStorage.getItem('merchantSession')) } catch { /* ignore */ }
      if (!session?.id) {
        navigate('/login')
        return
      }
      await refreshMerchant(session.id)
      // Pengaturan pembayaran platform (QRIS dinamis dari Super Admin)
      try {
        const { data: ps } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'payment')
          .maybeSingle()
        if (ps?.value) setPlatformPay(prev => ({ ...prev, ...ps.value }))
        else {
          const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
          if (local) setPlatformPay(prev => ({ ...prev, ...local }))
        }
      } catch {
        try {
          const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
          if (local) setPlatformPay(prev => ({ ...prev, ...local }))
        } catch { /* ignore */ }
      }
      setIsLoading(false)
    }
    init()
  }, [navigate, refreshMerchant])

  const paymentMethods = [
    ...(platformPay.qris ? [{ id: 'qris', label: 'QRIS', desc: 'Scan semua e-wallet & m-banking', icon: '📱' }] : []),
    ...(platformPay.transfer ? [
      { id: 'bca', label: 'Transfer BCA', desc: 'Virtual Account BCA', icon: '🏦' },
      { id: 'mandiri', label: 'Transfer Mandiri', desc: 'Virtual Account Mandiri', icon: '🏦' },
      { id: 'bni', label: 'Transfer BNI', desc: 'Virtual Account BNI', icon: '🏦' },
    ] : []),
    ...(platformPay.ewallet ? [{ id: 'ewallet', label: 'e-Wallet', desc: 'GoPay / OVO / DANA', icon: '👛' }] : []),
  ]
  const activePayMethod = paymentMethods.some(m => m.id === payMethod) ? payMethod : paymentMethods[0]?.id || 'qris'

  // Paket yang dipilih otomatis menentukan nominal tagihan — pelanggan tidak perlu mengetik nominal
  const activePlan = PLAN_PRICES[selectedPlan] ? selectedPlan : (PLAN_PRICES[merchant?.plan] ? merchant.plan : '1 Bulan')
  const planInfo = PLAN_PRICES[activePlan]

  // QRIS dinamis: nominal paket otomatis tertanam — fallback ke QRIS resmi platform
  useEffect(() => {
    const payload = platformPay.qrisPayload || DEFAULT_PLATFORM_QRIS_PAYLOAD
    QRCode.toDataURL(payload, { width: 300, margin: 1 }).then(setStaticQrisUrl).catch(() => setStaticQrisUrl(''))
    const dyn = buildDynamicQris(payload, planInfo.price)
    if (!dyn) { setDynamicQrisUrl(''); return }
    QRCode.toDataURL(dyn, { width: 512, margin: 2 })
      .then(setDynamicQrisUrl)
      .catch(() => setDynamicQrisUrl(''))
  }, [platformPay.qrisPayload, planInfo.price])
  const qrisDisplayUrl = dynamicQrisUrl || platformPay.qrisImage

  // Nominal dibayar otomatis mengikuti harga paket yang dipilih (bisa disesuaikan jika transfer manual)
  useEffect(() => {
    setPaidAmount(String(planInfo.price))
  }, [activePlan]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `proofs/merchant-${merchant.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('platform-assets')
      .upload(path, file, { contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
      setProofUrl(data.publicUrl)
      setProofPreview(data.publicUrl)
    } else {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofPreview(reader.result)
        setProofUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleConfirmPayment = async () => {
    const paid = parseInt(paidAmount) || 0
    if (!paid) {
      setMessage('⚠️ Isi nominal pembayaran yang Anda transfer terlebih dahulu.')
      return
    }
    if (paid < planInfo.price) {
      setMessage(`⚠️ Nominal kurang! Tagihan paket ${activePlan} adalah Rp ${planInfo.price.toLocaleString('id-ID')} — periksa kembali pembayaran Anda.`)
      return
    }
    if (!proofUrl) {
      setMessage('⚠️ Silakan upload bukti transfer terlebih dahulu.')
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase
      .from('merchants')
      .update({ payment_status: 'pending_confirmation', payment_proof: proofUrl, plan: activePlan, plan_price: planInfo.price, paid_amount: paid })
      .eq('id', merchant.id)
    setIsSubmitting(false)
    if (error) {
      setMessage('Gagal konfirmasi: ' + error.message)
      return
    }
    await refreshMerchant(merchant.id)
    setMessage('✅ Bukti pembayaran terkirim! Menunggu persetujuan Super Admin.')
    // Notifikasi WA ke admin — fire-and-forget
    notifyAdminPayment({
      type: 'Langganan Baru / Aktivasi',
      name: merchant.owner_name || merchant.store_name,
      contact: merchant.whatsapp || merchant.email,
      detail: activePlan,
      amount: paid,
    })
  }

  const handleCheckStatus = async () => {
    setIsChecking(true)
    const data = await refreshMerchant(merchant.id)
    setIsChecking(false)
    if (data?.status === 'active') {
      setMessage('🎉 Langganan Anda telah diaktifkan!')
    } else {
      setMessage('Pembayaran masih menunggu persetujuan Super Admin.')
    }
  }

  const handleEnterDashboard = () => {
    navigate('/dashboard')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Memuat status langganan...</p>
      </div>
    )
  }

  const isPendingConfirm = merchant?.payment_status === 'pending_confirmation'
  const isActive = merchant?.status === 'active'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center">
          <StellerLogo className="w-40 h-12" />
          <p className="text-xs text-gray-500 mt-2">Pembayaran Langganan Merchant</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Stepper — Tahap 3 dari proses pendaftaran */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { n: 1, label: 'Pemilik Usaha' },
              { n: 2, label: 'Profil Toko & Paket' },
              { n: 3, label: 'Pembayaran & Aktivasi' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                    s.n < 3
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-navy-600 text-white ring-4 ring-navy-100'
                  }`}>
                    {(s.n < 3 || isActive) ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s.n}
                  </div>
                  <span className={`ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${
                    s.n < 3 || isActive ? 'text-green-600' : 'text-navy-600 font-bold'
                  }`}>{s.label}</span>
                </div>
                {i < 2 && <div className={`w-8 sm:w-14 h-0.5 ${s.n < 3 ? 'bg-green-500' : 'bg-gray-300'}`}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* ===== Langganan sudah aktif ===== */}
        {isActive ? (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-10 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Langganan Aktif!</h1>
            <p className="text-gray-600 mb-1">
              <span className="font-semibold">{merchant.store_name}</span> — Paket {merchant.plan}
            </p>
            {merchant.end_date && (
              <p className="text-sm text-gray-500 mb-6">
                Berlaku sampai {new Date(merchant.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={handleEnterDashboard}
              className="px-8 py-4 bg-navy-600 text-white rounded-lg font-bold hover:bg-navy-700 transition shadow-lg"
            >
              🚀 Masuk ke Dashboard Toko
            </button>
          </div>
        ) : isPendingConfirm ? (
          /* ===== Menunggu konfirmasi admin ===== */
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-10 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Menunggu Konfirmasi</h1>
            <p className="text-gray-600 mb-6">
              Bukti pembayaran untuk <span className="font-semibold">{merchant.store_name}</span> sudah diterima.
              Super Admin akan mengaktifkan langganan Anda.
            </p>
            {merchant.payment_proof && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Bukti yang dikirim:</p>
                <img src={merchant.payment_proof} alt="Bukti Transfer" className="w-40 h-40 mx-auto object-contain border border-slate-200 rounded-lg" />
              </div>
            )}
            {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
            <div className="flex justify-center gap-3">
              <button
                onClick={handleCheckStatus}
                disabled={isChecking}
                className="px-6 py-3 bg-navy-600 text-white rounded-lg font-semibold hover:bg-navy-700 transition disabled:opacity-50"
              >
                {isChecking ? 'Mengecek...' : '🔄 Cek Status Pembayaran'}
              </button>
              <button
                onClick={() => { sessionStorage.removeItem('merchantSession'); navigate('/') }}
                className="px-6 py-3 bg-slate-100 text-gray-700 rounded-lg font-semibold hover:bg-slate-200 transition"
              >
                Keluar
              </button>
            </div>
          </div>
        ) : (
          /* ===== Form pembayaran ===== */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Aktivasi Langganan</h1>
                <p className="text-sm text-gray-500">{merchant.store_name} · {merchant.owner_name}</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold border border-amber-200">
                ⏳ Belum Bayar
              </span>
            </div>

            {/* Pilihan paket — nominal tagihan mengikuti otomatis */}
            <h3 className="font-bold text-gray-900 mb-3">Pilih Paket Langganan</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {Object.entries(PLAN_PRICES).map(([name, info]) => (
                <button
                  key={name}
                  onClick={() => setSelectedPlan(name)}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    activePlan === name
                      ? 'border-navy-600 bg-navy-50'
                      : 'border-slate-200 hover:border-navy-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-navy-600 font-bold">Rp {info.price.toLocaleString('id-ID')}</p>
                </button>
              ))}
            </div>

            {/* Ringkasan paket */}
            <div className="bg-navy-50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tagihan</p>
                <p className="font-bold text-gray-900 text-lg">Steller POS — {activePlan}</p>
              </div>
              <p className="text-2xl font-bold text-navy-600">Rp {planInfo.price.toLocaleString('id-ID')}</p>
            </div>

            {/* Metode pembayaran */}
            <h3 className="font-bold text-gray-900 mb-3">Pilih Metode Pembayaran</h3>
            {paymentMethods.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPayMethod(method.id)}
                    className={`p-3 rounded-xl border-2 text-left transition ${
                      activePayMethod === method.id
                        ? 'border-navy-600 bg-navy-50'
                        : 'border-slate-200 hover:border-navy-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{method.label}</p>
                        <p className="text-xs text-gray-500">{method.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5 text-sm text-amber-700">
                ⚠️ Belum ada metode pembayaran aktif. <a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900">Hubungi admin platform via WhatsApp</a>.
              </div>
            )}

            {/* Instruksi pembayaran */}
            {activePayMethod === 'qris' && (
              <div className="border border-slate-200 rounded-xl p-5 mb-5 text-center">
                <p className="text-sm text-gray-600 mb-3">Scan QRIS di bawah dengan e-wallet / m-banking Anda:</p>
                {qrisDisplayUrl ? (
                  <img src={qrisDisplayUrl} alt="QRIS StellerPOS" className="w-64 h-64 sm:w-72 sm:h-72 mx-auto object-contain mb-3 border-4 border-slate-800 rounded-lg bg-white" />
                ) : (
                  <div className="w-64 h-64 mx-auto bg-slate-100 border-4 border-slate-800 rounded-lg flex items-center justify-center mb-3">
                    <p className="text-xs text-gray-400 px-4">QRIS belum diupload oleh Super Admin</p>
                  </div>
                )}
                <p className="font-bold text-gray-900 text-xl">Rp {planInfo.price.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500">QRIS · Steller POS Indonesia</p>
                {dynamicQrisUrl ? (
                  <p className="mt-3 text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-left">
                    ✅ <span className="font-semibold">QRIS dinamis:</span> nominal <span className="font-bold">Rp {planInfo.price.toLocaleString('id-ID')}</span> sudah tertanam otomatis — cukup scan &amp; bayar tanpa input manual.
                  </p>
                ) : (
                  <p className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-left">
                    ⚠️ <span className="font-semibold">Catatan:</span> QRIS ini statis — saat scan, masukkan nominal <span className="font-bold">Rp {planInfo.price.toLocaleString('id-ID')}</span> secara manual di aplikasi e-wallet / m-banking Anda sesuai harga paket {activePlan}.
                  </p>
                )}
                {dynamicQrisUrl && (staticQrisUrl || platformPay.qrisImage) && (
                  <details className="mt-3 text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-navy-600">
                      QR tidak bisa di-scan / ditolak aplikasi? Gunakan QR statis
                    </summary>
                    <img src={staticQrisUrl || platformPay.qrisImage} alt="QRIS Statis" className="w-40 h-40 mx-auto mt-3 object-contain border border-slate-200 rounded-lg bg-white" />
                    <p className="text-xs text-amber-600 mt-2 text-center">Scan QR ini lalu masukkan nominal Rp {planInfo.price.toLocaleString('id-ID')} secara manual.</p>
                  </details>
                )}
                {qrisDisplayUrl && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(qrisDisplayUrl)
                        const blob = await res.blob()
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `QRIS-StellerPOS-Rp${planInfo.price}.png`
                        a.click()
                        URL.revokeObjectURL(a.href)
                      } catch {
                        window.open(qrisDisplayUrl, '_blank')
                      }
                    }}
                    className="mt-3 px-5 py-2.5 bg-navy-600 text-white rounded-lg text-sm font-semibold hover:bg-navy-700 transition"
                  >
                    ⬇ Unduh QRIS
                  </button>
                )}
              </div>
            )}
            {(activePayMethod === 'bca' || activePayMethod === 'mandiri' || activePayMethod === 'bni') && (
              <div className="border border-slate-200 rounded-xl p-5 mb-5">
                <p className="text-sm text-gray-600 mb-3">Transfer ke {activePayMethod === 'bca' ? 'BCA' : activePayMethod === 'mandiri' ? 'Mandiri' : 'BNI'}:</p>
                <div className="bg-slate-50 rounded-lg px-4 py-4 mb-3 text-center">
                  <p className="text-sm text-gray-700 mb-3">Nomor rekening / Virtual Account akan diberikan oleh admin. Hubungi kami untuk instruksi pembayaran:</p>
                  <a
                    href="https://wa.me/6285893174442?text=Halo%20Admin%20StellerPOS,%20saya%20ingin%20membayar%20langganan%20via%20transfer%20bank."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
                  >
                    💬 Hubungi Admin via WhatsApp
                  </a>
                </div>
                <p className="text-xs text-gray-500">a.n. PT Steller Indonesia</p>
              </div>
            )}
            {activePayMethod === 'ewallet' && (
              <div className="border border-slate-200 rounded-xl p-5 mb-5">
                <p className="text-sm text-gray-600 mb-3">Kirim ke e-Wallet platform:</p>
                <div className="bg-slate-50 rounded-lg px-4 py-3 mb-3">
                  <p className="text-xs text-gray-500 uppercase">GoPay / OVO / DANA</p>
                  <p className="text-xl font-bold text-gray-900 tracking-widest">0858-9317-4442</p>
                </div>
                <p className="text-xs text-gray-500">a.n. PT Steller Indonesia — Sertakan nama toko di catatan</p>
              </div>
            )}

            {/* Nominal yang dibayar — otomatis terisi sesuai paket */}
            <h3 className="font-bold text-gray-900 mb-3">Nominal yang Dibayar</h3>
            <div className="mb-5">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">Rp</span>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 font-bold text-lg"
                  placeholder="100000"
                />
              </div>
              {paidAmount && parseInt(paidAmount) !== planInfo.price && (
                <p className={`mt-2 text-xs rounded-lg px-3 py-2 border ${
                  parseInt(paidAmount) < planInfo.price
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {parseInt(paidAmount) < planInfo.price
                    ? `⚠️ Nominal kurang Rp ${(planInfo.price - parseInt(paidAmount)).toLocaleString('id-ID')} dari tagihan paket ${activePlan}.`
                    : `⚠️ Nominal lebih Rp ${(parseInt(paidAmount) - planInfo.price).toLocaleString('id-ID')} dari tagihan — kelebihan akan diverifikasi admin.`}
                </p>
              )}
            </div>

            {/* Upload bukti */}
            <h3 className="font-bold text-gray-900 mb-3">Upload Bukti Pembayaran</h3>
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-navy-500 transition mb-5">
              <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
              {proofPreview ? (
                <img src={proofPreview} alt="Bukti Transfer" className="w-40 h-40 mx-auto object-contain rounded-lg" />
              ) : (
                <div>
                  <span className="text-3xl">🧾</span>
                  <p className="text-sm text-gray-500 mt-2">Klik untuk upload screenshot/bukti transfer</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG (maks 2MB)</p>
                </div>
              )}
            </label>

            {message && (
              <div className={`mb-4 text-sm px-4 py-3 rounded-lg border ${
                message.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                {message}
              </div>
            )}

            <button
              onClick={handleConfirmPayment}
              disabled={isSubmitting}
              className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Mengirim...' : `✅ Konfirmasi Pembayaran — Rp ${planInfo.price.toLocaleString('id-ID')}`}
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">
              Setelah bukti dikirim, Super Admin akan memverifikasi dan mengaktifkan langganan Anda.
            </p>

            <div className="text-center mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => { sessionStorage.removeItem('merchantSession'); navigate('/') }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Keluar & kembali nanti
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-6 text-sm text-gray-500">
          Sudah punya akun aktif? <Link to="/login" className="text-navy-600 font-semibold">Login di sini</Link>
        </div>
      </main>
    </div>
  )
}

export default SubscriptionPayment
