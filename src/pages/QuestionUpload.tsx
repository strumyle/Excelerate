
import { QuestionUpload as QuestionUploadComponent } from "@/components/questions/QuestionUpload";
import { useSearchParams } from "react-router-dom";

const QuestionUpload = () => {
  const [searchParams] = useSearchParams();
  const bank = searchParams.get('bank')?.trim() || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          {bank ? `Upload Questions - ${bank}` : 'Upload Questions'}
        </h1>
      </div>
      <QuestionUploadComponent forcedBank={bank || undefined} />
    </div>
  );
};

export default QuestionUpload;
