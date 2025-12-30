import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/assets/styles/globals.css";
import { APP_DESCRIPTION, APP_NAME, SERVER_URL } from "@/lib/constants";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import ChatWidget from "@/components/chat/ChatWidget";
import FloatingCart from "@/components/shared/floating-cart";
import { getMyCart } from "@/lib/actions/cart.actions";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_NAME}`,
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(SERVER_URL),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cart = await getMyCart();
  const cartItemsCount = cart?.items.reduce((acc, item) => acc + item.qty, 0) || 0;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          {/* 
            FloatingCart: Floating cart button above chat widget
            WHY here: Root layout ensures it's present throughout the app
          */}
          <FloatingCart cartItemsCount={cartItemsCount} />
          {/* 
            ChatWidget: Floating AI assistant available on all pages
            WHY here: Root layout ensures it's present throughout the app
            WHY after children: Ensures it renders on top of page content
          */}
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
