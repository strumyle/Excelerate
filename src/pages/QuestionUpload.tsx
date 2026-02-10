
import { QuestionUpload as QuestionUploadComponent } from "@/components/questions/QuestionUpload";

const QuestionUpload = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Upload Questions</h1>
      </div>
      <QuestionUploadComponent />
    </div>
  );
};

export default QuestionUpload;
