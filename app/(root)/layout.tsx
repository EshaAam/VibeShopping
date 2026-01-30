import Header from "@/components/shared/header";
import Footer from "@/components/footer";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 wrapper pb-20 sm:pb-4">{children}</main>
      <Footer />
    </div>
  );
}
