import { Button } from './Button';

interface Props {
  stories: string[];
  onChange: (stories: string[]) => void;
}

export function StoryInputList({ stories, onChange }: Props) {
  function updateStory(index: number, value: string) {
    const next = [...stories];
    next[index] = value;
    onChange(next);
  }

  function removeStory(index: number) {
    onChange(stories.filter((_, i) => i !== index));
  }

  function addStory() {
    onChange([...stories, '']);
  }

  return (
    <div className="space-y-4">
      {stories.map((story, index) => (
        <div key={index}>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor={`story-${index}`} className="text-xs font-medium text-slate-500">
              Story {index + 1}
            </label>
            {stories.length > 1 && (
              <Button variant="ghost" type="button" onClick={() => removeStory(index)} className="!px-1 !py-0 text-xs">
                Remove
              </Button>
            )}
          </div>
          <textarea
            id={`story-${index}`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={4}
            placeholder='As a user, I want to... so that...'
            value={story}
            onChange={(e) => updateStory(index, e.target.value)}
          />
        </div>
      ))}
      <Button variant="secondary" type="button" onClick={addStory}>
        + Add Story
      </Button>
    </div>
  );
}
