export default function PriceBookDetailLoading() {
  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="h-9 w-40 rounded-md bg-active animate-pulse" />
      </div>

      <div className="h-7 w-48 rounded bg-active animate-pulse mb-2" />

      <div className="h-4 w-64 rounded bg-active animate-pulse mb-4" />

      <div className="flex items-center justify-between mb-2">
        <div className="h-6 w-40 rounded bg-active animate-pulse" />
        <div className="h-8 w-24 rounded-full bg-active animate-pulse" />
      </div>

      <div className="border-[1.5px] border-input rounded-xl overflow-hidden">
        <div className="bg-[#ebeded] flex gap-4 px-4 py-3">
          {[80, 120, 90, 70, 140, 120].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-active animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>

        {Array.from({ length: 6 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-4 px-4 py-3 border-t border-border"
          >
            {[80, 120, 90, 70, 140, 120].map((w, i) => (
              <div
                key={i}
                className="h-4 rounded bg-active animate-pulse"
                style={{ width: w }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
