// Utilitas OTP StellerPOS — pengiriman kode verifikasi otomatis.
// Email    : EmailJS (https://www.emailjs.com) — free tier, kirim langsung dari frontend
// WhatsApp : Fonnte  (https://fonnte.com) — WhatsApp Gateway API Indonesia
// Konfigurasi via file .env (lihat .env.example).

const ADMIN_WA = '6285893174442' // 0858-9317-4442

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

// Normalisasi nomor HP Indonesia ke format internasional (62xxx)
export const normalizePhone = (raw) => {
  if (!raw) return ''
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (!d.startsWith('62')) d = '62' + d
  return d
}

// Kirim OTP ke email pengguna via EmailJS
export const sendOtpEmail = async (toEmail, code, name) => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey) {
    return { ok: false, unconfigured: true, error: 'EmailJS belum dikonfigurasi (isi VITE_EMAILJS_* di .env)' }
  }
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: toEmail,
          to_name: name || toEmail,
          otp: code,
          message: `Kode verifikasi akun StellerPOS Anda adalah ${code}. Jangan bagikan kode ini ke siapa pun.`,
        },
      }),
    })
    return res.ok ? { ok: true } : { ok: false, error: `EmailJS error HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: 'Gagal terhubung ke EmailJS: ' + e.message }
  }
}

// Kirim pesan WhatsApp generik via Fonnte; fallback ke nomor admin jika target kosong
export const sendWhatsApp = async (target, message) => {
  const token = import.meta.env.VITE_FONNTE_TOKEN
  if (!token) {
    return { ok: false, unconfigured: true, error: 'Gateway WhatsApp belum dikonfigurasi (isi VITE_FONNTE_TOKEN di .env)' }
  }
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: new URLSearchParams({ target: target || ADMIN_WA, message }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status !== false) return { ok: true }
    return { ok: false, error: json.reason || `Fonnte error HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: 'Gagal terhubung ke gateway WhatsApp: ' + e.message }
  }
}

// Kirim OTP ke WhatsApp pengguna
export const sendOtpWhatsApp = (phone, code, storeName) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — Verifikasi Akun\n\nHalo${storeName ? ` ${storeName}` : ''}! Kode verifikasi akun Anda:\n\n*${code}*\n\nKode berlaku untuk satu kali verifikasi. Jangan bagikan ke siapa pun.`
  )

// Kirim kata sandi akun ke WhatsApp pengguna (fitur Lupa Kata Sandi)
export const sendPasswordWhatsApp = (phone, password, email, ownerName, storeName) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — Pemulihan Kata Sandi\n\nHalo${ownerName ? ` ${ownerName}` : ''}! Berikut data login akun toko${storeName ? ` "${storeName}"` : ''} Anda:\n\n📧 Email: ${email || '-'}\n🔑 Kata Sandi: *${password}*\n\nSegera ganti kata sandi di Pengaturan Toko setelah berhasil login. Jika Anda tidak meminta ini, abaikan pesan ini.`
  )

// Notifikasi WhatsApp ke ADMIN: ada bukti pembayaran baru yang menunggu verifikasi
// Dipanggil setelah bukti tersimpan — fire-and-forget (kegagalan kirim tidak memblokir UI)
export const notifyAdminPayment = ({ type, name, contact, detail, amount }) =>
  sendWhatsApp(
    ADMIN_WA,
    `*StellerPOS* — 💰 Bukti Pembayaran Masuk\n\n` +
    `Jenis: ${type}\n` +
    `Nama: ${name || '-'}\n` +
    `Kontak: ${contact || '-'}\n` +
    (detail ? `Paket: ${detail}\n` : '') +
    (amount ? `Nominal: Rp ${Number(amount).toLocaleString('id-ID')}\n` : '') +
    `\nCek mutasi rekening Anda, lalu setujui pesanan di dashboard Super Admin jika dana sudah masuk.`
  ).catch(e => console.error('[WA] Notifikasi admin gagal:', e))

// Notifikasi ke OWNER: pembayaran langganan diverifikasi & akun aktif
export const notifySubscriptionApproved = (phone, storeName, plan, endDate) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — ✅ Pembayaran Terverifikasi\n\nKabar baik! Pembayaran Anda sudah kami terima dan verifikasi.\n\n🏪 Toko: ${storeName || '-'}\n📦 Paket: ${plan || '-'}\n🗓 Aktif hingga: ${endDate || '-'}\n\nSelamat menggunakan StellerPOS!`
  ).catch(e => console.error('[WA] Notifikasi approve gagal:', e))

// Notifikasi ke PEMESAN hardware: pembayaran diverifikasi & pesanan diproses
export const notifyHardwareApproved = (phone, name, pkg, color, subActive) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — ✅ Pembayaran Terverifikasi\n\nHalo${name ? ` ${name}` : ''}! Pembayaran Anda sudah diverifikasi.\n\n📦 ${pkg}\n🎨 Warna: ${color}\n🚚 Status: *Diproses* — estimasi pengiriman 5–10 hari (bisa lebih cepat sesuai kurir).` +
    (subActive ? '\n\n🎉 Bonus: langganan aplikasi Anda juga sudah diaktifkan!' : '')
  ).catch(e => console.error('[WA] Notifikasi approve gagal:', e))

// Reminder masa aktif ke OWNER: sisa hari 10 / 3 / 1 menjelang habis
export const notifySubscriptionReminder = (phone, storeName, daysLeft, endDate) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — ⏰ Pengingat Langganan\n\n` +
    `Halo${storeName ? ` ${storeName}` : ''}! Masa aktif langganan Anda tersisa *${daysLeft} hari* (berakhir ${endDate}).\n\n` +
    `Segera perpanjang di Dashboard → Perpanjang Langganan agar toko tetap aktif tanpa jeda.`
  ).catch(e => console.error('[WA] Reminder gagal:', e))

// Notifikasi ke PEMESAN hardware: pesanan telah dikirim
export const notifyHardwareShipped = (phone, name, pkg) =>
  sendWhatsApp(
    normalizePhone(phone),
    `*StellerPOS* — 🚚 Pesanan Dikirim\n\nHalo${name ? ` ${name}` : ''}! Pesanan Anda:\n\n📦 ${pkg}\n\ntelah *dikirim* dan dalam perjalanan. Mohon siapkan penerima di alamat tujuan. Terima kasih!`
  ).catch(e => console.error('[WA] Notifikasi kirim gagal:', e))
