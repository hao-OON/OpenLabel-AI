import { useEffect, useState } from "react";
import { api } from "./api";
import type { Dataset } from "./types";

export function useDatasets(projectId?: number) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    const query = projectId ? `?project_id=${projectId}` : "";
    api
      .get<Dataset[]>(`/datasets${query}`)
      .then(setDatasets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [projectId]);

  return { datasets, loading, error, reload };
}

export function DatasetSelect({
  value,
  onChange,
  datasets,
  className = "",
}: {
  value: number | null;
  onChange: (id: number) => void;
  datasets: Dataset[];
  className?: string;
}) {
  return (
    <select
      className={`input ${className}`}
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="" disabled>
        选择数据集…
      </option>
      {datasets.map((d) => (
        <option key={d.id} value={d.id}>
          #{d.id} {d.name}（{d.record_count} 条）
        </option>
      ))}
    </select>
  );
}

export function useLocalDataset(key = "openlabel.datasetId") {
  const [datasetId, setDatasetId] = useState<number | null>(() => {
    const saved = localStorage.getItem(key);
    return saved ? Number(saved) : null;
  });
  const update = (id: number) => {
    setDatasetId(id);
    localStorage.setItem(key, String(id));
  };
  return [datasetId, update] as const;
}
