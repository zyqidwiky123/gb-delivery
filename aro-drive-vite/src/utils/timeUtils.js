/**
 * Utility to parse Google Maps opening hours and determine current status.
 * Expects openingHours as an array of strings like ["Monday: 8:00 AM – 10:00 PM", ...]
 */

export const getOpeningStatus = (openingHoursInput) => {
  let openingHours = openingHoursInput;
  // Handle object structure from Google Maps sync { weekdayText: [...] }
  if (openingHoursInput && typeof openingHoursInput === 'object' && !Array.isArray(openingHoursInput)) {
    openingHours = openingHoursInput.weekdayText;
  }

  if (!openingHours || !Array.isArray(openingHours) || openingHours.length === 0) {
    return { status: 'unknown', message: 'Jam operasional tidak tersedia', color: 'gray' };
  }

  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = days[now.getDay()];
  
  // Find the string for today
  const todaySchedule = openingHours.find(s => s.startsWith(currentDayName));
  
  if (!todaySchedule) {
    return { status: 'unknown', message: 'Jadwal hari ini tidak ditemukan', color: 'gray' };
  }

  // Handle "Closed" or "Tutup"
  if (todaySchedule.toLowerCase().includes('closed') || todaySchedule.toLowerCase().includes('tutup')) {
    return { status: 'closed', message: 'Tutup', color: 'red' };
  }

  // Handle "Open 24 hours"
  if (todaySchedule.toLowerCase().includes('24 hours') || todaySchedule.toLowerCase().includes('24 jam')) {
    return { status: 'open', message: 'Buka 24 Jam', color: 'green' };
  }

  // Parse time range: e.g. "Monday: 8:00 AM – 10:00 PM"
  try {
    const timePart = todaySchedule.substring(todaySchedule.indexOf(':') + 1).trim();
    if (!timePart) return { status: 'unknown', message: 'Format jam salah', color: 'gray' };

    // Split by en-dash, em-dash, or hyphen and clean special whitespaces (thin space, etc)
    const times = timePart.split(/[–—-]/).map(t => t.replace(/[\u2009\u202F\u00A0]/g, ' ').trim());
    if (times.length !== 2) return { status: 'unknown', message: 'Format jam tidak terbaca', color: 'gray' };

    const parseTime = (timeStr) => {
      const isPM = timeStr.toLowerCase().includes('pm');
      const isAM = timeStr.toLowerCase().includes('am');
      let [hours, minutes] = timeStr.replace(/(am|pm)/i, '').trim().split(':').map(Number);
      
      if (isNaN(minutes)) minutes = 0;

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const startTime = parseTime(times[0]);
    let endTime = parseTime(times[1]);

    // Handle overnight schedules (e.g., 5:00 PM - 2:00 AM)
    if (endTime < startTime) {
      // If current time is after start or before end, it's open
      const tomorrowEnd = new Date(endTime);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      
      if (now >= startTime && now <= tomorrowEnd) {
        return { status: 'open', message: 'Buka Sekarang', color: 'green' };
      }
      
      // Also check if we are currently in the "after midnight" portion of yesterday's schedule
      const yesterdayStart = new Date(startTime);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      if (now >= yesterdayStart && now <= endTime) {
         return { status: 'open', message: 'Buka Sekarang', color: 'green' };
      }
    } else {
      if (now >= startTime && now <= endTime) {
        // Near closing warning (30 mins)
        const diff = (endTime - now) / (1000 * 60);
        if (diff > 0 && diff <= 30) {
          return { status: 'closing_soon', message: `Segera Tutup (${Math.round(diff)} mnt)`, color: 'orange' };
        }
        return { status: 'open', message: 'Buka Sekarang', color: 'green' };
      }
    }

    return { status: 'closed', message: `Tutup (Buka jam ${times[0]})`, color: 'red' };
  } catch (e) {
    console.error("Error parsing time:", e);
    return { status: 'unknown', message: 'Gagal cek jam operasional', color: 'gray' };
  }
};
