export default function Loading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Carregando aula">
      <div className="skeleton mb-4 h-4 w-40 rounded" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="-mx-4 aspect-video bg-black sm:mx-0 sm:rounded-2xl">
            <div className="grid size-full place-items-center">
              <span className="size-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
            </div>
          </div>
          <div className="skeleton h-7 w-2/3 rounded-lg" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    </div>
  );
}
