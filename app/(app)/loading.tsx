export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8" aria-busy="true" aria-label="Carregando">
      <div className="skeleton h-56 rounded-3xl sm:h-72" />
      <div className="space-y-3">
        <div className="skeleton h-5 w-40 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-[42%] shrink-0 rounded-2xl sm:w-[200px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
