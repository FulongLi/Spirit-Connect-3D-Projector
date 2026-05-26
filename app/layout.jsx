import './globals.css';

export const metadata = {
  title: 'Spirit Connect Hologram',
  description: 'A voice-reactive particle companion built with React Three Fiber.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
