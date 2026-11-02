// Penjaga langganan — kunci fitur penting saat masa aktif habis.
// Dipakai oleh: POS, Inventaris, Laporan, Karyawan, Pengaturan, Dashboard (banner).
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

export const isSubExpired = (endDate) => !!endDate && new Date(endDate).getTime() <= Date.now()

export const getMerchantSession = () => {
  try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null }
}

// Alasan kunci: 'inactive' (status bukan active) | 'expired' (end_date lewat) | null
export const subLockReason = (status, endDate) => {
  if (status && status !== 'active') return 'inactive'
  if (isSubExpired(endDate)) return 'expired'
  return null
}

// Hook: cek status & end_date TERBARU dari Supabase (sesi lokal bisa basi).
// Mengembalikan null saat masih memeriksa, lalu { locked, reason, endDate }.
export function useSubscriptionLock(merchantId) {
  const [lock, setLock] = useState(null)
  useEffect(() => {
    let off = false
    const run = async () => {
      const session = getMerchantSession()
      const id = merchantId || session?.id || sessionStorage.getItem('cashierMerchantId')
      if (!id) {
        // Mode demo tanpa merchant: hanya kunci jika sesi owner menandai terkunci
        const reason = session ? subLockReason(session.status, session.endDate) : null
        if (!off) setLock({ locked: !!reason, reason, endDate: session?.endDate })
        return
      }
      const { data } = await supabase
        .from('merchants')
        .select('status, end_date')
        .eq('id', id)
        .maybeSingle()
      if (off) return
      const status = data?.status ?? session?.status
      const endDate = data?.end_date ?? session?.endDate
      const reason = subLockReason(status, endDate)
      if (session && data) {
        sessionStorage.setItem('merchantSession', JSON.stringify({
          ...session, status: data.status, endDate: data.end_date,
        }))
      }
      setLock({ locked: !!reason, reason, endDate })
    }
    run()
    return () => { off = true }
  }, [merchantId])
  return lock
}

// Overlay full-screen yang menutup halaman terkunci
export default function SubscriptionLock({ endDate, reason, onRenew }) {
  const navigate = useNavigate()
  const location = useLocation()
  const onDashboard = location.pathname === '/dashboard'
  const endLabel = endDate
    ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  // Perpanjangan lewat modal di Dashboard — ?renew=1 membuka modal otomatis
  const handleRenew = onRenew || (() => navigate('/dashboard?renew=1'))
  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Fitur Terkunci</h2>
        <p className="text-sm text-gray-600 mb-1">
          {reason === 'expired'
            ? <>Masa aktif langganan Anda telah berakhir{endLabel ? <> pada <span className="font-semibold text-gray-900">{endLabel}</span></> : ''}.</>
            : 'Akun toko Anda sedang tidak aktif.'}
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Perpanjang langganan untuk membuka kembali Kasir, Inventaris, Laporan, Karyawan, dan Pengaturan.
        </p>
        <button
          onClick={handleRenew}
          className="w-full py-4 bg-navy-600 text-white rounded-lg font-semibold text-lg hover:bg-navy-700 transition shadow-lg"
        >
          Perpanjang Langganan Sekarang
        </button>
        {!onDashboard && (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full mt-3 py-3 bg-slate-100 text-gray-700 rounded-lg font-semibold hover:bg-slate-200 transition"
          >
            ← Kembali ke Dashboard
          </button>
        )}
        <p className="mt-5 text-xs text-gray-500">
          Sudah bayar tapi masih terkunci? Tunggu verifikasi admin atau hubungi{' '}
          <a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="font-semibold text-green-600 hover:underline">
            0858-9317-4442
          </a>
        </p>
      </div>
    </div>
  )
}
