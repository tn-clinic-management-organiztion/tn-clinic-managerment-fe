import LabelingWorkspace from "@/components/labelling/LabelingWorkspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      <LabelingWorkspace imageId={id} />
    </div>
  );
}
