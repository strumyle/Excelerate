
import { QuestionsList } from "@/components/questions/QuestionsList";

const Questions = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Question Bank</h1>
      </div>
      <QuestionsList />
    </div>
  );
};

export default Questions;
