const formatReceipt = (data) => {
    const { 
        customerName, shortId, timestamp, merchantName, driverName, 
        itemsText, subtotal, deliveryFee, total, pickupFee 
    } = data;
    
    return `✅ *PESANAN SELESAI* ✅\n` +
           `Terima kasih, Kak ${customerName}! ✨\n\n` +
           `🆔 #ARO-${shortId}\n` +
           `📅 ${timestamp || new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
           `${merchantName ? `🏬 ${merchantName}\n` : ''}` +
           `🛵 ${driverName || 'Mitra ARO DRIVE'}\n\n` +
           `--- *STRUK PEMBAYARAN* ---\n` +
           `${itemsText || '- No details -'}\n` +
           `---------------------------\n` +
           `${subtotal > 0 ? `Subtotal:         Rp ${subtotal.toLocaleString()}\n` : ''}` +
            `Biaya Antar:      Rp ${deliveryFee.toLocaleString()}\n` +
            `${pickupFee > 0 ? `Biaya Jemput:     Rp ${pickupFee.toLocaleString()}\n` : ''}` +
            `---------------------------\n` +
           `*TOTAL BAYAR:     Rp ${total.toLocaleString()}*\n` +
           `---------------------------\n\n` +
           `Makasih udah pake ARO DRIVE! Sampai jumpa di orderan berikutnya. 🚀`;
};

module.exports = {
    transport: {
        name: "ARO TRANSPORT",
        accepted: (customerName, shortId) => `Halo Kak ${customerName}! 🔥\n\n*ARO TRANSPORT* kamu (#${shortId}) sudah dapat driver nih. Driver segera jemput ke lokasi Kakak! 🛵\n\nMakasih udah pake ARO DRIVE!`,
        arriving: (customerName, shortId) => `Kak ${customerName}, Driver *ARO TRANSPORT* sudah sampai di titik jemput nih! 📍🛵\n\nYuk samperin biar langsung sat-set sampe tujuan. Thank you!`,
        picked_up: (customerName, shortId) => `Gaspol! Kak ${customerName} (#${shortId}) sudah dijalan bersama Driver *ARO TRANSPORT* kami. Stay safe ya Kak! 🛵⚡`,
        completed: (customerName, shortId, data) => data ? formatReceipt(data) : `Alhamdulillah! Sudah sampai tujuan ya Kak ${customerName}. ✅\n\nMakasih banget udah percayain ARO DRIVE. Sampai jumpa di perjalanan berikutnya! ✨`
    },
    food: {
        name: "ARO FOOD",
        accepted: (customerName, shortId, menuText) => `Halo Kak ${customerName}! 🔥\n\nGaspol! Pesanan *ARO FOOD* kamu (#${shortId}) udah di-accept driver nih. Stay tuned ya, driver lagi otw jemput! 🚀${menuText}\n\nMakasih udah pake ARO DRIVE!`,
        arriving: (customerName, shortId) => `Kak ${customerName}, Driver *ARO FOOD* sudah sampai di lokasi Kamu nih! 📍🍕\n\nYuk samperin biar pesanan kamu (#${shortId}) langsung santap. Thank you!`,
        picked_up: (customerName, shortId) => `Halo Kak ${customerName}! 🛵🍕\n\nDriver ARO DRIVE sudah menjemput pesanan *ARO FOOD* kamu (#${shortId}) dan sekarang sedang dalam perjalanan ke lokasi kamu. Mohon ditunggu ya!`,
        completed: (customerName, shortId, data) => data ? formatReceipt(data) : `Mantap Kak ${customerName}! ✅🍕\n\nPesanan *ARO FOOD* kamu (#${shortId}) udah beres ya. Makasih banget udah percayain ARO DRIVE. Jangan lupa jajan lagi besok! ✨`
    },
    express: {
        name: "ARO EXPRESS",
        accepted: (customerName, shortId) => `Halo Kak ${customerName}! 📦\n\nPaket *ARO EXPRESS* kamu (#${shortId}) segera dijemput driver. Mohon siapkan paketnya ya! 🚀`,
        arriving: (customerName, shortId) => `Kak ${customerName}, Driver *ARO EXPRESS* sudah sampai di lokasi pengirim! 📍📦`,
        picked_up: (customerName, shortId) => `Paket Kakak (#${shortId}) sudah dibawa driver *ARO EXPRESS* menuju tujuan. 🛵📦`,
        completed: (customerName, shortId, data) => data ? formatReceipt(data) : `Paket (#${shortId}) berhasil diantar! ✅📦`
    },
    send: {
        name: "ARO SEND",
        accepted: (customerName, shortId) => `Halo Kak ${customerName}! 📦\n\nKiriman *ARO SEND* kamu (#${shortId}) segera dijemput Driver kurir kami. Mohon disiapkan paketnya ya! 🚀\n\nMakasih udah pake ARO DRIVE!`,
        arriving: (customerName, shortId) => `Kak ${customerName}, Kurir *ARO SEND* sudah sampai di lokasi pengirim nih! 📍📦\n\nYuk serahin paketnya biar langsung cus ke tujuan. Thank you!`,
        picked_up: (customerName, shortId) => `Sip! Paket Kakak (#${shortId}) sudah dibawa kurir *ARO SEND* dan sedang dalam perjalanan menuju lokasi penerima. 🛵📦`,
        completed: (customerName, shortId, data) => data ? formatReceipt(data) : `Alhamdulillah! Paket Kakak (#${shortId}) sudah berhasil diantar ke tujuan dengan aman. ✅📦\n\nMakasih udah kirim-kirim lewat ARO DRIVE! ✨`
    },
    shop: {
        name: "ARO SHOP",
        accepted: (customerName, shortId, menuText) => `Halo Kak ${customerName}! 🛒\n\nDriver siap bantu belanja pesanan *ARO SHOP* kamu (#${shortId}). Standby ya kalau ada konfirmasi belanjaan! 🚀${menuText}\n\nMakasih udah pake ARO DRIVE!`,
        arriving: (customerName, shortId) => `Kak ${customerName}, Driver *ARO SHOP* sudah sampai di lokasi belanja nih! 📍🛒\n\nLagi proses cari/belanja barangnya ya, mohon ditunggu. Thank you!`,
        picked_up: (customerName, shortId) => `Horee! Belanjaan Kakak (#${shortId}) sudah beres dibelanjakan dan lagi otw diantar ke rumah oleh Driver *ARO SHOP* kami! 🛵🛒`,
        completed: (customerName, shortId, data) => data ? formatReceipt(data) : `Alhamdulillah! Belanjaan Kakak (#${shortId}) sudah sampai ya. ✅🛒\n\nMakasih udah titip di ARO DRIVE! ✨`
    },
    system: {
        newOrder: (orderId, serviceType, total, merchantName, items) => {
            const shortId = orderId.slice(-5).toUpperCase();
            return `🔔 *PESANAN BARU MASUK!* 🔔\n\n` +
                   `🆔 ID: #ARO-${shortId}\n` +
                   `🛠 Layanan: ${serviceType.toUpperCase()}\n` +
                   `🏬 Merchant: ${merchantName || 'N/A'}\n` +
                   `💰 Total: Rp ${total?.toLocaleString()}\n` +
                   `${items ? `📦 Item:\n${items}` : ''}\n` +
                   `📍 _Silakan cek aplikasi untuk detail lengkap._`;
        },
        manualOrderCustomer: (customerName, orderId, serviceType, total, pickup, dropoff) => {
            const shortId = orderId.slice(-5).toUpperCase();
            return `Halo Kak *${customerName}*! 👋\n\n` +
                   `Pesanan kamu via WhatsApp sudah kami input ke sistem ARO DRIVE ya!\n\n` +
                   `🆔 ID: #ARO-${shortId}\n` +
                   `🛠 Layanan: ${serviceType.toUpperCase()}\n` +
                   `📍 Dari: ${pickup || '-'}\n` +
                   `🏁 Ke: ${dropoff || '-'}\n` +
                   `💰 Total: *Rp ${total?.toLocaleString()}*\n\n` +
                   `Sabar ya Kak, Driver kami sedang mencarikan yang terdekat untuk kamu. Status pesanan akan kami update otomatis via WA ini. 🙏🚀`;
        }
    }
};
