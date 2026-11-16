import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-surface flex flex-1 flex-col">
      <header className="px-4 py-5 sm:px-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
