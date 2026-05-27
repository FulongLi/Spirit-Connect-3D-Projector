import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/overlay/components/Footer/Footer";


export const metadata: Metadata = {
  title: "Spirit Connect",
  description:
    "A holographic interface for visualizing digitized consciousness in immersive 3D environments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
