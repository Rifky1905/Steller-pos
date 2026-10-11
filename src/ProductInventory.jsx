import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientInventory" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientInventory" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowInventory">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowInventory)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientInventory)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientInventory)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientInventory)" letter-spacing="0.5">Steller</text>
  </svg>
)

// Hanya 5 produk contoh yang disalin ke toko
const DEMO_PRODUCT_NAMES = [
  'Beras Rojolele', 'Minyak Bimoli', 'Gula Pasir', 'Kopi Kapal Api', 'Indomie Goreng',
]

function ProductInventory() {
  const navigate = useNavigate()

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

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [categoryError, setCategoryError] = useState('')

  const menuItems = [
    { icon: '📊', label: 'Beranda / Ringkasan', active: false, path: '/dashboard' },
    { icon: '🛒', label: 'Terminal Kasir', active: false, path: '/pos' },
    { icon: '📦', label: 'Inventaris Produk', active: true, path: '/inventory' },
    { icon: '📈', label: 'Laporan Penjualan', active: false, path: '/reports' },
    { icon: '👥', label: 'Manajemen Karyawan', active: false, path: '/employees' },
    { icon: '⚙️', label: 'Pengaturan Toko', active: false, path: '/settings' },
  ]

  const [products, setProducts] = useState([])
  const [categoriesList, setCategoriesList] = useState([])
  const [categoryIdMap, setCategoryIdMap] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)

  // ID merchant yang login (null = akun demo → lihat data demo bersama)
  const merchantId = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession'))?.id || null } catch { return null }
  })()
  const scope = (q) => merchantId ? q.eq('merchant_id', merchantId) : q.is('merchant_id', null)

  const fetchData = async () => {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      scope(supabase.from('categories').select('id, name').order('name')),
      scope(supabase.from('products').select('*, categories(name)').order('id')),
    ])
    if (cats) {
      // Anti-duplikasi: satu nama kategori (case-insensitive) hanya tampil sekali
      const seen = new Map()
      cats.forEach(c => {
        const key = c.name.trim().toLowerCase()
        if (!seen.has(key)) seen.set(key, c)
      })
      const uniqueCats = [...seen.values()]
      setCategoriesList(uniqueCats.map(c => c.name))
      setCategoryIdMap(Object.fromEntries(uniqueCats.map(c => [c.name, c.id])))
    }
    if (prods) {
      setProducts(prods.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        weight: p.weight,
        category: p.categories?.name || 'Lainnya',
        buyPrice: Number(p.buy_price),
        sellPrice: Number(p.sell_price),
        stock: p.stock,
        sold: p.sold,
      })))
    }
    setIsLoading(false)
  }

  // Merchant yang belum aktif tidak boleh membuka inventaris
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s && s.status !== 'active') navigate('/subscription-payment')
    } catch { /* akun demo tanpa sesi merchant */ }
  }, [navigate])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('inventory-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleDeleteProduct = async (product) => {
    if (!confirm(`Hapus produk "${product.name}"?`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      alert('Gagal menghapus produk: ' + error.message)
      return
    }
    fetchData()
  }

  // Salin maksimal 5 produk contoh (data demo bersama) ke toko ini
  const loadDemoProducts = async () => {
    if (!merchantId || isLoadingDemo) return
    setIsLoadingDemo(true)
    const { data: demoCats } = await supabase.from('categories').select('id, name').is('merchant_id', null)
    const { data: demoProds } = await supabase.from('products').select('*').is('merchant_id', null)
    const pickedProds = (demoProds || []).filter(p => DEMO_PRODUCT_NAMES.includes(p.name)).slice(0, 5)
    const neededCatIds = new Set(pickedProds.map(p => p.category_id).filter(Boolean))
    const catsToCopy = (demoCats || []).filter(c => neededCatIds.has(c.id))
    let catMap = {}
    if (catsToCopy.length) {
      const { data: newCats } = await supabase.from('categories')
        .insert(catsToCopy.map(c => ({ name: c.name, merchant_id: merchantId })))
        .select('id, name')
      catMap = Object.fromEntries((newCats || []).map(c => [c.name, c.id]))
    }
    const oldToName = Object.fromEntries((demoCats || []).map(c => [c.id, c.name]))
    if (pickedProds.length) {
      const { error } = await supabase.from('products').insert(pickedProds.map(p => ({
        name: p.name, weight: p.weight, barcode: p.barcode,
        category_id: catMap[oldToName[p.category_id]] || null,
        buy_price: p.buy_price, sell_price: p.sell_price,
        stock: p.stock, sold: 0,
        merchant_id: merchantId,
      })))
      if (error) alert('Gagal memuat produk contoh: ' + error.message)
    }
    setIsLoadingDemo(false)
    fetchData()
  }
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    weight: '',
    weightUnit: 'kg',
    category: 'Sembako',
    buyPrice: '',
    sellPrice: '',
    stock: '',
    barcode: ''
  })

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

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
              <h1 className="text-2xl font-bold text-gray-900">📦 Inventaris Produk</h1>
              <p className="text-sm text-gray-500">Kelola stok dan harga produk Anda</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center space-x-2 bg-navy-600 text-white px-6 py-3 rounded-lg hover:bg-navy-700 transition font-medium"
              >
                <span>➕</span>
                <span>Tambah Produk</span>
              </button>
              <button
                onClick={() => { setCategoryError(''); setNewCategory(''); setShowAddCategoryModal(true) }}
                className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition font-medium"
              >
                <span>📁</span>
                <span>Tambah Kategori</span>
              </button>
            </div>
          </div>
        </header>

        {/* Inventory Content */}
        <div className="p-8">
          {/* Search & Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto md:justify-end">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap text-sm transition ${
                    selectedCategory === 'all'
                      ? 'bg-navy-600 text-white'
                      : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  Semua
                </button>
                {categoriesList.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap text-sm transition ${
                      selectedCategory === category
                        ? 'bg-navy-600 text-white'
                        : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Total Produk</p>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Total Stok</p>
              <p className="text-2xl font-bold text-gray-900">{products.reduce((acc, p) => acc + p.stock, 0)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Total Terjual</p>
              <p className="text-2xl font-bold text-gray-900">{products.reduce((acc, p) => acc + p.sold, 0)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Nilai Stok</p>
              <p className="text-2xl font-bold text-gray-900">Rp {products.reduce((acc, p) => acc + (p.buyPrice * p.stock), 0).toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Produk</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Berat/Isi</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kategori</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Harga Beli</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Harga Jual</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Stok</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Terjual</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-3"></div>
                        Memuat produk dari database...
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      <p className="mb-3">📦 Belum ada produk. Klik "Tambah Produk" untuk menambahkan.</p>
                      {merchantId && (
                        <button
                          onClick={loadDemoProducts}
                          disabled={isLoadingDemo}
                          className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition text-sm font-medium"
                        >
                          {isLoadingDemo ? 'Memuat...' : '✨ Muat Data Produk Contoh'}
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{product.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">{product.weight || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-navy-100 text-navy-700 rounded-full text-sm">{product.category}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">Rp {product.buyPrice.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 font-medium text-green-600">Rp {product.sellPrice.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4">
                      <span className={product.stock < 15 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                        {product.stock} pcs
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.sold}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm">Edit</button>
                        <button onClick={() => handleDeleteProduct(product)} className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Product Modal */}
        {showAddProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Tambah Produk Baru</h2>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Produk *</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Contoh: Beras Rojolele"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi Produk <span className="text-gray-400 font-normal">(opsional)</span></label>
                  <textarea
                    rows={2}
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
                    placeholder="Contoh: Beras pulen premium kualitas super"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Berat / Isi</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="any"
                      value={newProduct.weight}
                      onChange={(e) => setNewProduct({...newProduct, weight: e.target.value})}
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      placeholder="Contoh: 5"
                    />
                    <select
                      value={newProduct.weightUnit}
                      onChange={(e) => setNewProduct({...newProduct, weightUnit: e.target.value})}
                      className="w-32 px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white"
                    >
                      <optgroup label="Berat">
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                        <option value="ons">ons</option>
                        <option value="kg">kg</option>
                        <option value="kwintal">kwintal</option>
                        <option value="ton">ton</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="ml">ml</option>
                        <option value="cc">cc</option>
                        <option value="L">L</option>
                        <option value="galon">galon</option>
                        <option value="jerigen">jerigen</option>
                        <option value="drum">drum</option>
                      </optgroup>
                      <optgroup label="Panjang">
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="m">m (meter)</option>
                        <option value="roll">roll</option>
                      </optgroup>
                      <optgroup label="Satuan & Kemasan">
                        <option value="pcs">pcs</option>
                        <option value="unit">unit</option>
                        <option value="set">set</option>
                        <option value="batang">batang</option>
                        <option value="lembar">lembar</option>
                        <option value="papan">papan</option>
                        <option value="strip">strip</option>
                        <option value="pack">pack</option>
                        <option value="pak">pak</option>
                        <option value="sachet">sachet</option>
                        <option value="bungkus">bungkus</option>
                        <option value="botol">botol</option>
                        <option value="kaleng">kaleng</option>
                        <option value="toples">toples</option>
                        <option value="plastik">plastik</option>
                        <option value="ikat">ikat</option>
                        <option value="lusin">lusin</option>
                        <option value="kodi">kodi</option>
                        <option value="rim">rim</option>
                        <option value="dus">dus / karton</option>
                        <option value="box">box</option>
                        <option value="karung">karung</option>
                        <option value="sak">sak</option>
                        <option value="pail">pail</option>
                        <option value="tabung">tabung</option>
                        <option value="ball">ball</option>
                        <option value="peti">peti</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori *</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Harga Beli (Rp) *</label>
                  <input
                    type="number"
                    value={newProduct.buyPrice}
                    onChange={(e) => setNewProduct({...newProduct, buyPrice: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    value={newProduct.sellPrice}
                    onChange={(e) => setNewProduct({...newProduct, sellPrice: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stok Awal *</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barcode (Opsional)</label>
                  <input
                    type="text"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="8991234567890"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      if (!newProduct.name.trim() || !newProduct.sellPrice) {
                        alert('Nama produk dan harga jual wajib diisi!')
                        return
                      }
                      const { error } = await supabase.from('products').insert({
                        name: newProduct.name.trim(),
                        weight: newProduct.weight ? `${newProduct.weight} ${newProduct.weightUnit}` : null,
                        category_id: categoryIdMap[newProduct.category] || null,
                        buy_price: parseInt(newProduct.buyPrice) || 0,
                        sell_price: parseInt(newProduct.sellPrice) || 0,
                        stock: parseInt(newProduct.stock) || 0,
                        barcode: newProduct.barcode.trim() || null,
                        description: newProduct.description.trim() || null,
                        merchant_id: merchantId,
                      })
                      if (error) {
                        alert('Gagal menyimpan produk: ' + error.message)
                        return
                      }
                      setShowAddProductModal(false)
                      setNewProduct({ name: '', description: '', weight: '', weightUnit: 'kg', category: 'Sembako', buyPrice: '', sellPrice: '', stock: '', barcode: '' })
                      fetchData()
                    }}
                    className="flex-1 px-4 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium"
                  >
                    Simpan Produk
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {showAddCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Tambah Kategori Baru</h2>
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Kategori *</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => { setNewCategory(e.target.value); setCategoryError('') }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Contoh: Elektronik"
                  />
                  {categoryError && (
                    <p className="mt-2 text-sm text-red-600">⚠️ {categoryError}</p>
                  )}
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowAddCategoryModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      const name = newCategory.trim()
                      if (!name) { setCategoryError('Nama kategori wajib diisi!'); return }
                      // Tolak nama kategori yang sudah ada (case-insensitive)
                      if (categoriesList.some(c => c.trim().toLowerCase() === name.toLowerCase())) {
                        setCategoryError(`Kategori "${name}" sudah ada. Gunakan nama lain.`)
                        return
                      }
                      const { error } = await supabase.from('categories').insert({ name, merchant_id: merchantId })
                      if (error) {
                        if (error.code === '23505') {
                          setCategoryError(`Kategori "${name}" sudah ada. Gunakan nama lain.`)
                        } else {
                          setCategoryError('Gagal menyimpan kategori: ' + error.message)
                        }
                        return
                      }
                      setNewCategory('')
                      setCategoryError('')
                      setShowAddCategoryModal(false)
                      fetchData()
                    }}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    Simpan Kategori
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ProductInventory
