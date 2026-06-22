import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "waktusolat_zone";
const API_BASE = "https://api.waktusolat.app";

interface Zone {
  code: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

const ZONES: Zone[] = [
  // Wilayah Persekutuan
  {
    code: "WLY01",
    name: "Kuala Lumpur",
    state: "Wilayah Persekutuan",
    lat: 3.139,
    lng: 101.6869,
  },
  {
    code: "WLY02",
    name: "Labuan",
    state: "Wilayah Persekutuan",
    lat: 5.2831,
    lng: 115.2308,
  },
  {
    code: "WLY03",
    name: "Putrajaya",
    state: "Wilayah Persekutuan",
    lat: 2.9264,
    lng: 101.6964,
  },
  // Johor
  {
    code: "JHR01",
    name: "Mersing",
    state: "Johor",
    lat: 2.4332,
    lng: 103.8389,
  },
  {
    code: "JHR02",
    name: "Kluang, Pontian",
    state: "Johor",
    lat: 1.8528,
    lng: 103.3333,
  },
  {
    code: "JHR03",
    name: "Batu Pahat, Muar, Segamat",
    state: "Johor",
    lat: 2.0442,
    lng: 102.8,
  },
  {
    code: "JHR04",
    name: "Johor Bahru, Kota Tinggi",
    state: "Johor",
    lat: 1.4927,
    lng: 103.7414,
  },
  // Kedah
  {
    code: "KDH01",
    name: "Kota Setar, Kubang Pasu",
    state: "Kedah",
    lat: 6.1248,
    lng: 100.3673,
  },
  {
    code: "KDH02",
    name: "Kuala Muda, Yan",
    state: "Kedah",
    lat: 5.8167,
    lng: 100.4833,
  },
  {
    code: "KDH03",
    name: "Padang Terap",
    state: "Kedah",
    lat: 6.0,
    lng: 100.7833,
  },
  { code: "KDH04", name: "Baling", state: "Kedah", lat: 5.6833, lng: 100.9167 },
  {
    code: "KDH05",
    name: "Kulim, Bandar Baharu",
    state: "Kedah",
    lat: 5.3833,
    lng: 100.5667,
  },
  { code: "KDH06", name: "Langkawi", state: "Kedah", lat: 6.35, lng: 99.8 },
  {
    code: "KDH07",
    name: "Pendang",
    state: "Kedah",
    lat: 5.9833,
    lng: 100.5333,
  },
  { code: "KDH08", name: "Gurun", state: "Kedah", lat: 5.8833, lng: 100.45 },
  { code: "KDH09", name: "Sik", state: "Kedah", lat: 5.7833, lng: 100.7833 },
  // Kelantan
  {
    code: "KTN01",
    name: "Kota Bharu, Pasir Mas",
    state: "Kelantan",
    lat: 6.1248,
    lng: 102.2379,
  },
  {
    code: "KTN02",
    name: "Gua Musang, Jeli",
    state: "Kelantan",
    lat: 4.8815,
    lng: 101.9688,
  },
  // Melaka
  {
    code: "MLK01",
    name: "Seluruh Melaka",
    state: "Melaka",
    lat: 2.1896,
    lng: 102.2501,
  },
  // Negeri Sembilan
  {
    code: "NGS01",
    name: "Jelebu, Jempol, Tampin",
    state: "Negeri Sembilan",
    lat: 3.0667,
    lng: 102.1333,
  },
  {
    code: "NGS02",
    name: "Seremban, Port Dickson, Kuala Pilah",
    state: "Negeri Sembilan",
    lat: 2.7257,
    lng: 101.9381,
  },
  // Pahang
  {
    code: "PHG01",
    name: "Pulau Tioman",
    state: "Pahang",
    lat: 2.8,
    lng: 104.15,
  },
  {
    code: "PHG02",
    name: "Rompin, Muadzam Shah",
    state: "Pahang",
    lat: 2.7833,
    lng: 103.4833,
  },
  {
    code: "PHG03",
    name: "Maran, Chenor",
    state: "Pahang",
    lat: 3.4167,
    lng: 103.1333,
  },
  {
    code: "PHG04",
    name: "Temerloh, Mentakab, Bera",
    state: "Pahang",
    lat: 3.45,
    lng: 102.4167,
  },
  {
    code: "PHG05",
    name: "Jerantut, Taman Negara",
    state: "Pahang",
    lat: 3.9333,
    lng: 102.35,
  },
  {
    code: "PHG06",
    name: "Kuantan, Pekan",
    state: "Pahang",
    lat: 3.8077,
    lng: 103.326,
  },
  {
    code: "PHG07",
    name: "Cameron Highlands, Lipis",
    state: "Pahang",
    lat: 4.4667,
    lng: 101.4333,
  },
  {
    code: "PHG08",
    name: "Bentong, Raub",
    state: "Pahang",
    lat: 3.5167,
    lng: 101.9167,
  },
  // Pulau Pinang
  {
    code: "PNG01",
    name: "Pulau Pinang",
    state: "Pulau Pinang",
    lat: 5.4164,
    lng: 100.3327,
  },
  {
    code: "PNG02",
    name: "Seberang Perai",
    state: "Pulau Pinang",
    lat: 5.4141,
    lng: 100.3288,
  },
  // Perak
  {
    code: "PRK01",
    name: "Tapah, Tanjung Malim",
    state: "Perak",
    lat: 3.7,
    lng: 101.2667,
  },
  {
    code: "PRK02",
    name: "Kinta (Ipoh)",
    state: "Perak",
    lat: 4.5942,
    lng: 101.0901,
  },
  {
    code: "PRK03",
    name: "Hilir Perak (Teluk Intan)",
    state: "Perak",
    lat: 4.0333,
    lng: 101.0167,
  },
  {
    code: "PRK04",
    name: "Larut, Matang (Taiping)",
    state: "Perak",
    lat: 4.85,
    lng: 100.7333,
  },
  {
    code: "PRK05",
    name: "Kuala Kangsar",
    state: "Perak",
    lat: 4.7667,
    lng: 100.9333,
  },
  {
    code: "PRK06",
    name: "Hulu Perak (Gerik)",
    state: "Perak",
    lat: 5.4167,
    lng: 101.15,
  },
  {
    code: "PRK07",
    name: "Manjung (Lumut)",
    state: "Perak",
    lat: 4.2167,
    lng: 100.6333,
  },
  // Perlis
  {
    code: "PLS01",
    name: "Seluruh Perlis",
    state: "Perlis",
    lat: 6.4435,
    lng: 100.1986,
  },
  // Sabah
  {
    code: "SBH01",
    name: "Kota Kinabalu, Penampang",
    state: "Sabah",
    lat: 5.9804,
    lng: 116.0735,
  },
  {
    code: "SBH02",
    name: "Ranau, Kota Belud",
    state: "Sabah",
    lat: 6.0333,
    lng: 116.6833,
  },
  {
    code: "SBH03",
    name: "Sandakan",
    state: "Sabah",
    lat: 5.8402,
    lng: 118.1179,
  },
  { code: "SBH04", name: "Tawau", state: "Sabah", lat: 4.2452, lng: 117.8914 },
  {
    code: "SBH05",
    name: "Lahad Datu",
    state: "Sabah",
    lat: 5.027,
    lng: 118.3209,
  },
  {
    code: "SBH06",
    name: "Keningau",
    state: "Sabah",
    lat: 5.3374,
    lng: 116.1627,
  },
  {
    code: "SBH07",
    name: "Beaufort",
    state: "Sabah",
    lat: 5.3574,
    lng: 115.7573,
  },
  { code: "SBH08", name: "Kudat", state: "Sabah", lat: 6.8851, lng: 116.8452 },
  {
    code: "SBH09",
    name: "Semporna",
    state: "Sabah",
    lat: 4.4807,
    lng: 118.6147,
  },
  // Sarawak
  {
    code: "SWK01",
    name: "Kuching",
    state: "Sarawak",
    lat: 1.5533,
    lng: 110.3592,
  },
  {
    code: "SWK02",
    name: "Sri Aman",
    state: "Sarawak",
    lat: 1.2333,
    lng: 111.45,
  },
  { code: "SWK03", name: "Sibu", state: "Sarawak", lat: 2.2833, lng: 111.8167 },
  { code: "SWK04", name: "Miri", state: "Sarawak", lat: 4.3995, lng: 113.9914 },
  {
    code: "SWK05",
    name: "Limbang",
    state: "Sarawak",
    lat: 4.7667,
    lng: 115.0167,
  },
  {
    code: "SWK06",
    name: "Sarikei",
    state: "Sarawak",
    lat: 2.1167,
    lng: 111.5167,
  },
  { code: "SWK07", name: "Mukah", state: "Sarawak", lat: 2.9, lng: 112.0833 },
  { code: "SWK08", name: "Betong", state: "Sarawak", lat: 1.4, lng: 111.5167 },
  {
    code: "SWK09",
    name: "Kapit",
    state: "Sarawak",
    lat: 2.0167,
    lng: 112.9333,
  },
  // Selangor
  {
    code: "SGR01",
    name: "Shah Alam, Petaling",
    state: "Selangor",
    lat: 3.0738,
    lng: 101.5183,
  },
  {
    code: "SGR02",
    name: "Sepang, Hulu Langat",
    state: "Selangor",
    lat: 2.9,
    lng: 101.7833,
  },
  {
    code: "SGR03",
    name: "Rawang, Gombak, Hulu Selangor",
    state: "Selangor",
    lat: 3.4167,
    lng: 101.5667,
  },
  {
    code: "SGR04",
    name: "Sabak Bernam, Kuala Selangor",
    state: "Selangor",
    lat: 3.7833,
    lng: 100.9833,
  },
  // Terengganu
  {
    code: "TRG01",
    name: "Kuala Terengganu, Marang",
    state: "Terengganu",
    lat: 5.3296,
    lng: 103.137,
  },
  {
    code: "TRG02",
    name: "Kemaman",
    state: "Terengganu",
    lat: 4.2333,
    lng: 103.4167,
  },
  {
    code: "TRG03",
    name: "Dungun, Setiu",
    state: "Terengganu",
    lat: 4.95,
    lng: 103.2667,
  },
  {
    code: "TRG04",
    name: "Besut",
    state: "Terengganu",
    lat: 5.7,
    lng: 102.5833,
  },
];

interface PrayerDay {
  day: number;
  fajr: number;
  syuruk: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

const PRAYER_KEYS = [
  "fajr",
  "syuruk",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;
type PrayerKey = (typeof PRAYER_KEYS)[number];

const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Subuh",
  syuruk: "Syuruk",
  dhuhr: "Zohor",
  asr: "Asar",
  maghrib: "Maghrib",
  isha: "Isyak",
};

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestZone(lat: number, lng: number): Zone {
  return ZONES.reduce((best, z) =>
    haversine(lat, lng, z.lat, z.lng) < haversine(lat, lng, best.lat, best.lng)
      ? z
      : best,
  );
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts * 1000).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrayerTimes() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ms" ? "ms-MY" : "en-MY";

  const [now, setNow] = useState(new Date());
  const [zone, setZone] = useState<Zone | null>(null);
  const [prayers, setPrayers] = useState<PrayerDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const lastFetchedDay = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const fetchPrayers = useCallback(async (zoneCode: string, date: Date) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/v2/solat/${zoneCode}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const today = date.getDate();
      const todayData =
        (data.prayers as PrayerDay[])?.find((p) => p.day === today) ?? null;
      setPrayers(todayData);
      lastFetchedDay.current = today;
    } catch {
      setError(true);
      setPrayers(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyZone = useCallback(
    (z: Zone) => {
      localStorage.setItem(STORAGE_KEY, z.code);
      setZone(z);
      setShowPicker(false);
      fetchPrayers(z.code, new Date());
    },
    [fetchPrayers],
  );

  // Initial zone resolution
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = ZONES.find((z) => z.code === saved);
      if (found) {
        setZone(found);
        fetchPrayers(found.code, new Date());
        return;
      }
    }
    if (!navigator.geolocation) {
      setLoading(false);
      setShowPicker(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const z = nearestZone(pos.coords.latitude, pos.coords.longitude);
        applyZone(z);
      },
      () => {
        setLoading(false);
        setShowPicker(true);
      },
      { timeout: 5000 },
    );
  }, [fetchPrayers, applyZone]);

  // Re-fetch at midnight when day changes
  useEffect(() => {
    const today = now.getDate();
    if (
      zone &&
      lastFetchedDay.current !== null &&
      lastFetchedDay.current !== today
    ) {
      fetchPrayers(zone.code, now);
    }
  }, [now, zone, fetchPrayers]);

  const nowTs = Math.floor(now.getTime() / 1000);
  const nextKey = prayers
    ? (PRAYER_KEYS.find((k) => prayers[k] > nowTs) ?? null)
    : null;

  const stateGroups = ZONES.reduce<Record<string, Zone[]>>((acc, z) => {
    (acc[z.state] ??= []).push(z);
    return acc;
  }, {});

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Zone selector */}
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-white/35 hover:text-white/60 transition-colors shrink-0"
        >
          <MapPin className="w-3 h-3" />
          <span className="text-xs">
            {zone?.name ?? t("prayerTimes.selectZone")}
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {loading && (
          <div className="flex items-center gap-1.5 text-white/25 text-xs">
            <div className="w-2.5 h-2.5 rounded-full border border-white/20 border-t-white/50 animate-spin" />
            {t("prayerTimes.loading")}
          </div>
        )}

        {!loading && error && (
          <span className="text-xs text-red-400/50">
            {t("prayerTimes.failedToLoad")}
          </span>
        )}

        {!loading && !error && prayers && (
          <div className="flex flex-wrap gap-1.5">
            {PRAYER_KEYS.map((key) => {
              const isNext = key === nextKey;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isNext
                      ? "bg-[#86efac]/15 text-[#86efac] ring-1 ring-[#86efac]/25"
                      : "bg-black/15 text-white/40"
                  }`}
                >
                  <span>{PRAYER_LABELS[key]}</span>
                  <span
                    className={isNext ? "text-[#86efac]/65" : "text-white/22"}
                  >
                    {formatTime(prayers[key], locale)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone picker modal */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && zone) setShowPicker(false);
          }}
        >
          <div className="bg-[#1a3327] border border-white/10 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <h3 className="text-sm font-semibold text-white">
                {t("prayerTimes.selectZoneTitle")}
              </h3>
              {zone && (
                <button
                  onClick={() => setShowPicker(false)}
                  className="text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-3 space-y-4">
              {Object.entries(stateGroups).map(([state, zones]) => (
                <div key={state}>
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-2 mb-1">
                    {state}
                  </p>
                  <div className="space-y-0.5">
                    {zones.map((z) => (
                      <button
                        key={z.code}
                        onClick={() => applyZone(z)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                          zone?.code === z.code
                            ? "bg-[#86efac]/15 text-[#86efac]"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="font-mono text-[10px] text-white/25 w-10 shrink-0">
                          {z.code}
                        </span>
                        <span>{z.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
