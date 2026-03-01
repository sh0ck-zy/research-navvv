import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Loader2, Upload } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
}

export function FileUpload({ onUpload, isUploading, disabled = false }: FileUploadProps) {
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) {
        return;
      }

      const firstPdf = acceptedFiles.find((file) => file.type === 'application/pdf');

      if (!firstPdf) {
        return;
      }

      await onUpload(firstPdf);
    },
    [disabled, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    maxSize: 25 * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={[
        'rounded-2xl border border-dashed p-8 text-center transition',
        disabled
          ? 'cursor-not-allowed border-slate-200/15 bg-slate-900/35 opacity-70'
          : '',
        isDragActive
          ? 'border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]'
          : 'border-cyan-100/20 bg-slate-900/55 hover:border-cyan-200/40 hover:bg-slate-900/75',
      ].join(' ')}
    >
      <input {...getInputProps()} />
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10">
        {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-cyan-200" /> : <Upload className="h-6 w-6 text-cyan-100" />}
      </div>
      <p className="text-sm font-semibold text-slate-100">
        {disabled
          ? 'Connect Supabase to enable ingest'
          : isUploading
          ? 'Uploading and indexing paper...'
          : isDragActive
            ? 'Drop your PDF here'
            : 'Drop a paper or click to ingest'}
      </p>
      <p className="mt-2 text-xs text-slate-300/75">Max 25 MB · PDF only · async AI parsing pipeline</p>
    </div>
  );
}
