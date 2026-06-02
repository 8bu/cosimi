import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UnansweredSource } from "@/api/unanswered";

interface Props {
  value: UnansweredSource;
  onChange: (next: UnansweredSource) => void;
}

export function SourceTabs({ value, onChange }: Props) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as UnansweredSource)}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="llm">LLM</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
