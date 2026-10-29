export default function Loading() {
  return (
    <div className="mx-auto max-w-[1360px] animate-fade-in space-y-9 pt-2 sm:pt-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-9 w-3/4 max-w-xl rounded-xl" />
        <div className="skeleton h-4 w-1/2 max-w-sm rounded-lg" />
      </div>
      <div className="skeleton h-20 max-w-2xl rounded-2xl" />
      <div className="space-y-3">
        <div className="skeleton h-5 w-40 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-[46%] shrink-0 rounded-2xl sm:w-[210px] lg:w-[240px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
