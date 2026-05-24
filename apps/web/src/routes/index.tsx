import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChatPage() {
  return (
    <main className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">SimSimi</CardTitle>
          <p className="text-sm text-muted-foreground">
            A pattern-matching chatbot. Real chat view ships in Phase 11.
          </p>
        </CardHeader>
        <CardContent>
          <Button>Start chatting</Button>
        </CardContent>
      </Card>
      <section className="min-h-[400px] rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        (message list will live here)
      </section>
      <footer className="rounded-xl border bg-card p-3 text-sm text-muted-foreground shadow-sm">
        (composer will live here)
      </footer>
    </main>
  );
}
