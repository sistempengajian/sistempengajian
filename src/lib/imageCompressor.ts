/**
 * Client-Side Image Pre-Compressor
 * Mengompresi foto lembar kerja dari kamera HP (JPG/PNG) menjadi WebP ringan (~150KB - 280KB)
 * sebelum diunggah ke Cloudinary untuk menghemat kuota free tier.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 s/d 1.0 (default 0.82)
}

/**
 * Mengompresi File gambar menjadi File WebP yang di-resize proporsional
 */
export async function compressImageToWebP(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options;

  // Jika bukan tipe gambar, kembalikan file asli
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Jika sudah WebP dan ukurannya sudah sangat kecil (< 300KB), lewati kompresi
  if (file.type === 'image/webp' && file.size < 300 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            // Hitung dimensi proporsional baru
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              // Fallback ke file asli jika context canvas tidak tersedia
              return resolve(file);
            }

            // Gambar ulang dengan smoothing aktif untuk menjaga ketajaman teks tulisan tangan
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  return resolve(file);
                }

                // Buat file baru berformat .webp
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                const compressedFile = new File([blob], `${baseName}.webp`, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });

                console.log(
                  `[ImageCompressor] Berhasil kompresi ${file.name}: ${(file.size / 1024).toFixed(
                    1
                  )} KB -> ${(compressedFile.size / 1024).toFixed(1)} KB (Hemat ${(
                    (1 - compressedFile.size / file.size) *
                    100
                  ).toFixed(1)}%)`
                );

                resolve(compressedFile);
              },
              'image/webp',
              quality
            );
          } catch (e) {
            console.warn('[ImageCompressor] Gagal memproses canvas, memakai file asli:', e);
            resolve(file);
          }
        };

        img.onerror = () => {
          resolve(file);
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        resolve(file);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('[ImageCompressor] Error inisialisasi reader, fallback ke file asli:', err);
      resolve(file);
    }
  });
}

/**
 * Mengubah File/Blob menjadi Base64 Data URL string
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
