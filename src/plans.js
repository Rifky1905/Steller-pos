// Daftar paket langganan StellerPOS — harga dapat diubah Super Admin.
// Disimpan di platform_settings (key = 'plans'); semua halaman pembayaran
// dan QRIS dinamis membaca sumber yang sama sehingga nominal selalu sinkron.
import { supabase } from './supabaseClient'

export const DEFAULT_PLANS = [
  { name: '1 Bulan', price: 100000, days: 30 },
  { name: '3 Bulan', price: 280000, days: 90 },
  { name: '6 Bulan', price: 550000, days: 180 },
  { name: '1 Tahun', price: 1000000, days: 365 },
]

export const formatRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// Ambil paket terbaru dari platform_settings — fallback ke default bila belum diset
export const fetchPlans = async () => {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'plans')
      .maybeSingle()
    if (Array.isArray(data?.value) && data.value.length) {
      return DEFAULT_PLANS.map(d => {
        const custom = data.value.find(p => p.name === d.name)
        const price = Number(custom?.price)
        return price > 0 ? { ...d, price } : d
      })
    }
  } catch { /* tabel belum ada → pakai default */ }
  return DEFAULT_PLANS
}

// Simpan paket dari Super Admin
export const savePlans = (plans) =>
  supabase
    .from('platform_settings')
    .upsert({ key: 'plans', value: plans, updated_at: new Date().toISOString() })
