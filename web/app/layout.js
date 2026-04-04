import "./globals.css";

export const metadata = {
  title: "SURGhub Pathways",
  description:
    "Global surgery fellowships, grants and conferences for practitioners in LMICs",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://pathways.surghub.org"
  ),
  openGraph: {
    title: "SURGhub Pathways",
    description:
      "Global surgery fellowships, grants and conferences for practitioners in LMICs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SURGhub Pathways",
    description:
      "Global surgery fellowships, grants and conferences for practitioners in LMICs",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
