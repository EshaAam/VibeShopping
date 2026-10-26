import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { requireAdmin } from '@/lib/auth-guard';

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB' } })
    .middleware(async () => {
      // Only product images are uploaded, so only admins may upload - any
      // signed-in customer could otherwise fill the storage quota.
      const session = await requireAdmin().catch(() => {
        throw new UploadThingError('Unauthorized');
      });
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata }) => {
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
