import { Toaster } from 'sonner';

export default function DownloadApkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" richColors />
    </>
  );
}
