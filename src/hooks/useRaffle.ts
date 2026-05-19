import { useCallback, useMemo, useState } from "react"


export function useRaffle({
  length,
  initials
}: {
  length: number,
  initials?: { solds?: number[]; selecteds?: number[] }
}) {
  const [solds, setSolds] = useState<number[]>(initials?.solds ?? []);
  const [selecteds, setSelecteds] = useState<number[]>(initials?.selecteds ?? []);

  const toggleSelectedNumber = useCallback((number: number) => {
    if (!Number.isInteger(number) || number < 0 || number >= length) return;
    if (solds.includes(number)) return;

    setSelecteds((current) => {
      if (current.includes(number)) return current.filter((n) => n !== number);
      return [...current, number].sort((a, b) => a - b);
    });
  }, [length, solds, selecteds]);

  const raffle = useMemo(() => {
    return {
      length,
      numbers: {
        solds: Array.from(new Set(solds)),
        selecteds: Array.from(new Set(selecteds)),
        availables: Array.from({ length }, (_, i) => i).filter(
          (number) => !solds.includes(number) && !selecteds.includes(number)
        ),
      },
      count: {
        solds: Array.from(new Set(solds)).length,
        selecteds: Array.from(new Set(selecteds)).length,
        availables: length - Array.from(new Set(solds)).length - Array.from(new Set(selecteds)).length
      }
    }
  }, [length, solds, selecteds]);

  return {
    raffle,
    toggleSelectedNumber
  }
}
