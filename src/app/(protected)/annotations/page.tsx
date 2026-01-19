import ImageGallery from '@/components/labelling/ImageGallery';

export default function LabellingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <ImageGallery />
      </div>
    </div>
  );
}