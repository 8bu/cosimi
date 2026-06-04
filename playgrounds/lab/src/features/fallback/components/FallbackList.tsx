import { useFallback } from "../hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export function FallbackList() {
  const { data, isLoading } = useFallback();
  if (isLoading)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  if (!data || data.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No retrieval misses yet.
        </CardContent>
      </Card>
    );
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead className="w-20">Count</TableHead>
            <TableHead className="w-52">Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.input}</TableCell>
              <TableCell>{r.count}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(r.last_seen).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
