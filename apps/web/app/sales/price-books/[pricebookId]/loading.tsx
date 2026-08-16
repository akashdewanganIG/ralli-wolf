export default function PriceBookDetailLoading() {
  return (
    <div className="p-4">
      {/* Back button skeleton */}
      <div className="mb-4">
        <div className="h-9 w-40 rounded-md bg-gray-200 animate-pulse" />
      </div>

      {/* Title skeleton */}
      <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-2" />
      {/* Subtitle skeleton */}
      <div className="h-4 w-64 rounded bg-gray-200 animate-pulse mb-4" />

      {/* Table header skeleton */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-6 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="border-[1.5px] border-gray-300 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="bg-[#ebeded] flex gap-4 px-4 py-3">
          {[80, 120, 90, 70, 140, 120].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-gray-300 animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-4 px-4 py-3 border-t border-gray-200"
          >
            {[80, 120, 90, 70, 140, 120].map((w, i) => (
              <div
                key={i}
                className="h-4 rounded bg-gray-200 animate-pulse"
                style={{ width: w }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
