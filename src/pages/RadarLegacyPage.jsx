/**
 * แสดงหน้า Route Radar แบบ legacy (plain JS) ใน React ผ่าน iframe
 * ใช้ endpoint /route-radar ที่ server serve อยู่แล้ว
 */
export default function RadarLegacyPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="flex-shrink-0 px-4 py-2 bg-slate-100 border-b border-slate-200 text-sm text-slate-600">
        หน้า Route Radar แบบ legacy (iframe) — ข้อมูลจาก /api/branches และ /api/orders/by-car
      </div>
      <iframe
        title="Route Radar (Legacy)"
        src="/route-radar"
        className="flex-1 w-full min-h-0 border-0"
      />
    </div>
  )
}
