import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Folder, Grid3X3 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  tutorial_count?: number;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectCategory(null)}
          className={selectedCategory === null 
            ? "bg-primary text-primary-foreground" 
            : "hover:bg-secondary"
          }
        >
          <Grid3X3 className="w-4 h-4 mr-2" />
          All Tutorials
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectCategory(category.id)}
            className={selectedCategory === category.id 
              ? "" 
              : "hover:bg-secondary"
            }
            style={selectedCategory === category.id 
              ? { backgroundColor: category.color, borderColor: category.color }
              : { borderColor: `${category.color}50` }
            }
          >
            <Folder className="w-4 h-4 mr-2" style={{ color: selectedCategory === category.id ? 'white' : category.color }} />
            {category.name}
            {category.tutorial_count !== undefined && (
              <span className="ml-1 text-xs opacity-70">({category.tutorial_count})</span>
            )}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
