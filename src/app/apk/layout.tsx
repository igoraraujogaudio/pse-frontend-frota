import { Toaster } from 'sonner';

export default function ApkLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <title>PSE Mobile - Download APK</title>
        <meta name="description" content="Download da versão mais recente do PSE Mobile" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-gray-50">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}