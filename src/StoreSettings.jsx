import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { supabase } from './supabaseClient'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientSettings" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientSettings" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowSettings">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowSettings)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientSettings)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientSettings)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientSettings)" letter-spacing="0.5">Steller</text>
  </svg>
)

const DEFAULT_SETTINGS = {
  general: {
    storeName: 'Toko Sinar Rejeki',
    ownerName: '',
    email: '',
    whatsapp: '',
    address: '',
    currency: 'IDR (Rupiah)',
  },
  payment: { tunai: true, qris: true, transfer: true },
  printer: {
    type: 'Thermal 58mm',
    paper: '58mm x 200mm',
    autoPrint: true,
    whatsappReceipt: true,
  },
  tax: {
    ppnEnabled: false,
    ppnRate: 11,
    localTaxEnabled: false,
    localTaxRate: 0,
  },
}

const loadSettings = (storageKey) => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (!saved) return DEFAULT_SETTINGS
    return {
      general: { ...DEFAULT_SETTINGS.general, ...saved.general },
      payment: { ...DEFAULT_SETTINGS.payment, ...saved.payment },
      printer: { ...DEFAULT_SETTINGS.printer, ...saved.printer },
      tax: { ...DEFAULT_SETTINGS.tax, ...saved.tax },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function StoreSettings() {
  const navigate = useNavigate()

  // Merchant yang belum aktif tidak boleh membuka pengaturan
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s && s.status !== 'active') navigate('/subscription-payment')
    } catch { /* akun demo tanpa sesi merchant */ }
  }, [navigate])

  // Pengaturan tersimpan terpisah per merchant (demo = key generik)
  const merchantId = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession'))?.id || null } catch { return null }
  })()
  const settingsKey = merchantId ? `storeSettings_${merchantId}` : 'storeSettings'
  const qrKey = merchantId ? `storeQrCode_${merchantId}` : 'storeQrCode'
  const avatarKey = merchantId ? `ownerAvatar_${merchantId}` : 'ownerAvatar_demo'

  // Isi form dengan data asli merchant dari tabel merchants (bukan hardcode)
  useEffect(() => {
    if (!merchantId) return
    supabase.from('merchants')
      .select('store_name, owner_name, email, whatsapp, address, avatar_url, qris_url, qris_payload')
      .eq('id', merchantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.avatar_url) setAvatarPreview(data.avatar_url)
        if (data.qris_url) setQrCodePreview(data.qris_url)
        if (data.qris_payload) setQrisPayload(data.qris_payload)
        setSettings(prev => ({
          ...prev,
          general: {
            ...prev.general,
            storeName: data.store_name || prev.general.storeName,
            ownerName: data.owner_name || '',
            email: data.email || '',
            whatsapp: data.whatsapp || '',
            address: data.address || '',
          },
        }))
      })
  }, [merchantId])

  const handleMenuClick = (path) => {
    if (path === '/pos') {
      const m = (() => { try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null } })()
      sessionStorage.setItem('cashierLoggedIn', 'true')
      sessionStorage.setItem('cashierName', m?.ownerName || 'Rifky Arya Firdaus')
      sessionStorage.setItem('cashierOutlet', m?.storeName || 'Pusat - Malioboro')
      sessionStorage.setItem('cashierRole', 'Owner')
    }
    navigate(path)
  }

  const [activeTab, setActiveTab] = useState('general')
  const [qrCode, setQrCode] = useState(null)
  const [qrCodePreview, setQrCodePreview] = useState(() => localStorage.getItem(qrKey) || '')
  const [qrisPayload, setQrisPayload] = useState('')
  const [qrDecodeMsg, setQrDecodeMsg] = useState('')

  // Decode gambar QR → ambil payload EMV mentah agar QRIS kasir bisa dinamis ber-nominal
  const decodeQrPayload = (file) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const decoded = jsQR(data, width, height)
      URL.revokeObjectURL(img.src)
      resolve(decoded?.data || null)
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
  const [settings, setSettings] = useState(() => loadSettings(settingsKey))
  const [isSaved, setIsSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      return s?.avatar || localStorage.getItem(avatarKey) || ''
    } catch { return localStorage.getItem(avatarKey) || '' }
  })
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  // Ulasan & rating aplikasi — satu ulasan per merchant (tabel reviews)
  const [review, setReview] = useState({ rating: 0, message: '' })
  const [reviewExists, setReviewExists] = useState(false)
  const [reviewMsg, setReviewMsg] = useState({ text: '', ok: false })
  const [reviewSaving, setReviewSaving] = useState(false)

  // Muat ulasan merchant ini jika sudah pernah memberi ulasan
  useEffect(() => {
    if (!merchantId) return
    supabase.from('reviews')
      .select('rating, message')
      .eq('merchant_id', merchantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setReview({ rating: data.rating, message: data.message })
          setReviewExists(true)
        }
      })
  }, [merchantId])

  const handleSubmitReview = async () => {
    setReviewMsg({ text: '', ok: false })
    if (!merchantId) {
      setReviewMsg({ text: 'Mode demo tidak dapat mengirim ulasan. Silakan login sebagai owner.', ok: false })
      return
    }
    if (review.rating < 1 || review.rating > 5) {
      setReviewMsg({ text: 'Pilih rating bintang 1 sampai 5 dulu!', ok: false })
      return
    }
    if (!review.message.trim()) {
      setReviewMsg({ text: 'Tulis ulasan Anda terlebih dahulu!', ok: false })
      return
    }
    setReviewSaving(true)
    const { error } = await supabase.from('reviews').upsert(
      { merchant_id: merchantId, rating: review.rating, message: review.message.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'merchant_id' }
    )
    setReviewSaving(false)
    if (error) {
      setReviewMsg({ text: 'Gagal menyimpan ulasan: ' + error.message, ok: false })
    } else {
      setReviewExists(true)
      setReviewMsg({ text: reviewExists ? 'Ulasan berhasil diperbarui ✓' : 'Terima kasih! Ulasan Anda berhasil dikirim ✓', ok: true })
    }
  }

  // Kompres foto ke 160px agar hemat penyimpanan
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('File harus berupa gambar!'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 160
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const min = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size)
        setAvatarPreview(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const [pwdMsg, setPwdMsg] = useState({ text: '', ok: false })
  const [pwdSaving, setPwdSaving] = useState(false)

  const handleChangePassword = async () => {
    setPwdMsg({ text: '', ok: false })
    if (!merchantId) {
      setPwdMsg({ text: 'Mode demo tidak dapat mengubah kata sandi.', ok: false })
      return
    }
    if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      setPwdMsg({ text: 'Semua field sandi wajib diisi!', ok: false })
      return
    }
    if (pwdForm.newPassword.length < 8 || !/[A-Za-z]/.test(pwdForm.newPassword) || !/\d/.test(pwdForm.newPassword)) {
      setPwdMsg({ text: 'Sandi baru harus minimal 8 karakter dan mengandung kombinasi huruf & angka!', ok: false })
      return
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ text: 'Konfirmasi sandi baru tidak cocok!', ok: false })
      return
    }
    setPwdSaving(true)
    const { data } = await supabase.from('merchants').select('password').eq('id', merchantId).maybeSingle()
    if (data?.password && data.password !== pwdForm.oldPassword) {
      setPwdSaving(false)
      setPwdMsg({ text: 'Sandi lama salah!', ok: false })
      return
    }
    const { error } = await supabase.from('merchants').update({ password: pwdForm.newPassword }).eq('id', merchantId)
    setPwdSaving(false)
    if (error) {
      setPwdMsg({ text: 'Gagal mengubah sandi: ' + error.message, ok: false })
    } else {
      setPwdMsg({ text: 'Kata sandi berhasil diperbarui ✓', ok: true })
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    }
  }

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
    setIsSaved(false)
  }

  const handleSave = async () => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings))
      if (qrCodePreview) {
        localStorage.setItem(qrKey, qrCodePreview)
      } else {
        localStorage.removeItem(qrKey)
      }
      if (avatarPreview) {
        localStorage.setItem(avatarKey, avatarPreview)
      } else {
        localStorage.removeItem(avatarKey)
      }
    } catch {
      alert('Gagal menyimpan pengaturan. Ukuran QR code mungkin terlalu besar.')
      return
    }

    // Sinkronkan data identitas toko ke tabel merchants di Supabase
    if (merchantId) {
      const newEmail = (settings.general.email || '').trim().toLowerCase()
      const { error: mErr } = await supabase.from('merchants').update({
        store_name: settings.general.storeName.trim(),
        owner_name: settings.general.ownerName.trim(),
        email: newEmail,
        whatsapp: settings.general.whatsapp.trim(),
        address: settings.general.address.trim(),
        avatar_url: avatarPreview || null,
        qris_url: qrCodePreview || null,
        qris_payload: qrisPayload.trim() || null,
      }).eq('id', merchantId)
      if (mErr) {
        alert(mErr.code === '23505' || mErr.message?.includes('duplicate')
          ? 'Email ini sudah dipakai merchant lain. Data lokal tersimpan, tapi email tidak berubah.'
          : 'Data lokal tersimpan, tetapi gagal update merchant: ' + mErr.message)
      } else {
        // Sinkronkan sesi agar header dashboard ikut berubah
        try {
          const s = JSON.parse(sessionStorage.getItem('merchantSession'))
          if (s) {
            sessionStorage.setItem('merchantSession', JSON.stringify({
              ...s,
              storeName: settings.general.storeName.trim(),
              ownerName: settings.general.ownerName.trim(),
              email: newEmail,
              avatar: avatarPreview || '',
            }))
          }
        } catch { /* ignore */ }
      }
    }

    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const menuItems = [
    { icon: '📊', label: 'Beranda / Ringkasan', active: false, path: '/dashboard' },
    { icon: '🛒', label: 'Terminal Kasir', active: false, path: '/pos' },
    { icon: '📦', label: 'Inventaris Produk', active: false, path: '/inventory' },
    { icon: '📈', label: 'Laporan Penjualan', active: false, path: '/reports' },
    { icon: '👥', label: 'Manajemen Karyawan', active: false, path: '/employees' },
    { icon: '⚙️', label: 'Pengaturan Toko', active: true, path: '/settings' },
  ]

  const tabs = [
    { id: 'general', label: 'Umum', icon: '🏪' },
    { id: 'payment', label: 'Pembayaran', icon: '💳' },
    { id: 'printer', label: 'Printer', icon: '🖨️' },
    { id: 'tax', label: 'Pajak', icon: '📋' },
    { id: 'review', label: 'Ulasan', icon: '⭐' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center">
            <StellerLogo className="w-32 h-10" />
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleMenuClick(item.path)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition w-full text-left ${
                item.active
                  ? 'bg-navy-600 text-white'
                  : 'text-gray-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <button
            onClick={() => {
              sessionStorage.removeItem('merchantSession')
              sessionStorage.removeItem('cashierLoggedIn')
              sessionStorage.removeItem('cashierName')
              sessionStorage.removeItem('cashierOutlet')
              sessionStorage.removeItem('cashierRole')
              navigate('/')
            }}
            className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-slate-100 rounded-lg transition w-full"
          >
            <span className="text-xl">🚪</span>
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">⚙️ Pengaturan Toko</h1>
              <p className="text-sm text-gray-500">Konfigurasi toko Anda</p>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition font-medium text-white ${
                isSaved ? 'bg-green-700 ring-2 ring-green-300' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <span>{isSaved ? '✓' : '💾'}</span>
              <span>{isSaved ? 'Tersimpan!' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </header>

        {/* Settings Content */}
        <div className="p-8">
          {/* Settings Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex space-x-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-navy-600 text-white'
                      : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Settings Form */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Foto Profil Owner */}
                <div className="flex items-center space-x-5">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Foto profil" className="w-20 h-20 rounded-full object-cover border-2 border-navy-200" />
                  ) : (
                    <div className="w-20 h-20 bg-navy-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                      {(settings.general.ownerName || 'O').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Foto Profil Owner</label>
                    <div className="flex items-center space-x-2">
                      <label className="px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition text-sm font-medium cursor-pointer">
                        📷 Ubah Foto
                        <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                      </label>
                      {avatarPreview && (
                        <button
                          onClick={() => setAvatarPreview('')}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">JPG/PNG — otomatis dikompres ke 160px, tersimpan saat klik Simpan Perubahan.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Toko</label>
                  <input
                    type="text"
                    value={settings.general.storeName}
                    onChange={(e) => updateSetting('general', 'storeName', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Pemilik</label>
                  <input
                    type="text"
                    value={settings.general.ownerName}
                    onChange={(e) => updateSetting('general', 'ownerName', e.target.value)}
                    placeholder="Nama pemilik usaha"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Bisnis</label>
                    <input
                      type="email"
                      value={settings.general.email}
                      onChange={(e) => updateSetting('general', 'email', e.target.value)}
                      placeholder="email@toko.com"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">No. WhatsApp</label>
                    <input
                      type="text"
                      value={settings.general.whatsapp}
                      onChange={(e) => updateSetting('general', 'whatsapp', e.target.value)}
                      placeholder="+62 812-3456-7890"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alamat Toko</label>
                  <textarea
                    value={settings.general.address}
                    onChange={(e) => updateSetting('general', 'address', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mata Uang</label>
                  <select
                    value={settings.general.currency}
                    onChange={(e) => updateSetting('general', 'currency', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    <option>IDR (Rupiah)</option>
                    <option>USD (Dollar)</option>
                    <option>EUR (Euro)</option>
                  </select>
                </div>

                {/* Email akun terdaftar */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Email akun terdaftar</p>
                    <p className="text-sm font-semibold text-gray-800">{settings.general.email || '-'}</p>
                  </div>
                  <span className="text-xs bg-navy-100 text-navy-700 px-3 py-1 rounded-full font-medium">Login Owner</span>
                </div>

                {/* Ubah Kata Sandi */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">🔐 Ubah Kata Sandi</h3>
                  <p className="text-sm text-gray-500 mb-4">Perbarui kata sandi akun owner Anda. Perubahan langsung tersimpan ke database.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sandi Lama</label>
                      <input
                        type="password"
                        value={pwdForm.oldPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                        placeholder="Masukkan sandi saat ini"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sandi Baru</label>
                        <input
                          type="password"
                          value={pwdForm.newPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                          placeholder="Min. 8 karakter, huruf & angka"
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Sandi Baru</label>
                        <input
                          type="password"
                          value={pwdForm.confirmPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                          placeholder="Ulangi sandi baru"
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                    </div>
                    {pwdMsg.text && (
                      <div className={`text-sm px-4 py-3 rounded-lg border font-medium ${
                        pwdMsg.ok
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        {pwdMsg.ok ? '✅' : '⚠️'} {pwdMsg.text}
                      </div>
                    )}
                    <button
                      onClick={handleChangePassword}
                      disabled={pwdSaving}
                      className="px-6 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium disabled:opacity-60"
                    >
                      {pwdSaving ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-500">Klik metode untuk mengaktifkan/menonaktifkan. Metode nonaktif tidak akan muncul di Terminal Kasir.</p>
                {[
                  { key: 'tunai', icon: '💵', label: 'Tunai', desc: 'Pembayaran uang tunai' },
                  { key: 'qris', icon: '📱', label: 'QRIS', desc: 'Pembayaran QRIS' },
                  { key: 'transfer', icon: '🏦', label: 'Transfer Bank', desc: 'Transfer via virtual account' },
                ].map((method) => (
                  <button
                    key={method.key}
                    onClick={() => updateSetting('payment', method.key, !settings.payment[method.key])}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition border-2 ${
                      settings.payment[method.key]
                        ? 'bg-slate-50 border-transparent hover:border-navy-300'
                        : 'bg-slate-50 border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3 text-left">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <h3 className="font-bold text-gray-900">{method.label}</h3>
                        <p className="text-sm text-gray-500">{method.desc}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      settings.payment[method.key]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {settings.payment[method.key] ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </button>
                ))}

                {/* QR Code Upload Section */}
                <div className="border-t border-slate-200 pt-6 mt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📱 Upload Kode QR Pembayaran</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Gambar QR Code</label>
                      <label className="block border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-navy-500 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0]
                            if (!file) return
                            if (!file.type.startsWith('image/')) { alert('File harus berupa gambar!'); return }
                            // Auto-decode payload QRIS dari gambar → QR kasir jadi dinamis ber-nominal
                            const payload = await decodeQrPayload(file)
                            if (payload && payload.startsWith('000201')) {
                              setQrisPayload(payload)
                              setQrDecodeMsg('✅ Payload QRIS terbaca — kasir akan menampilkan QR dinamis ber-nominal otomatis.')
                            } else {
                              setQrDecodeMsg('⚠️ Gambar terupload tapi payload QRIS tidak terbaca — gunakan gambar QR yang lebih tajam agar QR dinamis aktif.')
                            }
                            const reader = new FileReader()
                            reader.onload = () => {
                              const img = new Image()
                              img.onload = () => {
                                // Kompres ke maks. 600px agar muat disimpan sebagai data URL
                                const size = Math.min(600, Math.max(img.width, img.height))
                                const canvas = document.createElement('canvas')
                                const scale = size / Math.max(img.width, img.height)
                                canvas.width = Math.round(img.width * scale)
                                canvas.height = Math.round(img.height * scale)
                                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                                setQrCodePreview(canvas.toDataURL('image/png'))
                              }
                              img.src = reader.result
                            }
                            reader.readAsDataURL(file)
                            setQrCode(file)
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                        {qrCodePreview ? (
                          <img src={qrCodePreview} alt="QR Preview" className="w-48 h-48 mx-auto mb-4 object-contain" />
                        ) : (
                          <div className="mb-4">
                            <span className="text-4xl">📷</span>
                            <p className="text-sm text-gray-500 mt-2">Klik untuk upload QR code</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">Format: PNG, JPG, JPEG — klik kotak ini untuk memilih file</p>
                      </label>
                      {qrDecodeMsg && (
                        <p className={`text-xs mt-2 font-medium ${qrDecodeMsg.startsWith('✅') ? 'text-green-600' : 'text-amber-600'}`}>
                          {qrDecodeMsg}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Preview QR Code</label>
                      <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                        {qrCodePreview ? (
                          <img src={qrCodePreview} alt="QR Code" className="w-48 h-48 object-contain" />
                        ) : (
                          <div className="text-center text-gray-400">
                            <span className="text-4xl">📱</span>
                            <p className="text-sm mt-2">QR Code akan muncul di sini</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setQrCode(null)
                          setQrCodePreview('')
                        }}
                        className="w-full mt-4 px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                      >
                        Hapus QR Code
                      </button>
                    </div>
                  </div>

                  {/* Payload QRIS — untuk QR dinamis ber-nominal otomatis di kasir */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kode QRIS (payload) <span className="text-gray-400 font-normal">— opsional</span>
                    </label>
                    <textarea
                      rows={3}
                      value={qrisPayload}
                      onChange={(e) => setQrisPayload(e.target.value)}
                      placeholder="00020101021126680022ID.CO..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 font-mono text-xs"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      💡 Scan QRIS Anda dengan aplikasi pemindai QR untuk menyalin teks ini (diawali <span className="font-mono">000201</span>).
                      Jika diisi, kasir akan menampilkan <span className="font-semibold">QRIS dinamis</span> dengan nominal tagihan yang sudah tertanam otomatis — pembeli tidak perlu mengetik nominal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Printer</label>
                  <select
                    value={settings.printer.type}
                    onChange={(e) => updateSetting('printer', 'type', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    <option>Thermal 58mm</option>
                    <option>Thermal 80mm</option>
                    <option>Bluetooth Printer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kertas Struk</label>
                  <select
                    value={settings.printer.paper}
                    onChange={(e) => updateSetting('printer', 'paper', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    <option>58mm x 200mm</option>
                    <option>80mm x 200mm</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Lebar ini otomatis diterapkan saat kasir menekan "Cetak Struk" — dialog print langsung menyesuaikan ukuran kertas, tanpa header/footer browser.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.printer.autoPrint}
                    onChange={(e) => updateSetting('printer', 'autoPrint', e.target.checked)}
                    className="w-5 h-5 text-navy-600 rounded"
                  />
                  <label className="text-sm text-gray-700">Cetak struk otomatis setelah transaksi</label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.printer.whatsappReceipt}
                    onChange={(e) => updateSetting('printer', 'whatsappReceipt', e.target.checked)}
                    className="w-5 h-5 text-navy-600 rounded"
                  />
                  <label className="text-sm text-gray-700">Kirim struk via WhatsApp</label>
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-500">Tarif pajak di sini akan langsung dipakai pada perhitungan total di Terminal Kasir.</p>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.tax.ppnEnabled}
                    onChange={(e) => updateSetting('tax', 'ppnEnabled', e.target.checked)}
                    className="w-5 h-5 text-navy-600 rounded"
                  />
                  <label className="text-sm text-gray-700">Aktifkan PPN (Pajak Pertambahan Nilai)</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarif PPN (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.tax.ppnRate}
                    onChange={(e) => updateSetting('tax', 'ppnRate', e.target.value)}
                    disabled={!settings.tax.ppnEnabled}
                    className={`w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 ${
                      !settings.tax.ppnEnabled ? 'bg-slate-100 text-gray-400 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.tax.localTaxEnabled}
                    onChange={(e) => updateSetting('tax', 'localTaxEnabled', e.target.checked)}
                    className="w-5 h-5 text-navy-600 rounded"
                  />
                  <label className="text-sm text-gray-700">Aktifkan Pajak Daerah</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarif Pajak Daerah (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.tax.localTaxRate}
                    onChange={(e) => updateSetting('tax', 'localTaxRate', e.target.value)}
                    disabled={!settings.tax.localTaxEnabled}
                    className={`w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 ${
                      !settings.tax.localTaxEnabled ? 'bg-slate-100 text-gray-400 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            )}

            {activeTab === 'review' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">⭐ Ulasan & Rating Aplikasi</h3>
                  <p className="text-sm text-gray-500">
                    Bagikan pengalaman Anda menggunakan StellerPOS. Ulasan Anda akan tampil sebagai testimoni di halaman utama.
                  </p>
                </div>

                {!merchantId && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
                    ℹ️ Anda sedang dalam mode demo — login sebagai owner untuk mengirim ulasan.
                  </div>
                )}

                {reviewExists && merchantId && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                    ✅ Anda sudah memberikan ulasan — ubah rating atau pesan di bawah lalu simpan untuk memperbarui.
                  </div>
                )}

                {/* Pilih Rating Bintang */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating Aplikasi *</label>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReview({ ...review, rating: star })}
                        disabled={!merchantId}
                        className="text-3xl transition hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`${star} bintang`}
                      >
                        <svg
                          className={`w-9 h-9 ${review.rating >= star ? 'text-amber-400' : 'text-slate-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                    <span className="ml-3 text-sm font-medium text-gray-600">
                      {review.rating > 0 ? `${review.rating} dari 5 bintang` : 'Klik bintang untuk menilai'}
                    </span>
                  </div>
                </div>

                {/* Pesan Ulasan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ulasan Anda *</label>
                  <textarea
                    rows={5}
                    value={review.message}
                    onChange={(e) => setReview({ ...review, message: e.target.value })}
                    disabled={!merchantId}
                    placeholder="Ceritakan pengalaman Anda memakai StellerPOS — fitur yang membantu, kemudahan penggunaan, dsb."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 disabled:bg-slate-100 disabled:text-gray-400"
                  />
                </div>

                {reviewMsg.text && (
                  <div className={`text-sm px-4 py-3 rounded-lg border font-medium ${
                    reviewMsg.ok
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {reviewMsg.ok ? '✅' : '⚠️'} {reviewMsg.text}
                  </div>
                )}

                <button
                  onClick={handleSubmitReview}
                  disabled={reviewSaving || !merchantId}
                  className="px-6 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium disabled:opacity-60"
                >
                  {reviewSaving ? 'Mengirim...' : reviewExists ? '💾 Perbarui Ulasan' : '📨 Kirim Ulasan'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default StoreSettings
