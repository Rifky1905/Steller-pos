import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from './supabaseClient'
import { buildDynamicQris } from './qris'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientPOS" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientPOS" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowPOS">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowPOS)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientPOS)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientPOS)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientPOS)" letter-spacing="0.5">Steller</text>
  </svg>
)

function POS() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [trxCode, setTrxCode] = useState(() => `TRX-${Math.floor(10000 + Math.random() * 90000)}`)
  const merchantSession = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null }
  })()
  // merchantId: dari sesi owner, atau dari toko pemilik akun kasir yang login
  const merchantId = merchantSession?.id || sessionStorage.getItem('cashierMerchantId') || null
  const cashierName = sessionStorage.getItem('cashierName') || 'Kasir'
  // Outlet selalu mengikuti nama toko merchant yang login; fallback ke sesi kasir/demo
  const cashierOutlet = merchantSession?.storeName || sessionStorage.getItem('cashierOutlet') || 'Pusat - Malioboro'
  const cashierRole = sessionStorage.getItem('cashierRole') || 'Kasir'
  const scope = (q) => merchantId ? q.eq('merchant_id', merchantId) : q.is('merchant_id', null)

  useEffect(() => {
    if (!sessionStorage.getItem('cashierLoggedIn')) {
      navigate('/login')
      return
    }
    // Merchant yang belum aktif tidak boleh memakai POS
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s && s.status !== 'active') navigate('/subscription-payment')
    } catch { /* akun demo tanpa sesi merchant */ }
  }, [navigate])

  const clearCashierSession = () => {
    sessionStorage.removeItem('cashierLoggedIn')
    sessionStorage.removeItem('cashierName')
    sessionStorage.removeItem('cashierOutlet')
    sessionStorage.removeItem('cashierRole')
  }

  const handleExitShift = () => {
    clearCashierSession()
    navigate('/')
  }

  const handleBackToDashboard = () => {
    clearCashierSession()
    navigate('/dashboard')
  }
  // Pengaturan toko yang disimpan dari halaman Pengaturan (localStorage, per-merchant)
  const settingsKey = merchantId ? `storeSettings_${merchantId}` : 'storeSettings'
  const qrKey = merchantId ? `storeQrCode_${merchantId}` : 'storeQrCode'
  const savedSettings = (() => {
    try { return JSON.parse(localStorage.getItem(settingsKey)) || {} } catch { return {} }
  })()
  const paymentEnabled = savedSettings.payment || {}
  const taxCfg = savedSettings.tax || {}
  const ppnRate = taxCfg.ppnEnabled === true ? (parseFloat(taxCfg.ppnRate) || 0) : 0
  const daerahRate = taxCfg.localTaxEnabled ? (parseFloat(taxCfg.localTaxRate) || 0) : 0
  const effectiveTaxRate = ppnRate + daerahRate
  // Ukuran kertas thermal dari Pengaturan Toko → diterapkan ke @page & lebar struk
  const printerCfg = savedSettings.printer || {}
  const paperWidth = (printerCfg.paper || '58mm').startsWith('80') ? '80mm' : '58mm'
  const autoPrintEnabled = printerCfg.autoPrint !== false
  const [storeQrCode, setStoreQrCode] = useState(() => localStorage.getItem(qrKey) || '')
  const [qrisPayload, setQrisPayload] = useState('')
  const [dynamicQrSrc, setDynamicQrSrc] = useState('')
  // Ambil QR pembayaran milik toko dari Supabase (tersinkron di semua perangkat)
  useEffect(() => {
    if (!merchantId) return
    supabase.from('merchants')
      .select('qris_url, qris_payload')
      .eq('id', merchantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.qris_url) setStoreQrCode(data.qris_url)
        if (data?.qris_payload) setQrisPayload(data.qris_payload)
      })
  }, [merchantId])

  const paymentOptions = [
    { key: 'tunai', label: '💵 Tunai' },
    { key: 'qris', label: '📱 QRIS' },
    { key: 'transfer', label: '🏦 Transfer' },
  ].filter(o => paymentEnabled[o.key] !== false)
  if (paymentOptions.length === 0) paymentOptions.push({ key: 'tunai', label: '💵 Tunai' })

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].key)
  const [cashAmount, setCashAmount] = useState('')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState(['all'])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showQrisModal, setShowQrisModal] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [reviewPending, setReviewPending] = useState(false)
  // Pop-up ulasan setelah transaksi pertama toko
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewMessage, setReviewMessage] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewSent, setReviewSent] = useState(false)

  const categoryEmoji = {
    'Sembako': '🍚', 'Minuman': '🥤', 'Makanan': '🍜',
    'Toiletries': '🧼', 'Suku Cadang': '🔧', 'Elektronik': '🔌',
  }

  const productEmoji = (name, category) => {
    const n = name.toLowerCase()
    if (n.includes('beras')) return '🍚'
    if (n.includes('minyak')) return '🫗'
    if (n.includes('gula')) return '🍬'
    if (n.includes('telur')) return '🥚'
    if (n.includes('kopi')) return '☕'
    if (n.includes('teh')) return '�'
    if (n.includes('mie') || n.includes('indomie')) return '🍜'
    if (n.includes('sabun')) return '🧼'
    if (n.includes('pasta') || n.includes('pepsodent')) return '🦷'
    if (n.includes('baut')) return '🔩'
    if (n.includes('kampas')) return '🔧'
    if (n.includes('kabel')) return '🔌'
    if (n.includes('mouse')) return '🖱️'
    return categoryEmoji[category] || '📦'
  }

  const fetchProducts = async () => {
    const { data, error } = await scope(
      supabase.from('products').select('*, categories(name)').order('id')
    )
    if (error) {
      console.error('[POS] Gagal memuat produk:', error)
      setProductsError(error.message)
      // Fallback: coba tanpa join kategori (jika relasi/FK categories bermasalah)
      const { data: plain, error: plainErr } = await scope(
        supabase.from('products').select('*').order('id')
      )
      if (!plainErr && plain) {
        setProducts(plain.map(p => ({
          id: p.id,
          name: p.name,
          category: 'Lainnya',
          weight: p.weight,
          price: Number(p.sell_price),
          stock: p.stock,
          image: productEmoji(p.name),
        })))
        setProductsError('')
      }
      setIsLoadingProducts(false)
      return
    }
    if (data) {
      setProducts(data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.categories?.name || 'Lainnya',
        weight: p.weight,
        price: Number(p.sell_price),
        stock: p.stock,
        image: productEmoji(p.name, p.categories?.name),
      })))
    }
    setIsLoadingProducts(false)
  }

  const fetchCategories = async () => {
    const { data } = await scope(supabase.from('categories').select('name').order('name'))
    if (data) {
      // Anti-duplikasi nama kategori (case-insensitive)
      const seen = new Set()
      const unique = data.filter(c => {
        const key = c.name.trim().toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setCategories(['all', ...unique.map(c => c.name)])
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    const channel = supabase
      .channel('pos-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert(`Stok ${product.name} habis!`)
      return
    }
    const existingItem = cart.find(item => item.id === product.id)
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert(`Stok ${product.name} tersisa ${product.stock}`)
        return
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const updateQuantity = (id, change) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, Math.min(item.stock, item.quantity + change))
        return { ...item, quantity: newQuantity }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
    setCashAmount('')
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (activeMethod === 'tunai' && (!cashAmount || parseInt(cashAmount) < total)) {
      alert('Uang bayar pelanggan kurang dari total tagihan!')
      return
    }
    setIsCheckingOut(true)

    const { data: trx, error: trxError } = await supabase
      .from('transactions')
      .insert({
        trx_code: trxCode,
        cashier_name: cashierName,
        payment_method: activeMethod,
        subtotal,
        discount,
        tax,
        total,
        cash_paid: activeMethod === 'tunai' ? parseInt(cashAmount) : total,
        change_amount: activeMethod === 'tunai' ? Math.max(0, parseInt(cashAmount) - total) : 0,
        merchant_id: merchantId,
      })
      .select()
      .single()

    if (trxError || !trx) {
      alert('Gagal menyimpan transaksi: ' + (trxError?.message || 'Unknown error'))
      setIsCheckingOut(false)
      return
    }

    await supabase.from('transaction_items').insert(
      cart.map(item => ({
        transaction_id: trx.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      }))
    )

    await Promise.all(cart.map(item => {
      const product = products.find(p => p.id === item.id)
      if (!product) return Promise.resolve()
      return supabase
        .from('products')
        .update({ stock: Math.max(0, product.stock - item.quantity) })
        .eq('id', item.id)
    }))

    const change = activeMethod === 'tunai' ? parseInt(cashAmount) - total : 0
    // Struk otomatis — tampilkan modal struk yang bisa langsung dicetak
    setLastReceipt({
      code: trxCode,
      date: new Date(),
      items: cart,
      subtotal, discount, tax, total,
      method: activeMethod,
      cashPaid: activeMethod === 'tunai' ? parseInt(cashAmount) : total,
      change,
      cashier: cashierName,
      store: cashierOutlet,
    })
    clearCart()
    setTrxCode(`TRX-${Math.floor(10000 + Math.random() * 90000)}`)
    setIsCheckingOut(false)

    // Transaksi pertama toko nyata → ajak owner memberi ulasan (sekali saja)
    if (merchantId && !localStorage.getItem(`reviewPrompted_${merchantId}`)) {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
      if (count === 1) {
        localStorage.setItem(`reviewPrompted_${merchantId}`, '1')
        setReviewPending(true)
      }
    }
  }

  const closeReceipt = () => {
    setLastReceipt(null)
    if (reviewPending) {
      setReviewPending(false)
      setShowReviewModal(true)
    }
  }

  const printReceipt = () => window.print()

  // Auto-print: langsung buka dialog cetak saat struk muncul (jika diaktifkan di Pengaturan)
  useEffect(() => {
    if (lastReceipt && autoPrintEnabled) {
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [lastReceipt, autoPrintEnabled])

  const submitReview = async () => {
    if (!reviewRating || !reviewMessage.trim() || isSubmittingReview) return
    setIsSubmittingReview(true)
    const { error } = await supabase
      .from('reviews')
      .upsert(
        { merchant_id: merchantId, rating: reviewRating, message: reviewMessage.trim() },
        { onConflict: 'merchant_id' }
      )
    setIsSubmittingReview(false)
    if (error) {
      alert('Gagal mengirim ulasan: ' + error.message)
      return
    }
    setReviewSent(true)
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const discount = 0
  const tax = Math.round(subtotal * effectiveTaxRate / 100)
  const total = subtotal - discount + tax
  const activeMethod = paymentOptions.some(o => o.key === paymentMethod) ? paymentMethod : paymentOptions[0].key

  // Saat modal QRIS dibuka: bangkitkan QR dinamis dengan nominal = total tagihan
  useEffect(() => {
    if (!showQrisModal || !qrisPayload) { setDynamicQrSrc(''); return }
    const dynPayload = buildDynamicQris(qrisPayload, total)
    if (!dynPayload) { setDynamicQrSrc(''); return }
    QRCode.toDataURL(dynPayload, { width: 420, margin: 1 })
      .then(setDynamicQrSrc)
      .catch(() => setDynamicQrSrc(''))
  }, [showQrisModal, qrisPayload, total])

  const quickCashAmounts = ['Uang Pas', '20000', '50000', '100000', '200000', '500000']

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* @page dinamis — lebar kertas mengikuti pengaturan printer merchant (58mm/80mm), margin 0 membuang header/footer browser */}
      <style>{`@page { size: ${paperWidth} auto; margin: 0; }`}</style>
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <StellerLogo className="w-28 sm:w-40 h-10 shrink-0" />
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-base sm:text-lg font-semibold text-gray-900">Steller POS</span>
              <span className="text-sm text-gray-500 hidden sm:inline">|</span>
              <span className="text-sm text-gray-600">Kasir: {cashierName}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${cashierRole === 'Owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{cashierRole}</span>
              <span className="text-xs px-2 py-1 bg-navy-50 text-navy-700 rounded-full font-medium truncate max-w-[140px] sm:max-w-none">{cashierOutlet}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {cashierRole === 'Owner' ? (
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition text-sm font-semibold flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Kembali ke Dashboard</span>
              </button>
            ) : (
              <button
                onClick={handleExitShift}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-semibold flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Exit Shift</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Split Screen (menumpuk vertikal di HP, berdampingan di laptop) */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Left Column - Product Catalog (65%) */}
        <div className="w-full lg:w-[65%] flex flex-col p-4 sm:p-6 lg:overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Cari nama produk atau scan barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
                <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                      selectedCategory === category
                        ? 'bg-navy-600 text-white'
                        : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                    }`}
                  >
                    {category === 'all' ? 'Semua' : category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="lg:flex-1 lg:overflow-y-auto">
            {isLoadingProducts ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm">Memuat produk dari database...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <span className="text-4xl mb-2">📦</span>
                {productsError ? (
                  <>
                    <p className="text-sm font-medium text-red-600">Gagal memuat produk</p>
                    <p className="text-xs text-red-400 mt-1 max-w-xs text-center">{productsError}</p>
                    <button
                      onClick={() => { setIsLoadingProducts(true); fetchProducts() }}
                      className="mt-3 px-4 py-2 bg-navy-600 text-white rounded-lg text-xs font-semibold hover:bg-navy-700 transition"
                    >
                      🔄 Coba Lagi
                    </button>
                  </>
                ) : products.length === 0 ? (
                  <>
                    <p className="text-sm font-medium">Katalog toko ini masih kosong</p>
                    <p className="text-xs text-gray-400 mt-1">Tambahkan produk melalui menu Inventaris Produk</p>
                    <button
                      onClick={() => navigate('/inventory')}
                      className="mt-3 px-4 py-2 bg-navy-600 text-white rounded-lg text-xs font-semibold hover:bg-navy-700 transition"
                    >
                      📦 Buka Inventaris
                    </button>
                  </>
                ) : (
                  <p className="text-sm">Tidak ada produk ditemukan</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition ${
                      product.stock <= 0
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-md hover:border-navy-300 cursor-pointer'
                    }`}
                  >
                    <div className="aspect-square bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-4xl">
                      {product.image}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                      {product.name}{product.weight ? ` ${product.weight}` : ''}
                    </h3>
                    <p className="text-navy-600 font-bold text-lg mb-1">Rp {product.price.toLocaleString('id-ID')}</p>
                    <p className={`text-xs ${product.stock <= 0 ? 'text-red-600 font-bold' : product.stock < 10 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {product.stock <= 0 ? 'Stok Habis' : `Stok: ${product.stock} pcs`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Cart & Payment (35%) */}
        <div className="w-full lg:w-[35%] flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-slate-200 lg:overflow-hidden">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Transaksi Berjalan</p>
                <p className="font-bold text-navy-900">#{trxCode}</p>
              </div>
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="max-h-[45vh] lg:max-h-none lg:flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-2">🛒</span>
                <p className="text-gray-500">Keranjang kosong</p>
                <p className="text-sm text-gray-400">Pilih produk untuk memulai transaksi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      <p className="text-navy-600 font-semibold">Rp {item.price.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition font-bold text-gray-700"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition font-bold text-gray-700"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm w-24 text-right">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cost Summary */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Diskon</span>
              <span className="font-medium text-green-600">-Rp {discount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pajak{effectiveTaxRate > 0 ? ` (${effectiveTaxRate}%)` : ''}</span>
              <span className="font-medium text-gray-900">Rp {tax.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
              <span className="text-gray-900">Total Tagihan</span>
              <span className="text-navy-600">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-gray-900 mb-3">Metode Pembayaran</h3>
            <div className="flex gap-2 mb-4">
              {paymentOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setPaymentMethod(option.key)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    activeMethod === option.key
                      ? 'bg-navy-600 text-white'
                      : 'bg-white text-gray-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {activeMethod === 'qris' && !storeQrCode && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠️ QR toko belum diupload — minta owner upload di Pengaturan Toko → Pembayaran.
              </div>
            )}

            {activeMethod === 'tunai' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Uang Bayar Pelanggan</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="Masukkan nominal..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCashAmount(amount === 'Uang Pas' ? total.toString() : amount)}
                      className="px-3 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                    >
                      {amount === 'Uang Pas' ? 'Uang Pas' : `Rp ${parseInt(amount).toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
                {cashAmount && (
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-gray-700">Kembalian:</span>
                    <span className="font-bold text-green-600">
                      Rp {(parseInt(cashAmount) - total).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => activeMethod === 'qris' ? setShowQrisModal(true) : handleCheckout()}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full bg-navy-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-navy-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut
                ? '⏳ Memproses Transaksi...'
                : activeMethod === 'qris'
                  ? `📱 Tampilkan QRIS (Rp ${total.toLocaleString('id-ID')})`
                  : `Bayar & Cetak Struk (Rp ${total.toLocaleString('id-ID')})`}
            </button>
          </div>
        </div>
      </div>

      {/* Modal QRIS — kasir validasi transfer pembeli sebelum transaksi disimpan */}
      {showQrisModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <h2 className="text-xl font-bold text-gray-900">📱 Pembayaran QRIS</h2>
            <p className="text-sm text-gray-500 mt-1">Minta pembeli scan QR di bawah ini</p>

            {/* QR code toko — dinamis (nominal tertanam) jika payload tersedia */}
            <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {dynamicQrSrc ? (
                <>
                  <img src={dynamicQrSrc} alt="QRIS Toko" className="w-56 h-56 mx-auto object-contain" />
                  <p className="text-[11px] text-green-600 font-semibold mt-2">✅ QRIS dinamis — nominal sudah tertanam, pembeli cukup scan</p>
                  {storeQrCode && (
                    <details className="mt-3 text-left">
                      <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-navy-600">
                        QR ditolak aplikasi pembeli? Gunakan QR statis
                      </summary>
                      <img src={storeQrCode} alt="QRIS Statis" className="w-36 h-36 mx-auto mt-2 object-contain border border-slate-200 rounded-lg bg-white" />
                      <p className="text-[11px] text-amber-600 mt-1 text-center">Pembeli memasukkan nominal Rp {total.toLocaleString('id-ID')} secara manual.</p>
                    </details>
                  )}
                </>
              ) : storeQrCode ? (
                <>
                  <img src={storeQrCode} alt="QRIS Toko" className="w-56 h-56 mx-auto object-contain" />
                  <p className="text-[11px] text-amber-600 font-semibold mt-2">⚠️ QRIS statis — pembeli memasukkan nominal secara manual</p>
                </>
              ) : (
                <div className="w-56 h-56 mx-auto flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400">
                  <span className="text-5xl">📱</span>
                  <p className="text-xs mt-2 px-4">QR belum diupload owner.<br />Validasi pembayaran secara manual.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-navy-50 border border-navy-200 rounded-lg px-4 py-3 mb-2">
              <span className="text-sm font-medium text-gray-600">Total Tagihan</span>
              <span className="text-xl font-bold text-navy-700">Rp {total.toLocaleString('id-ID')}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Kode: {trxCode} · Kasir: {cashierName}</p>

            {storeQrCode && (
              <a
                href={storeQrCode}
                download="QRIS-Toko.png"
                className="inline-block mb-4 px-4 py-2 bg-slate-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
              >
                ⬇ Unduh QRIS
              </a>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              ⚠️ Tekan "Konfirmasi Pembayaran" HANYA setelah pembeli berhasil transfer dan buktinya sudah Anda validasi.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowQrisModal(false)}
                disabled={isCheckingOut}
                className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg font-semibold hover:bg-slate-200 transition disabled:opacity-50"
              >
                Tutup
              </button>
              <button
                onClick={() => { setShowQrisModal(false); handleCheckout() }}
                disabled={isCheckingOut}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {isCheckingOut ? '⏳ Menyimpan...' : '✅ Konfirmasi Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Struk — otomatis muncul setelah transaksi berhasil */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="px-6 pt-5 pb-3 text-center border-b border-slate-100">
              <div className="text-3xl">✅</div>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Transaksi Berhasil!</h2>
              <p className="text-xs text-gray-500">Struk siap dicetak — {lastReceipt.code}</p>
            </div>

            {/* Kertas struk gaya thermal 58mm */}
            <div className="overflow-y-auto px-6 py-4 flex justify-center">
              <div id="receipt-print" style={{ width: paperWidth, maxWidth: '100%' }} className="bg-white font-mono text-[11px] leading-relaxed text-gray-900 border border-dashed border-slate-300 p-3">
                <p className="text-center font-bold text-sm tracking-wide">{lastReceipt.store}</p>
                <p className="text-center">StellerPOS</p>
                <p className="text-center">================================</p>
                <p>No: {lastReceipt.code}</p>
                <p>Tgl: {lastReceipt.date.toLocaleString('id-ID')}</p>
                <p>Kasir: {lastReceipt.cashier}</p>
                <p>--------------------------------</p>
                {lastReceipt.items.map(item => (
                  <div key={item.id} className="mb-1">
                    <p>{item.name}</p>
                    <div className="flex justify-between">
                      <span>{item.quantity} x {item.price.toLocaleString('id-ID')}</span>
                      <span>{(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
                <p>--------------------------------</p>
                <div className="flex justify-between"><span>Subtotal</span><span>{lastReceipt.subtotal.toLocaleString('id-ID')}</span></div>
                {lastReceipt.tax > 0 && (
                  <div className="flex justify-between"><span>Pajak</span><span>{lastReceipt.tax.toLocaleString('id-ID')}</span></div>
                )}
                <div className="flex justify-between font-bold text-[13px]"><span>TOTAL</span><span>Rp {lastReceipt.total.toLocaleString('id-ID')}</span></div>
                <p>--------------------------------</p>
                <div className="flex justify-between"><span>Bayar ({lastReceipt.method.toUpperCase()})</span><span>{lastReceipt.cashPaid.toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span>Kembali</span><span>{lastReceipt.change.toLocaleString('id-ID')}</span></div>
                <p className="text-center">================================</p>
                <p className="text-center mt-1">Terima kasih sudah berbelanja!</p>
                <p className="text-center">Powered by StellerPOS</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={closeReceipt}
                className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg font-semibold hover:bg-slate-200 transition"
              >
                Transaksi Baru
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 px-4 py-3 bg-navy-600 text-white rounded-lg font-semibold hover:bg-navy-700 transition"
              >
                🖨️ Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ulasan — muncul setelah transaksi pertama toko */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            {reviewSent ? (
              <>
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Terima Kasih!</h2>
                <p className="text-sm text-gray-600 mb-6">Ulasan Anda tersimpan dan membantu kami mengembangkan StellerPOS.</p>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="w-full px-4 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-semibold"
                >
                  Tutup
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">🎊</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Selamat atas Transaksi Pertama Anda!</h2>
                <p className="text-sm text-gray-600 mb-5">
                  Bagaimana pengalaman Anda menggunakan StellerPOS? Beri rating &amp; ulasan singkat untuk membantu toko lain menemukan kami.
                </p>
                <div className="flex justify-center space-x-1 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="text-4xl transition hover:scale-110"
                    >
                      <span className={star <= reviewRating ? 'text-amber-400' : 'text-gray-300'}>★</span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  rows="3"
                  placeholder="Tulis ulasan singkat Anda di sini..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 text-sm mb-4"
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    Nanti Saja
                  </button>
                  <button
                    onClick={submitReview}
                    disabled={!reviewMessage.trim() || isSubmittingReview}
                    className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold disabled:opacity-50"
                  >
                    {isSubmittingReview ? '⏳ Mengirim...' : '⭐ Kirim Ulasan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default POS
