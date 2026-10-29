export default function Loading() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true" aria-label="Carregando curso">
      <div className="skeleton h-48 rounded-3xl sm:h-64" />
      <div className="skeleton h-6 w-48 rounded-lg" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
    </div>
  );
}
