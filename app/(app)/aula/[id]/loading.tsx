export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-4" aria-busy="true" aria-label="Carregando aula">
      <div className="-mx-4 aspect-video bg-black sm:mx-0 sm:rounded-2xl">
        <div className="grid size-full place-items-center">
          <span className="size-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
      </div>
      <div className="skeleton h-7 w-2/3 rounded-lg" />
      <div className="skeleton h-14 rounded-xl" />
    </div>
  );
}
