import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteDocument, listDocuments } from "@/lib/api/admin-client";

export function useDocuments() {
  return useQuery({ queryKey: ["documents"], queryFn: listDocuments });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["chunks"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        data.deletedPairs > 0
          ? `Document deleted — purged ${data.deletedPairs} pairs`
          : "Document deleted",
      );
    },
    onError: (e) =>
      toast.error(`Delete failed — ${e instanceof Error ? e.message : "request failed"}`),
  });
}
