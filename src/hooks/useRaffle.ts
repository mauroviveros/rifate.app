import { useCallback, useMemo, useState } from 'react';

export function useRaffle({
  length,
  initials,
}: {
  length: number;
  initials?: { solds?: number[]; selecteds?: number[] };
}) {
  const [solds, setSolds] = useState<number[]>(initials?.solds ?? []);
  const [selecteds, setSelecteds] = useState<number[]>(
    initials?.selecteds ?? [],
  );

  const toggleSelectedNumber = useCallback(
    (number: number) => {
      if (!Number.isInteger(number) || number < 0 || number >= length) return;
      if (solds.includes(number)) return;

      setSelecteds((current) => {
        if (current.includes(number))
          return current.filter((n) => n !== number);
        return [...current, number].sort((a, b) => a - b);
      });
    },
    [length, solds],
  );

  const clearSelection = useCallback(() => {
    setSelecteds([]);
  }, []);

  const addSolds = useCallback((newSolds: number[]) => {
    setSolds((current) =>
      [...new Set([...current, ...newSolds])].sort((a, b) => a - b),
    );
  }, []);

  const raffle = useMemo(() => {
    const soldsSet = new Set(solds);
    const selectedsSet = new Set(selecteds);

    return {
      length,
      numbers: {
        solds: Array.from(soldsSet),
        selecteds: Array.from(selectedsSet),
        availables: Array.from({ length }, (_, i) => i).filter(
          (number) => !soldsSet.has(number) && !selectedsSet.has(number),
        ),
      },
      count: {
        solds: soldsSet.size,
        selecteds: selectedsSet.size,
        availables: length - soldsSet.size - selectedsSet.size,
      },
    };
  }, [length, solds, selecteds]);

  return {
    raffle,
    toggleSelectedNumber,
    clearSelection,
    addSolds,
  };
}
