
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkAgora",
  description:
    "Un tutor socrático que te ayuda a aprender mediante preguntas y reflexión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
