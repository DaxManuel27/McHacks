import { UserProvider } from '@auth0/nextjs-auth0/client';
import NavBar from '@/components/NavBar';
import '@/styles/globals.css';

export const metadata = {
  title: 'MCHacks',
  description: 'MCHacks Project',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <NavBar />
          <main>{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
