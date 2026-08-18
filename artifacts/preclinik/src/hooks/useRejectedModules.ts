import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

export function useRejectedModules() {
  const { getToken } = useAuth();

  return useQuery<string[]>({
    queryKey: ["/api/purchases/rejected"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/purchases/rejected", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to fetch rejected modules");
      return res.json() as Promise<string[]>;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
